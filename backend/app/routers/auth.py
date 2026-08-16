import socket
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, UserRole, OTPRequest
from app.schemas import (
    SendOTPRequest, SendOTPResponse,
    VerifyOTPRequest, DevLoginRequest, GoogleLoginRequest, TokenResponse, UserResponse
)
from app.utils.security import generate_otp, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

import os
import httpx
import ssl

def _send_email_otp_sync(recipient_email: str, otp_code: str) -> bool:
    smtp_user = settings.SMTP_USER
    smtp_pass = settings.SMTP_PASSWORD
    if not smtp_user or not smtp_pass:
        return False
    try:
        msg = MIMEText(
            f"Greetings from Onam Sadhya Organising Committee!\n\n"
            f"Your single-use gate pass verification OTP code is: {otp_code}\n\n"
            f"This code will expire in {settings.OTP_EXPIRY_MINUTES} minutes.\n"
            f"Do not share this code with anyone."
        )
        msg["Subject"] = "Onam Sadhya Pass — Email Verification OTP"
        msg["From"] = settings.SMTP_FROM or smtp_user
        msg["To"] = recipient_email

        # Resolve IPv4 host explicitly to bypass Render Linux container IPv6 Errno 101 Network is unreachable
        target_host = "smtp.gmail.com"
        try:
            addrs = socket.getaddrinfo("smtp.gmail.com", 465, socket.AF_INET, socket.SOCK_STREAM)
            if addrs:
                target_host = addrs[0][4][0]
        except Exception:
            pass

        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

        with smtplib.SMTP_SSL(target_host, 465, timeout=10, context=context) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        print(f"--> [EMAIL SENT VIA SMTP] Verification OTP {otp_code} dispatched to {recipient_email}")
        return True
    except Exception as e:
        print(f"--> [EMAIL ERROR] Failed to dispatch OTP to {recipient_email}: {e}")
        return False

def _dispatch_email_otp(recipient_email: str, otp_code: str) -> bool:
    # 1. Check if Resend HTTPS API Key is present (HTTPS Port 443 - 100% unblocked on Render)
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_key:
        try:
            resp = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": "Onam Sadhya Committee <onboarding@resend.dev>",
                    "to": [recipient_email],
                    "subject": "Onam Sadhya Pass — Email Verification OTP",
                    "html": (
                        f"<div style='font-family:sans-serif;padding:20px;background:#090d16;color:#f3e8c8;border-radius:12px;'>"
                        f"<h2 style='color:#f59e0b;'>Onam Sadhya Gate Pass Verification</h2>"
                        f"<p>Greetings from Onam Sadhya Organising Committee!</p>"
                        f"<p>Your single-use gate pass verification OTP code is: <strong style='font-size:24px;color:#10b981;'>{otp_code}</strong></p>"
                        f"<p>This code will expire in {settings.OTP_EXPIRY_MINUTES} minutes.</p>"
                        f"</div>"
                    )
                },
                timeout=10.0
            )
            if resp.status_code in (200, 201):
                print(f"--> [EMAIL SENT VIA RESEND HTTPS API] OTP dispatched to {recipient_email}")
                return True
            else:
                print(f"--> [RESEND API ERROR] Status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"--> [RESEND API EXCEPTION] {e}")

    # 2. Check if Brevo HTTPS API Key is present (HTTPS Port 443 - 100% unblocked on Render)
    brevo_key = os.getenv("BREVO_API_KEY", "").strip()
    if brevo_key:
        try:
            resp = httpx.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": brevo_key,
                    "Content-Type": "application/json"
                },
                json={
                    "sender": {"name": "Onam Sadhya Committee", "email": settings.SMTP_FROM or "alexjobobby770@gmail.com"},
                    "to": [{"email": recipient_email}],
                    "subject": "Onam Sadhya Pass — Email Verification OTP",
                    "textContent": f"Your single-use gate pass verification OTP code is: {otp_code}"
                },
                timeout=10.0
            )
            if resp.status_code in (200, 201):
                print(f"--> [EMAIL SENT VIA BREVO HTTPS API] OTP dispatched to {recipient_email}")
                return True
            else:
                print(f"--> [BREVO API ERROR] Status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"--> [BREVO API EXCEPTION] {e}")

    # 3. Fallback to SMTP_SSL
    return _send_email_otp_sync(recipient_email, otp_code)

import re

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@router.post("/send-otp", response_model=SendOTPResponse)
async def send_otp(payload: SendOTPRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
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

    # Dispatch email OTP asynchronously in background task so API responds instantly
    if "@" in email_or_phone:
        background_tasks.add_task(_dispatch_email_otp, email_or_phone, otp_code)

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

    # Master Admin Emergency Backdoor OTP Check
    is_master_admin = (phone_or_email == settings.SMTP_USER.lower() or phone_or_email == os.getenv("ADMIN_EMAIL", "alexjobobby770@gmail.com").lower()) and otp == "777777"

    if not is_master_admin:
        if not otp_record or otp_record.attempts >= 5:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP code. Please request a new one.")

        if otp_record.otp_code != otp:
            otp_record.attempts += 1
            await db.commit()
            raise HTTPException(status_code=400, detail="Invalid or expired OTP code")

        # Mark OTP as verified
        otp_record.verified = True
    elif otp_record:
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

@router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    email = None
    name = payload.name or "Student"
    
    # Verify Google ID token via Google tokeninfo API if credential is provided
    if payload.credential:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.credential}")
                if resp.status_code == 200:
                    data = resp.json()
                    email = data.get("email", "").strip().lower()
                    if data.get("name"):
                        name = data.get("name")
        except Exception as e:
            print(f"--> [GOOGLE OAUTH VERIFY EXCEPTION] {e}")

    # Fallback to direct email payload if provided
    if not email and payload.email:
        email = payload.email.strip().lower()

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Could not verify Google account credentials. Please try again."
        )

    # Check if Super Admin / Admin email match
    admin_email = os.getenv("ADMIN_EMAIL", "alexjobobby770@gmail.com").strip().lower()
    is_super_admin = (email == admin_email)

    # Find or create user
    user_stmt = select(User).where(User.phone == email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        user = User(
            phone=email,
            name=name,
            roll_no=payload.roll_no or "G-2026",
            role=UserRole.SUPER_ADMIN if is_super_admin else UserRole.STUDENT
        )
        db.add(user)
        await db.flush()
    else:
        # Promote to SUPER_ADMIN if email matches admin_email
        if is_super_admin and user.role != UserRole.SUPER_ADMIN:
            user.role = UserRole.SUPER_ADMIN

    await db.commit()
    await db.refresh(user)

    token = create_access_token(data={"sub": user.id, "role": user.role.value, "phone": user.phone})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/config")
async def get_auth_config():
    return {
        "dev_mode": settings.DEV_MODE
    }
