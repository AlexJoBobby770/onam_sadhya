import os
import pytest
import pytest_asyncio
import asyncio
from unittest.mock import patch, MagicMock
from datetime import timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.config import settings, Settings, validate_settings
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

def test_missing_secret_key_fails_loud():
    """
    Verifies that a missing or empty SECRET_KEY fails loud with KeyError.
    """
    s = Settings(SECRET_KEY="", SUPER_ADMIN_OVERRIDE_CODE="valid_override_code", GOOGLE_CLIENT_ID="valid_google_client_id")
    with pytest.raises(KeyError) as exc:
        validate_settings(s)
    assert "SECRET_KEY" in str(exc.value)

def test_missing_super_admin_override_code_fails_loud():
    """
    Verifies that a missing or empty SUPER_ADMIN_OVERRIDE_CODE fails loud with KeyError.
    """
    s = Settings(SECRET_KEY="valid_secret_key", SUPER_ADMIN_OVERRIDE_CODE="", GOOGLE_CLIENT_ID="valid_google_client_id")
    with pytest.raises(KeyError) as exc:
        validate_settings(s)
    assert "SUPER_ADMIN_OVERRIDE_CODE" in str(exc.value)

def test_missing_google_client_id_fails_loud():
    """
    Verifies that a missing or empty GOOGLE_CLIENT_ID fails loud with KeyError.
    """
    s = Settings(SECRET_KEY="valid_secret_key", SUPER_ADMIN_OVERRIDE_CODE="valid_override_code", GOOGLE_CLIENT_ID="")
    with pytest.raises(KeyError) as exc:
        validate_settings(s)
    assert "GOOGLE_CLIENT_ID" in str(exc.value)

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
                "email": "attacker@malayalamuniversity.org",
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
async def test_google_login_creates_user():
    """
    Verifies a first-time Google login creates a User row correctly from verified Google ID token.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        mock_claims = {
            "email": "freshman.google@gmail.com",
            "name": "Freshman Student",
            "sub": "google-user-id-999"
        }
        with patch("app.routers.auth._verify_google_credential", return_value=mock_claims):
            res = await client.post("/auth/google", json={"credential": "mock_google_id_token_xyz"})
            assert res.status_code == 200
            data = res.json()
            assert "access_token" in data
            assert data["user"]["email"] == "freshman.google@gmail.com"
            assert data["user"]["name"] == "Freshman Student"
            assert data["user"]["role"] == "student"

@pytest.mark.asyncio
async def test_profile_completion_required():
    """
    Verifies a user without roll_no set is blocked from submitting a ticket until profile is completed.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        mock_claims = {
            "email": "incomplete.profile@gmail.com",
            "name": "Incomplete Student",
            "sub": "google-user-id-888"
        }
        with patch("app.routers.auth._verify_google_credential", return_value=mock_claims):
            res = await client.post("/auth/google", json={"credential": "mock_token_123"})
            token = res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

        # Attempt to submit ticket without setting roll_no -> Expect 400
        sub_res = await client.post("/tickets", data={"note": "Paid via UPI"}, headers=headers)
        assert sub_res.status_code == 400
        assert "Profile incomplete" in sub_res.json()["detail"]

        # Complete profile via /student/profile
        prof_res = await client.post("/student/profile", json={"roll_no": "CS-2026-A"}, headers=headers)
        assert prof_res.status_code == 200
        assert prof_res.json()["roll_no"] == "CS-2026-A"

        # Retry submitting ticket -> Expect 200 success
        sub_res_2 = await client.post("/tickets", data={"note": "Paid via UPI"}, headers=headers)
        assert sub_res_2.status_code == 200

@pytest.mark.asyncio
async def test_override_code_rate_limited():
    """
    Verifies the admin override endpoint locks out after 5 repeated failed attempts in DB.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Send 5 incorrect override attempts
        for i in range(5):
            res = await client.post("/auth/admin-override", json={"override_code": "wrong_code_guess"})
            assert res.status_code == 401

        # 6th attempt -> Expect 429 Too Many Requests lockout
        lockout_res = await client.post("/auth/admin-override", json={"override_code": "wrong_code_guess"})
        assert lockout_res.status_code == 429
        assert "Lockout in effect" in lockout_res.json()["detail"]

def test_override_code_not_in_source():
    """
    Asserts that no 6-digit backdoor literal "777777" appears anywhere in the app source code directory.
    """
    app_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app")
    found_literals = []
    for root, _, files in os.walk(app_dir):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "777777" in content:
                        found_literals.append(filepath)
    assert len(found_literals) == 0, f"Found hardcoded backdoor 777777 in files: {found_literals}"

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
                "email": "admin@malayalamuniversity.org",
                "name": "Organiser Admin",
                "role": "super_admin"
            })
            admin_token = admin_res.json()["access_token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}

            # Student login with roll_no
            student_res = await client.post("/auth/dev-login", json={
                "email": "rahul.nair@malayalamuniversity.org",
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
                "email": "admin@malayalamuniversity.org",
                "name": "Super Admin",
                "role": "super_admin"
            })
            assert res.status_code == 200
            admin_token = res.json()["access_token"]
            admin_headers = {"Authorization": f"Bearer {admin_token}"}

            # 2. Dev Login as Student with roll_no
            res = await client.post("/auth/dev-login", json={
                "email": "rahul.nair@malayalamuniversity.org",
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
