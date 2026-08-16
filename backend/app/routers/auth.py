import asyncio
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, UserRole, OTPRequest
from app.schemas import (
    SendOTPRequest, SendOTPResponse,
    VerifyOTPRequest, DevLoginRequest, TokenResponse, UserResponse
)
from app.utils.security import generate_otp, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

def _send_email_otp_sync(recipient_email: str, otp_code: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        return False
    try:
        msg = MIMEText(
            f"Greetings from Onam Sadhya Organising Committee!\n\n"
            f"Your single-use gate pass verification OTP code is: {otp_code}\n\n"
            f"This code will expire in {settings.OTP_EXPIRY_MINUTES} minutes.\n"
            f"Do not share this code with anyone."
        )
        msg["Subject"] = "Onam Sadhya Pass — Email Verification OTP"
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = recipient_email

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"--> [EMAIL SENT] OTP dispatched to {recipient_email}")
        return True
    except Exception as e:
        print(f"--> [EMAIL ERROR] Failed to dispatch OTP to {recipient_email}: {e}")
        return False

import re

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@router.post("/send-otp", response_model=SendOTPResponse)
async def send_otp(payload: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    email_or_phone = payload.phone.strip().lower()
    
    # Syntactic Email Validation (reject malformed email addresses)
    if not EMAIL_REGEX.match(email_or_phone):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid email address (e.g. student@gmail.com)."
        )


    # Rate limiting check (cooldown of 30 seconds for recent request)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=30)
    stmt = select(OTPRequest).where(
        OTPRequest.phone == email_or_phone,
        OTPRequest.created_at >= cutoff
    )
    result = await db.execute(stmt)
    recent = result.scalars().first()
    if recent:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OTP already sent recently. Please wait 30 seconds before retrying."
        )

    otp_code = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    otp_req = OTPRequest(
        phone=email_or_phone,
        otp_code=otp_code,
        expires_at=expires_at,
        verified=False
    )
    db.add(otp_req)
    await db.commit()

    # Dispatch email OTP; only raise on a real send failure, not on SMTP being unconfigured (dev mode)
    if "@" in email_or_phone and settings.SMTP_HOST:
        sent = await asyncio.to_thread(_send_email_otp_sync, email_or_phone, otp_code)
        if not sent:
            raise HTTPException(
                status_code=502,
                detail="Could not send the verification email right now. Please try again shortly."
            )

    return SendOTPResponse(
        message="Verification OTP sent successfully",
        phone=email_or_phone,
        dev_otp=otp_code if settings.DEV_MODE else None
    )

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(payload: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    phone_or_email = payload.phone.strip().lower()
    otp = payload.otp.strip()

    if not payload.roll_no or not payload.roll_no.strip():
        raise HTTPException(status_code=400, detail="College Roll Number is required for signup.")

    # Find the latest pending OTP for this email, regardless of the code entered,
    # so wrong guesses can be counted against it
    now = datetime.now(timezone.utc)
    stmt = select(OTPRequest).where(
        OTPRequest.phone == phone_or_email,
        OTPRequest.verified == False,
        OTPRequest.expires_at > now
    ).order_by(OTPRequest.created_at.desc())
    result = await db.execute(stmt)
    otp_record = result.scalars().first()

    if not otp_record or otp_record.attempts >= 5:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code. Please request a new one.")

    if otp_record.otp_code != otp:
        otp_record.attempts += 1
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")

    # Mark OTP as verified
    otp_record.verified = True

    # Find or create user
    user_stmt = select(User).where(User.phone == phone_or_email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        # All self-registered users via OTP default to STUDENT role (Super admin is seeded explicitly)
        user = User(
            phone=phone_or_email,
            name=payload.name.strip() if payload.name else "Student",
            roll_no=payload.roll_no.strip(),
            role=UserRole.STUDENT
        )
        db.add(user)
        await db.flush()

    await db.commit()
    await db.refresh(user)

    token = create_access_token(data={"sub": user.id, "role": user.role.value, "phone": user.phone})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(payload: DevLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Development endpoint to easily switch and test roles.
    """
    if not settings.DEV_MODE:
        raise HTTPException(status_code=403, detail="Dev login is disabled in production")

    phone = payload.phone.strip()
    user_stmt = select(User).where(User.phone == phone)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        user = User(
            phone=phone,
            name=payload.name,
            roll_no=payload.roll_no,
            role=payload.role
        )
        db.add(user)
    else:
        # Update user details if requested in dev mode
        user.name = payload.name
        user.role = payload.role
        if payload.roll_no:
            user.roll_no = payload.roll_no

    await db.commit()
    await db.refresh(user)

    token = create_access_token(data={"sub": user.id, "role": user.role.value, "phone": user.phone})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )
