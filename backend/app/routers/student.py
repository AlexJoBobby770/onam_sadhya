import os
import uuid
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models import User, Ticket, TicketStatus
from app.schemas import UserResponse, TicketResponse, ProfileUpdateRequest
from app.utils.security import get_current_user
from app.utils.qr import generate_qr_code_base64

router = APIRouter(prefix="", tags=["Student"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "proofs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5MB cap

def build_ticket_response(ticket: Ticket, with_qr: bool = False) -> TicketResponse:
    qr_b64 = None
    if with_qr and ticket.status == TicketStatus.APPROVED and ticket.qr_token:
        qr_b64 = generate_qr_code_base64(ticket.qr_token)

    return TicketResponse(
        id=ticket.id,
        user_id=ticket.user_id,
        user_name=ticket.user.name if ticket.user else "Unknown",
        user_email=ticket.user.email if ticket.user else None,
        user_phone=ticket.user.phone if ticket.user else None,
        user_roll_no=ticket.user.roll_no if ticket.user else None,
        status=ticket.status,
        payment_proof_url=ticket.payment_proof_url,
        payment_note=ticket.payment_note,
        rejection_reason=ticket.rejection_reason,
        qr_token=ticket.qr_token if (with_qr and ticket.status == TicketStatus.APPROVED) else None,
        qr_code_base64=qr_b64,
        used=ticket.used,
        scanned_at=ticket.scanned_at,
        scanned_by=ticket.scanned_by,
        scanned_by_name=ticket.scanner.name if ticket.scanner else None,
        reviewed_by=ticket.reviewed_by,
        created_at=ticket.created_at
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)

@router.post("/student/profile", response_model=UserResponse)
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not payload.roll_no or not payload.roll_no.strip():
        raise HTTPException(status_code=400, detail="Class or Roll Number is required.")

    current_user.roll_no = payload.roll_no.strip()
    if payload.name and payload.name.strip():
        current_user.name = payload.name.strip()

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)

@router.get("/tickets/me", response_model=Optional[TicketResponse])
async def get_my_ticket(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Ticket)
        .options(
            selectinload(Ticket.user),
            selectinload(Ticket.scanner)
        )
        .where(Ticket.user_id == current_user.id)
        .order_by(Ticket.created_at.desc())
    )
    result = await db.execute(stmt)
    ticket = result.scalars().first()
    if not ticket:
        return None
    return build_ticket_response(ticket, with_qr=True)

@router.post("/tickets", response_model=TicketResponse)
async def submit_ticket(
    note: Optional[str] = Form(None),
    proof_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Profile completeness check
    if not current_user.roll_no or not current_user.roll_no.strip():
        raise HTTPException(
            status_code=400,
            detail="Profile incomplete: Class/Roll number is required before submitting a ticket."
        )

    # Check if user already has an active pending or approved ticket
    stmt = select(Ticket).where(
        Ticket.user_id == current_user.id,
        Ticket.status.in_([TicketStatus.PENDING, TicketStatus.APPROVED])
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        if existing.status == TicketStatus.PENDING:
            raise HTTPException(status_code=400, detail="You already have a pending ticket request under review")
        if existing.status == TicketStatus.APPROVED:
            raise HTTPException(status_code=400, detail="You already have an approved Sadhya ticket")

    file_url = None
    if proof_file and proof_file.filename:
        # 1. Reject non-image content types
        content_type = proof_file.content_type or ""
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files (JPG, PNG, WebP) are allowed.")

        # 2. Stream to check 5MB cap
        chunks = []
        bytes_read = 0
        chunk_size = 64 * 1024
        while True:
            chunk = await proof_file.read(chunk_size)
            if not chunk:
                break
            bytes_read += len(chunk)
            if bytes_read > MAX_UPLOAD_SIZE_BYTES:
                raise HTTPException(status_code=400, detail="File size exceeds maximum allowed 5MB limit.")
            chunks.append(chunk)

        file_bytes = b"".join(chunks)
        ext = os.path.splitext(proof_file.filename)[1] or ".png"
        filename = f"proof_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"

        # 3. Stream upload to Supabase Storage if configured, else local storage
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                async with httpx.AsyncClient() as client:
                    supabase_endpoint = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{settings.SUPABASE_BUCKET}/{filename}"
                    headers = {
                        "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                        "Content-Type": content_type,
                        "x-upsert": "true"
                    }
                    res = await client.post(supabase_endpoint, headers=headers, content=file_bytes)
                    if res.status_code in (200, 201):
                        file_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{filename}"
                    else:
                        print(f"--> [SUPABASE STORAGE UPLOAD WARNING] Status {res.status_code}: {res.text}. Using local storage fallback.")
                        filepath = os.path.join(UPLOAD_DIR, filename)
                        with open(filepath, "wb") as f:
                            f.write(file_bytes)
                        file_url = f"/uploads/proofs/{filename}"
            except Exception as e:
                print(f"--> [SUPABASE STORAGE EXCEPTION] {e}. Using local storage fallback.")
                filepath = os.path.join(UPLOAD_DIR, filename)
                with open(filepath, "wb") as f:
                    f.write(file_bytes)
                file_url = f"/uploads/proofs/{filename}"
        else:
            filepath = os.path.join(UPLOAD_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(file_bytes)
            file_url = f"/uploads/proofs/{filename}"

    ticket = Ticket(
        user_id=current_user.id,
        status=TicketStatus.PENDING,
        payment_proof_url=file_url,
        payment_note=note
    )
    db.add(ticket)
    await db.commit()

    # Query back with relationships
    stmt = (
        select(Ticket)
        .options(selectinload(Ticket.user), selectinload(Ticket.scanner))
        .where(Ticket.id == ticket.id)
    )
    ticket = (await db.execute(stmt)).scalar_one()

    return build_ticket_response(ticket, with_qr=False)

