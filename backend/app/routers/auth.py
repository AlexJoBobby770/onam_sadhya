import os
import secrets
from datetime import datetime, timedelta, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.config import settings
from app.database import get_db
from app.models import User, UserRole, OverrideAttempt
from app.schemas import (
    DevLoginRequest, GoogleLoginRequest, AdminOverrideRequest, TokenResponse, UserResponse
)
from app.utils.security import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

def _verify_google_credential(credential: str) -> dict:
    """
    Verifies Google ID token server-side strictly using google-auth library.
    Audience (aud) is enforced against settings.GOOGLE_CLIENT_ID.
    """
    try:
        req = google_requests.Request()
        id_info = google_id_token.verify_oauth2_token(
            credential,
            req,
            audience=settings.GOOGLE_CLIENT_ID
        )
        return id_info
    except Exception as e:
        print(f"--> [GOOGLE OAUTH VERIFICATION FAILURE] {e}")
        raise HTTPException(
            status_code=400,
            detail="Could not verify Google account credentials. Invalid, expired, or audience mismatch token."
        )

@router.post("/google", response_model=TokenResponse)
async def google_login(payload: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Google-Only OAuth authentication route.
    Verifies Google ID token server-side with google-auth library and audience (aud) matching.
    """
    if not payload.credential or not payload.credential.strip():
        raise HTTPException(
            status_code=400,
            detail="Google ID token credential is required for login."
        )

    # verify_oauth2_token fetches Google's signing certs over HTTPS and is fully
    # synchronous - called inline it stalls the event loop on every single login.
    token_data = await run_in_threadpool(_verify_google_credential, payload.credential.strip())
    email = token_data.get("email", "").strip().lower()
    name = token_data.get("name") or "Student"
    google_id = token_data.get("sub")

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Could not verify Google account credentials. Missing email claim."
        )

    # Check if Super Admin email match (supports comma-separated list in ADMIN_EMAIL)
    admin_emails_raw = os.getenv("ADMIN_EMAIL", "admin@onamsadhya.org")
    admin_emails = [e.strip().lower() for e in admin_emails_raw.split(",") if e.strip()]
    is_super_admin = (email in admin_emails)

    # Find or create user by email
    user_stmt = select(User).where(User.email == email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=name,
            google_id=google_id,
            role=UserRole.SUPER_ADMIN if is_super_admin else UserRole.STUDENT
        )
        db.add(user)
        await db.flush()
    else:
        # Promote to SUPER_ADMIN if email matches admin_email
        if is_super_admin and user.role != UserRole.SUPER_ADMIN:
            user.role = UserRole.SUPER_ADMIN
        if google_id and not user.google_id:
            user.google_id = google_id

    await db.commit()
    await db.refresh(user)

    token = create_access_token(data={"sub": user.id, "role": user.role.value, "email": user.email})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.post("/admin-override", response_model=TokenResponse)
async def admin_override(
    payload: AdminOverrideRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Secure Admin Override endpoint with DB-backed rate limiting & audit logging.
    Strictly target-scoped to ADMIN_EMAIL (no arbitrary user email promotion).
    Locks out after 5 failed attempts per hour per IP.
    """
    # Extract client IP
    client_ip = "127.0.0.1"
    if request.headers.get("x-forwarded-for"):
        client_ip = request.headers.get("x-forwarded-for").split(",")[0].strip()
    elif request.client and request.client.host:
        client_ip = request.client.host

    admin_email = os.getenv("ADMIN_EMAIL", "admin@onamsadhya.org").strip().lower()

    # DB-backed rate limiter check: Count failed attempts in the last 1 hour for this IP
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    rate_limit_stmt = select(func.count(OverrideAttempt.id)).where(
        OverrideAttempt.ip_address == client_ip,
        OverrideAttempt.success == False,
        OverrideAttempt.created_at >= one_hour_ago
    )
    failed_count = (await db.execute(rate_limit_stmt)).scalar_one() or 0

    if failed_count >= 5:
        print(f"--> [SECURITY LOCKOUT] IP={client_ip} exceeded max override attempts ({failed_count}/5 in 1h)")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed override attempts. Lockout in effect for 1 hour."
        )

    # Constant-time comparison to prevent timing attacks
    expected_code = settings.SUPER_ADMIN_OVERRIDE_CODE.strip()
    provided_code = payload.override_code.strip()
    is_valid = secrets.compare_digest(provided_code, expected_code)

    # Record attempt in DB for persistent multi-worker audit logging & rate limiting
    attempt = OverrideAttempt(
        ip_address=client_ip,
        success=is_valid,
        target_email=admin_email
    )
    db.add(attempt)
    await db.commit()

    print(f"--> [ADMIN OVERRIDE AUDIT LOG] IP={client_ip} Success={is_valid} Target={admin_email} Time={datetime.now(timezone.utc)}")

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid override authorization code."
        )

    # Find or create target admin user
    user_stmt = select(User).where(User.email == admin_email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        user = User(
            email=admin_email,
            name="Super Admin Override",
            roll_no="OVERRIDE-01",
            role=UserRole.SUPER_ADMIN
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Issue session-scoped super_admin access token for ADMIN_EMAIL
    token = create_access_token(data={"sub": user.id, "role": UserRole.SUPER_ADMIN.value, "email": user.email})
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

    email = (payload.email or payload.phone or "dev@onamsadhya.org").strip().lower()
    user_stmt = select(User).where(User.email == email)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=payload.name,
            roll_no=payload.roll_no,
            role=payload.role
        )
        db.add(user)
    else:
        user.name = payload.name
        user.role = payload.role
        if payload.roll_no:
            user.roll_no = payload.roll_no

    await db.commit()
    await db.refresh(user)

    token = create_access_token(data={"sub": user.id, "role": user.role.value, "email": user.email})
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
