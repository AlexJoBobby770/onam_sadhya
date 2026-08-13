import csv
import io
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models import User, Ticket, TicketStatus, UserRole
from app.schemas import (
    TicketResponse, TicketApproveRequest, TicketRejectRequest,
    ScanRequest, ScanResponse, UserResponse, UserRoleUpdate, AnalyticsResponse
)
from app.utils.security import require_roles
from app.utils.qr import generate_qr_token, verify_and_extract_ticket_id, generate_qr_code_base64
from app.routers.student import build_ticket_response

router = APIRouter(prefix="/admin", tags=["Admin & Super Admin"])

# Dependency helpers
require_admin_or_super = require_roles([UserRole.ADMIN, UserRole.SUPER_ADMIN])
require_super_admin_only = require_roles([UserRole.SUPER_ADMIN])

# --- ADMIN ENDPOINTS ---

@router.get("/tickets", response_model=List[TicketResponse])
async def list_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_or_super)
):
    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.user),
            selectinload(Ticket.scanner)
        )
        .order_by(Ticket.created_at.desc())
    )
    if status_filter:
        status_enum = status_filter.lower()
        stmt = stmt.where(Ticket.status == status_enum)

    result = await db.execute(stmt)
    tickets = result.scalars().all()
    return [build_ticket_response(t) for t in tickets]

@router.post("/tickets/{ticket_id}/approve", response_model=TicketResponse)
async def approve_ticket(
    ticket_id: str,
    payload: Optional[TicketApproveRequest] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_or_super)
):
    stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user), selectinload(Ticket.scanner))
        .where(Ticket.id == ticket_id)
    )
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Generate HMAC signed QR token
    qr_token = generate_qr_token(ticket.id)

    ticket.status = TicketStatus.APPROVED
    ticket.qr_token = qr_token
    ticket.reviewed_by = admin.id
    if payload and payload.note:
        ticket.payment_note = payload.note

    await db.commit()
    await db.refresh(ticket)
    return build_ticket_response(ticket)

@router.post("/tickets/{ticket_id}/reject", response_model=TicketResponse)
async def reject_ticket(
    ticket_id: str,
    payload: TicketRejectRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_or_super)
):
    stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user), selectinload(Ticket.scanner))
        .where(Ticket.id == ticket_id)
    )
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = TicketStatus.REJECTED
    ticket.rejection_reason = payload.reason
    ticket.reviewed_by = admin.id
    ticket.qr_token = None

    await db.commit()
    await db.refresh(ticket)
    return build_ticket_response(ticket)

@router.post("/scan", response_model=ScanResponse)
async def scan_qr_code(
    payload: ScanRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_or_super)
):
    """
    Critical Endpoint: Atomic Scan Validation
    1. Verify HMAC signature of QR token.
    2. Atomically update ticket: used = true WHERE id = ticket_id AND used = false AND status = approved.
    3. If rowcount == 0, check if already scanned or invalid.
    """
    qr_token = payload.qr_token.strip()
    is_valid_sig, ticket_id = verify_and_extract_ticket_id(qr_token)

    if not is_valid_sig or not ticket_id:
        return ScanResponse(
            success=False,
            message="INVALID QR CODE — HMAC Signature verification failed or tampered token.",
            status="INVALID_TOKEN"
        )

    now = datetime.now(timezone.utc)

    # Atomic Update to prevent race conditions
    atomic_stmt = (
        update(Ticket)
        .where(
            Ticket.id == ticket_id,
            Ticket.used == False,
            Ticket.status == TicketStatus.APPROVED
        )
        .values(
            used=True,
            scanned_at=now,
            scanned_by=admin.id
        )
    )
    result = await db.execute(atomic_stmt)
    await db.commit()

    # Query back ticket details for response
    ticket_stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user), selectinload(Ticket.scanner))
        .where(Ticket.id == ticket_id)
    )
    ticket = (await db.execute(ticket_stmt)).scalar_one_or_none()

    if not ticket:
        return ScanResponse(
            success=False,
            message="INVALID TICKET — Ticket record does not exist.",
            status="INVALID_TOKEN"
        )

    if result.rowcount > 0:
        # Atomic update succeeded -> First scan!
        return ScanResponse(
            success=True,
            message=f"ENTRY GRANTED — Welcome to Onam Sadhya, {ticket.user.name}!",
            status="GRANTED",
            student_name=ticket.user.name,
            roll_no=ticket.user.roll_no,
            phone=ticket.user.phone,
            scanned_at=ticket.scanned_at,
            scanned_by_name=admin.name
        )
    else:
        # Atomic update matched 0 rows -> Either already used or not approved
        if ticket.status != TicketStatus.APPROVED:
            return ScanResponse(
                success=False,
                message=f"REJECTED — Ticket is in '{ticket.status.value.upper()}' status.",
                status="TICKET_NOT_APPROVED",
                student_name=ticket.user.name
            )

        if ticket.used:
            scanned_by_str = ticket.scanner.name if ticket.scanner else "Gatekeeper"
            return ScanResponse(
                success=False,
                message=f"ALREADY SCANNED — Ticket was scanned previously on {ticket.scanned_at.strftime('%I:%M %p')} by {scanned_by_str}.",
                status="ALREADY_USED",
                student_name=ticket.user.name,
                roll_no=ticket.user.roll_no,
                phone=ticket.user.phone,
                previously_scanned_at=ticket.scanned_at,
                scanned_by_name=scanned_by_str
            )

        return ScanResponse(
            success=False,
            message="Scan validation failed.",
            status="INVALID_TOKEN"
        )


