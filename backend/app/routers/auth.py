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

@router.post("/send-otp", response_model=SendOTPResponse)
async def send_otp(payload: SendOTPRequest, db: AsyncSession = Depends(get_db)):
    phone = payload.phone.strip()
    if not phone or len(phone) < 8:
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    # Rate limiting check (cooldown of 30 seconds for recent request)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=30)
    stmt = select(OTPRequest).where(
        OTPRequest.phone == phone,
        OTPRequest.created_at >= cutoff
    )
    result = await db.execute(stmt)
    recent = result.scalar_one_or_none()
    if recent:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OTP already sent recently. Please wait 30 seconds before retrying."
        )

    otp_code = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    otp_req = OTPRequest(
        phone=phone,
        otp_code=otp_code,
        expires_at=expires_at,
        verified=False
    )
    db.add(otp_req)
    await db.commit()

    return SendOTPResponse(
        message="OTP sent successfully",
        phone=phone,
        dev_otp=otp_code if settings.DEV_MODE else None
    )

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(payload: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    phone = payload.phone.strip()
    otp = payload.otp.strip()

    # Find valid unexpired OTP
    now = datetime.now(timezone.utc)
    stmt = select(OTPRequest).where(
        OTPRequest.phone == phone,
        OTPRequest.otp_code == otp,
        OTPRequest.verified == False,
        OTPRequest.expires_at > now
    ).order_by(OTPRequest.created_at.desc())
    result = await db.execute(stmt)
    otp_record = result.scalar_one_or_none()

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")

    # Mark OTP as verified
    otp_record.verified = True

    # Find or create user
    user_stmt = select(User).where(User.phone == phone)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()

    if not user:
        # Check if first user ever, assign super admin if so for easy initial setup
        total_stmt = select(User)
        all_users = (await db.execute(total_stmt)).scalars().all()
        assigned_role = UserRole.SUPER_ADMIN if len(all_users) == 0 else UserRole.STUDENT

        user = User(
            phone=phone,
            name=payload.name or "Student",
            roll_no=payload.roll_no,
            role=assigned_role
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
