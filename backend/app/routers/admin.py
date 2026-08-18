import csv
import io
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models import User, Ticket, TicketStatus, UserRole
from app.schemas import (
    TicketResponse, TicketApproveRequest, TicketRejectRequest, BulkApproveRequest,
    ScanRequest, ScanResponse, ManualScanRequest, UserResponse, UserRoleUpdate, AnalyticsResponse
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
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_or_super)
):
    stmt = (
        select(Ticket)
        .join(Ticket.user)
        .options(
            selectinload(Ticket.user),
            selectinload(Ticket.scanner)
        )
        .order_by(Ticket.created_at.desc())
    )
    if status_filter and status_filter.lower() != 'all':
        status_enum = status_filter.lower()
        stmt = stmt.where(Ticket.status == status_enum)

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.name).like(s),
                func.lower(User.email).like(s),
                func.lower(User.roll_no).like(s)
            )
        )

    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    tickets = result.scalars().all()
    return [build_ticket_response(t, with_qr=False) for t in tickets]

@router.post("/tickets/bulk-approve", response_model=List[TicketResponse])
async def bulk_approve_tickets(
    payload: BulkApproveRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_or_super)
):
    if not payload.ticket_ids:
        return []

    stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user), selectinload(Ticket.scanner))
        .where(Ticket.id.in_(payload.ticket_ids))
    )
    tickets = (await db.execute(stmt)).scalars().all()

    approved_list = []
    for ticket in tickets:
        if ticket.status == TicketStatus.PENDING:
            ticket.status = TicketStatus.APPROVED
            ticket.qr_token = generate_qr_token(ticket.id)
            ticket.reviewed_by = admin.id
            if payload.note:
                ticket.payment_note = payload.note
            approved_list.append(ticket)

    await db.commit()
    for t in approved_list:
        await db.refresh(t)

    return [build_ticket_response(t, with_qr=False) for t in approved_list]

@router.get("/approved-tickets")
async def list_approved_tickets(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_or_super)
):
    stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user))
        .where(Ticket.status == TicketStatus.APPROVED)
    )
    tickets = (await db.execute(stmt)).scalars().all()
    return [{
        "ticket_id": t.id,
        "user_name": t.user.name if t.user else "",
        "user_email": t.user.email if t.user else "",
        "user_phone": t.user.phone if t.user else "",
        "user_roll_no": t.user.roll_no if t.user else "",
        "qr_token": t.qr_token,
        "used": t.used
    } for t in tickets]

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
    return build_ticket_response(ticket, with_qr=False)

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
    return build_ticket_response(ticket, with_qr=False)

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
            email=ticket.user.email,
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
            # Timezone Fix: Convert to Asia/Kolkata IST
            ist_tz = timezone(timedelta(hours=5, minutes=30))
            ist_scanned_at = ticket.scanned_at.astimezone(ist_tz) if ticket.scanned_at else now
            formatted_time = ist_scanned_at.strftime('%I:%M %p')
            return ScanResponse(
                success=False,
                message=f"ALREADY SCANNED — Ticket was scanned previously on {formatted_time} IST by {scanned_by_str}.",
                status="ALREADY_USED",
                student_name=ticket.user.name,
                roll_no=ticket.user.roll_no,
                email=ticket.user.email,
                phone=ticket.user.phone,
                previously_scanned_at=ticket.scanned_at,
                scanned_by_name=scanned_by_str
            )

        return ScanResponse(
            success=False,
            message="Scan validation failed.",
            status="INVALID_TOKEN"
        )

@router.post("/scan-manual", response_model=ScanResponse)
async def scan_manual(
    payload: ManualScanRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin_or_super)
):
    """
    Manual Entry Endpoint for students with dead phones.
    Reuses the exact same atomic update logic to prevent race conditions.
    """
    ticket_id = payload.ticket_id.strip()
    now = datetime.now(timezone.utc)

    # Reuses atomic update logic
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

    ticket_stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user), selectinload(Ticket.scanner))
        .where(Ticket.id == ticket_id)
    )
    ticket = (await db.execute(ticket_stmt)).scalar_one_or_none()

    if not ticket:
        return ScanResponse(
            success=False,
            message="INVALID TICKET — Record does not exist.",
            status="INVALID_TOKEN"
        )

    if result.rowcount > 0:
        return ScanResponse(
            success=True,
            message=f"ENTRY GRANTED (MANUAL) — Welcome to Onam Sadhya, {ticket.user.name}!",
            status="GRANTED",
            student_name=ticket.user.name,
            roll_no=ticket.user.roll_no,
            email=ticket.user.email,
            phone=ticket.user.phone,
            scanned_at=ticket.scanned_at,
            scanned_by_name=admin.name
        )
    else:
        if ticket.status != TicketStatus.APPROVED:
            return ScanResponse(
                success=False,
                message=f"REJECTED — Ticket status is '{ticket.status.value.upper()}'.",
                status="TICKET_NOT_APPROVED",
                student_name=ticket.user.name
            )

        if ticket.used:
            scanned_by_str = ticket.scanner.name if ticket.scanner else "Gatekeeper"
            ist_tz = timezone(timedelta(hours=5, minutes=30))
            ist_scanned_at = ticket.scanned_at.astimezone(ist_tz) if ticket.scanned_at else now
            formatted_time = ist_scanned_at.strftime('%I:%M %p')
            return ScanResponse(
                success=False,
                message=f"ALREADY SCANNED — Ticket was scanned previously on {formatted_time} IST by {scanned_by_str}.",
                status="ALREADY_USED",
                student_name=ticket.user.name,
                roll_no=ticket.user.roll_no,
                email=ticket.user.email,
                phone=ticket.user.phone,
                previously_scanned_at=ticket.scanned_at,
                scanned_by_name=scanned_by_str
            )

        return ScanResponse(
            success=False,
            message="Manual scan validation failed.",
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
        "Ticket ID", "Student Name", "Roll No", "Email", "Status",
        "Payment Note", "Rejection Reason", "Used", "Scanned At", "Scanned By", "Created At"
    ])

    for t in tickets:
        writer.writerow([
            t.id,
            t.user.name if t.user else "",
            t.user.roll_no if t.user else "",
            t.user.email if t.user else "",
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
