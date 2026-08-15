import pytest
import pytest_asyncio
import asyncio
from datetime import timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.config import settings
from app.database import Base, get_db
from app.utils.qr import generate_qr_token, verify_and_extract_ticket_id
from app.utils.security import create_access_token

# Use an in-memory SQLite database for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

TestAsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def override_get_db():
    async with TestAsyncSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

def test_qr_hmac_signing():
    ticket_id = "test-ticket-uuid-12345"
    qr_token = generate_qr_token(ticket_id)

    assert "." in qr_token
    valid, extracted_id = verify_and_extract_ticket_id(qr_token)
    assert valid is True
    assert extracted_id == ticket_id

    # Test tampered signature
    tampered_token = qr_token[:-4] + "ffff"
    valid_tampered, _ = verify_and_extract_ticket_id(tampered_token)
    assert valid_tampered is False

@pytest.mark.asyncio
async def test_dev_login_gating():
    """
    Verifies that /auth/dev-login strictly returns 403 when DEV_MODE is False.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        original_dev_mode = settings.DEV_MODE
        try:
            settings.DEV_MODE = False
            res = await client.post("/auth/dev-login", json={
                "phone": "attacker@malayalamuniversity.org",
                "name": "Attacker",
                "role": "super_admin"
            })
            assert res.status_code == 403
            assert "disabled in production" in res.json()["detail"]
        finally:
            settings.DEV_MODE = original_dev_mode

@pytest.mark.asyncio
async def test_jwt_expiry_rejection():
    """
    Verifies that expired JWT tokens return 401 Unauthorized.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        expired_token = create_access_token(
            data={"sub": "dummy-id", "role": "student"},
            expires_delta=timedelta(hours=-1)
        )
        res = await client.get("/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_email_otp_syntax_validation():
    """
    Verifies Email OTP registration accepts any syntactically valid email address and rejects malformed email strings.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Malformed email attempt -> expect 400
        res = await client.post("/auth/send-otp", json={"phone": "invalidemailstring"})
        assert res.status_code == 400
        assert "valid email address" in res.json()["detail"]

        # Valid general email (e.g. personal Gmail for first-years) -> expect 200
        res1 = await client.post("/auth/send-otp", json={"phone": "freshman1@gmail.com"})
        assert res1.status_code == 200

        # Valid college email -> expect 200
        res2 = await client.post("/auth/send-otp", json={"phone": "student2@malayalamuniversity.org"})
        assert res2.status_code == 200


@pytest.mark.asyncio
async def test_with_qr_gating_and_admin_endpoints():
    """
    Verifies with_qr=False on admin list endpoints and with_qr=True on /tickets/me.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        original_dev_mode = settings.DEV_MODE
        try:
            settings.DEV_MODE = True
            # Super Admin login
            admin_res = await client.post("/auth/dev-login", json={
                "phone": "admin@malayalamuniversity.org",
                "name": "Organiser Admin",
                "role": "super_admin"
            })
            admin_token = admin_res.json()["access_token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}

            # Student login
            student_res = await client.post("/auth/dev-login", json={
                "phone": "rahul.nair@malayalamuniversity.org",
                "name": "Rahul Nair",
                "roll_no": "CS2026",
                "role": "student"
            })
            student_token = student_res.json()["access_token"]
            student_headers = {"Authorization": f"Bearer {student_token}"}

            # Submit ticket
            sub_res = await client.post("/tickets", data={"note": "Paid via GPay"}, headers=student_headers)
            ticket_id = sub_res.json()["id"]

            # Approve ticket
            await client.post(f"/admin/tickets/{ticket_id}/approve", headers=admin_headers)

            # Admin tickets list -> qr_code_base64 MUST be None (with_qr=False)
            admin_tickets_res = await client.get("/admin/tickets", headers=admin_headers)
            approved_t = admin_tickets_res.json()[0]
            assert approved_t["qr_code_base64"] is None
            assert approved_t["qr_token"] is None

            # Student /tickets/me -> qr_code_base64 MUST be present (with_qr=True)
            my_ticket_res = await client.get("/tickets/me", headers=student_headers)
            my_t = my_ticket_res.json()
            assert my_t["qr_code_base64"] is not None
            assert my_t["qr_token"] is not None

        finally:
            settings.DEV_MODE = original_dev_mode

@pytest.mark.asyncio
async def test_full_sadhya_workflow_and_concurrent_scan():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        original_dev_mode = settings.DEV_MODE
        try:
            settings.DEV_MODE = True
            # 1. Dev Login as Super Admin
            res = await client.post("/auth/dev-login", json={
                "phone": "admin@malayalamuniversity.org",
                "name": "Super Admin",
                "role": "super_admin"
            })
            assert res.status_code == 200
            admin_token = res.json()["access_token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}

            # 2. Dev Login as Student
            res = await client.post("/auth/dev-login", json={
                "phone": "rahul.nair@malayalamuniversity.org",
                "name": "Rahul Nair",
                "roll_no": "CS2026",
                "role": "student"
            })
            assert res.status_code == 200
            student_token = res.json()["access_token"]
            student_headers = {"Authorization": f"Bearer {student_token}"}

            # 3. Student submits payment proof
            res = await client.post("/tickets", data={"note": "Paid via GPay to Arjun"}, headers=student_headers)
            assert res.status_code == 200
            ticket_data = res.json()
            ticket_id = ticket_data["id"]

            # 4. Admin bulk approves ticket
            res = await client.post("/admin/tickets/bulk-approve", json={"ticket_ids": [ticket_id]}, headers=admin_headers)
            assert res.status_code == 200

            # Fetch ticket from /tickets/me to get signed qr_token
            res_me = await client.get("/tickets/me", headers=student_headers)
            qr_token = res_me.json()["qr_token"]
            assert qr_token is not None

            # 5. Concurrent Scan Test: Send 2 near-simultaneous scans for the same QR token
            async def scan_call():
                return await client.post("/admin/scan", json={"qr_token": qr_token}, headers=admin_headers)

            res1, res2 = await asyncio.gather(scan_call(), scan_call())
            
            statuses = [res1.json()["status"], res2.json()["status"]]
            assert "GRANTED" in statuses
            assert "ALREADY_USED" in statuses

            # 6. Manual Entry endpoint test for second attempt
            manual_res = await client.post("/admin/scan-manual", json={"ticket_id": ticket_id}, headers=admin_headers)
            assert manual_res.json()["status"] == "ALREADY_USED"

            # 7. Check Super Admin Analytics
            res = await client.get("/admin/analytics", headers=admin_headers)
            assert res.status_code == 200
            analytics = res.json()
            assert analytics["approved_tickets"] == 1
            assert analytics["scanned_tickets"] == 1
        finally:
            settings.DEV_MODE = original_dev_mode
