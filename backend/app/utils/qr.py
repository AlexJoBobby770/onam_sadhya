import base64
import hmac
import hashlib
import io
from typing import Optional, Tuple
import qrcode
from app.config import settings

def generate_qr_token(ticket_id: str) -> str:
    """
    Encodes ticket_id as Base64 and signs it with HMAC-SHA256 using server SECRET_KEY.
    Format: base64(ticket_id) + "." + HMAC_SHA256(secret_key, ticket_id)
    """
    b64_id = base64.urlsafe_b64encode(ticket_id.encode()).decode().rstrip("=")
    signature = hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        ticket_id.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return f"{b64_id}.{signature}"

def verify_and_extract_ticket_id(qr_token: str) -> Tuple[bool, Optional[str]]:
    """
    Verifies the HMAC signature of a QR token and extracts the ticket_id.
    """
    if not qr_token or "." not in qr_token:
        return False, None

    try:
        parts = qr_token.split(".")
        if len(parts) != 2:
            return False, None

        b64_id, signature = parts[0], parts[1]
        
        # Add back Base64 padding
        padded_b64 = b64_id + "=" * (-len(b64_id) % 4)
        ticket_id = base64.urlsafe_b64decode(padded_b64.encode('utf-8')).decode('utf-8')

        # Recompute HMAC
        expected_sig = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            ticket_id.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        if hmac.compare_digest(signature, expected_sig):
            return True, ticket_id
        return False, None
    except Exception:
        return False, None

def generate_qr_code_base64(qr_token: str) -> str:
    """
    Generates a PNG QR code image encoded in Base64 data URL format.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=3,
    )
    qr.add_data(qr_token)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#064E3B", back_color="#FFFFFF")  # Onam Emerald color
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f"data:image/png;base64,{b64_str}"
