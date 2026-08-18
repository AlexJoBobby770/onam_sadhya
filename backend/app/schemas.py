from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.models import UserRole, TicketStatus

# Auth Schemas
class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., description="Google ID token returned by Google GSI")

class AdminOverrideRequest(BaseModel):
    override_code: str = Field(..., description="Secret Super Admin override authorization code")

class ProfileUpdateRequest(BaseModel):
    roll_no: str = Field(..., description="Class or Roll Number (Required)")
    name: Optional[str] = Field(None, description="Full Name of the student")

class DevLoginRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    name: str
    role: UserRole = UserRole.STUDENT
    roll_no: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

# User Schemas
class UserResponse(BaseModel):
    id: str
    email: str
    phone: Optional[str] = None
    name: str
    roll_no: Optional[str] = None
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserRoleUpdate(BaseModel):
    role: UserRole

# Ticket Schemas
class TicketCreate(BaseModel):
    payment_proof_url: Optional[str] = None
    payment_note: Optional[str] = None

class TicketResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    user_roll_no: Optional[str] = None
    status: TicketStatus
    payment_proof_url: Optional[str] = None
    payment_note: Optional[str] = None
    rejection_reason: Optional[str] = None
    qr_token: Optional[str] = None
    qr_code_base64: Optional[str] = None
    used: bool
    scanned_at: Optional[datetime] = None
    scanned_by: Optional[str] = None
    scanned_by_name: Optional[str] = None
    reviewed_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TicketApproveRequest(BaseModel):
    note: Optional[str] = None

class TicketRejectRequest(BaseModel):
    reason: str

class BulkApproveRequest(BaseModel):
    ticket_ids: List[str]
    note: Optional[str] = None

# Scan Schemas
class ScanRequest(BaseModel):
    qr_token: str

class ManualScanRequest(BaseModel):
    ticket_id: str


class ScanResponse(BaseModel):
    success: bool
    message: str
    status: str  # "GRANTED", "ALREADY_USED", "INVALID_TOKEN", "TICKET_NOT_APPROVED"
    student_name: Optional[str] = None
    roll_no: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    scanned_at: Optional[datetime] = None
    previously_scanned_at: Optional[datetime] = None
    scanned_by_name: Optional[str] = None

# Analytics Schema
class AnalyticsResponse(BaseModel):
    total_users: int
    total_students: int
    total_admins: int
    total_tickets: int
    pending_tickets: int
    approved_tickets: int
    rejected_tickets: int
    scanned_tickets: int
    total_revenue: float