# --- SUPER ADMIN ENDPOINTS ---

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin_only)
):
    stmt = select(User).order_by(User.created_at.desc())
    users = (await db.execute(stmt)).scalars().all()
    return [UserResponse.model_validate(u) for u in users]

@router.post("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin_only)
):
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_user.role = payload.role
    await db.commit()
    await db.refresh(target_user)
    return UserResponse.model_validate(target_user)

@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin_only)
):
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one() or 0
    total_students = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.STUDENT))).scalar_one() or 0
    total_admins = (await db.execute(select(func.count(User.id)).where(User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])))).scalar_one() or 0

    total_tickets = (await db.execute(select(func.count(Ticket.id)))).scalar_one() or 0
    pending_tickets = (await db.execute(select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.PENDING))).scalar_one() or 0
    approved_tickets = (await db.execute(select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.APPROVED))).scalar_one() or 0
    rejected_tickets = (await db.execute(select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.REJECTED))).scalar_one() or 0
    scanned_tickets = (await db.execute(select(func.count(Ticket.id)).where(Ticket.used == True))).scalar_one() or 0

    total_revenue = approved_tickets * settings.SADHYA_TICKET_PRICE

    return AnalyticsResponse(
        total_users=total_users,
        total_students=total_students,
        total_admins=total_admins,
        total_tickets=total_tickets,
        pending_tickets=pending_tickets,
        approved_tickets=approved_tickets,
        rejected_tickets=rejected_tickets,
        scanned_tickets=scanned_tickets,
        total_revenue=total_revenue
    )

@router.get("/export")
async def export_tickets_csv(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin_only)
):
    stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user), selectinload(Ticket.scanner))
        .order_by(Ticket.created_at.desc())
    )
    tickets = (await db.execute(stmt)).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Ticket ID", "Student Name", "Roll No", "Phone", "Status",
        "Payment Note", "Rejection Reason", "Used", "Scanned At", "Scanned By", "Created At"
    ])

    for t in tickets:
        writer.writerow([
            t.id,
            t.user.name if t.user else "",
            t.user.roll_no if t.user else "",
            t.user.phone if t.user else "",
            t.status.value,
            t.payment_note or "",
            t.rejection_reason or "",
            "Yes" if t.used else "No",
            t.scanned_at.strftime("%Y-%m-%d %H:%M:%S") if t.scanned_at else "",
            t.scanner.name if t.scanner else "",
            t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else ""
        ])

    output.seek(0)
    filename = f"onam_sadhya_tickets_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/tickets/{ticket_id}/revoke", response_model=TicketResponse)
async def revoke_or_reset_ticket(
    ticket_id: str,
    reset_used: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin_only)
):
    stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user), selectinload(Ticket.scanner))
        .where(Ticket.id == ticket_id)
    )
    ticket = (await db.execute(stmt)).scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if reset_used:
        ticket.used = False
        ticket.scanned_at = None
        ticket.scanned_by = None
    else:
        ticket.status = TicketStatus.REJECTED
        ticket.rejection_reason = "Revoked by Super Admin"

    await db.commit()
    await db.refresh(ticket)
    return build_ticket_response(ticket)
