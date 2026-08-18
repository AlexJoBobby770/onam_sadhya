# Onam Sadhya Single-Use QR Ticketing System

A zero-spend ($0 cost), high-concurrency QR ticketing and gate entry management platform designed for college Onam Sadhya festive feast management. Built with **FastAPI**, **SQLAlchemy (Async)**, **PostgreSQL (Supabase Free Tier)**, and **React + Vite + Tailwind CSS**.

---

## 🌟 Key Features & Zero-Spend Architecture

1. **Google-Only OAuth Authentication**: Google Sign-In popup via Google Identity Services (GSI) with server-side ID token verification (`POST /auth/google`), eliminating SMS/Email OTP quotas and firebase costs ($0 spend).
2. **Hardened Storage & Client Compression**: Payment receipt screenshots are compressed client-side via native HTML5 Canvas (<500KB per image). FastAPI backend enforces a strict 5MB upload cap and streams directly to Supabase Free Tier Storage (1GB limit).
3. **Mandatory Profile Completion**: On first login, students complete their profile with Class / Roll Number before ticket submission can occur.
4. **Admin Dashboard Power Suite**: Features multi-select checkboxes with bulk approvals (`POST /admin/tickets/bulk-approve`), pagination capped at 50/page, and instant search filtering by student name, email, or roll number.
5. **Tamper-Proof Signed QR Codes**: HMAC-SHA256 token signatures (`base64(ticket_id).HMAC`) prevent QR forgery. API responses optimize bandwidth by gating QR images (`with_qr=False` default) exclusively to `/tickets/me`.
6. **Atomic Single-Use Gate Scanner**: Camera scanner executes atomic database updates (`UPDATE tickets SET used=true WHERE used=false AND status='approved'`), permanently preventing race conditions, duplicate entries, or reused screenshots across any number of server workers.
7. **Multi-Worker DB-Backed Admin Override**: Organiser emergency security key (`POST /auth/admin-override`) protected by constant-time signature comparison (`secrets.compare_digest`), DB-backed rate limiting (max 5 failed attempts per hour per IP stored in `override_attempts`), and persistent server audit logging.
8. **Offline Gatekeeper Fallback**: Scanner caches approved tickets in `localStorage`, performs offline HMAC signature validation, queues entrance logs, and auto-syncs when internet connection restores.
9. **Dead-Phone Manual Entry**: Admins can search students by name, email, or roll number and trigger an atomic "Mark as entered" update directly from the scanner interface.
10. **Asia/Kolkata IST Timezones**: Gate scan timestamps and audit logs are formatted accurately in Indian Standard Time (IST).

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI (Async), SQLAlchemy (Async), Uvicorn, Pydantic, PyJWT, `qrcode`, `httpx`
- **Database:** Supabase PostgreSQL (Pooled IPv4 connection on port 6543 via `pgbouncer`)
- **Storage:** Supabase Storage Free Tier (1GB free limit)
- **Frontend:** React 18, Vite, Tailwind CSS, Google Identity Services (GSI), `html5-qrcode`, `lucide-react`, `axios`
- **Hosting:** Render Free Tier (Backend) + Vercel / Netlify Free Tier (Frontend with HTTPS)

---

## 🚀 Local Development Setup

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```
- **API Documentation:** `http://localhost:8000/docs`
- **Health Check Endpoint:** `http://localhost:8000/health`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
- **Web App UI:** `http://localhost:5173`

### 3. Run Automated Tests
```bash
cd backend
python -m pytest tests/test_api.py -v
```

---

## 🚀 Pre-Deployment & Production Readiness Checklist

### 1. Backend Environment Variables (`backend/.env`)
Set the following environment variables for production:
```ini
DEV_MODE=false
SECRET_KEY=your_long_random_secret_key_here
SUPER_ADMIN_OVERRIDE_CODE=your_long_random_override_secret_here
DATABASE_URL=postgresql+asyncpg://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
FRONTEND_URL=https://your-app.vercel.app

# Seeded Organiser Super Admin Account
ADMIN_EMAIL=admin@onamsadhya.org

# Optional Supabase Storage Settings
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your_supabase_anon_or_service_key
SUPABASE_BUCKET=payment-proofs
```

### How to Set / Rotate `SUPER_ADMIN_OVERRIDE_CODE`
To generate a secure override code for production:
```bash
python -c "import secrets; print(secrets.token_urlsafe(24))"
```
Place this string in your server's `.env` environment variables as `SUPER_ADMIN_OVERRIDE_CODE`. Never commit real override codes to git.

### 2. Backend Hosting (Render Free Tier)
Deploy the `backend` directory on Render's free web service tier:
```bash
# Build Command
pip install -r requirements.txt

# Start Command
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 3. Backend Uptime Pinger Setup (Keep Instance Warm)
To avoid Render's ~50s free-tier cold-start delay during sales week and on event day (August 21):
- Register a free account on [UptimeRobot](https://uptimerobot.com/).
- Create an HTTP monitor pinging `https://your-backend-api.onrender.com/health` every **10 minutes**.

### 4. Frontend Deployment (Vercel / Netlify Free Tier)
Camera QR scanning requires free HTTPS provided by Vercel/Netlify by default:
```bash
cd frontend
npm install
VITE_API_BASE_URL=https://your-backend-api.onrender.com npm run build
```

---

## 🛡️ Roles & Permissions

- **Student:** Signup via Email OTP, enter roll number, submit payment proof (with client-side compression), view approval status, download signed QR pass.
- **Admin:** Multi-select bulk approve, search/filter student requests (50 per page cap), scan QR passes at gate, manual entry for dead phones.
- **Super Admin:** All Admin capabilities + promote/demote user roles, view live financial/attendance analytics, revoke tickets, export CSV reports.

---

## 📄 License
MIT License. Created for College Onam Celebration Management.
