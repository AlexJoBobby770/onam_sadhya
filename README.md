# Onam Sadhya QR Ticketing System

A full-stack, single-use QR ticketing system designed for college Onam Sadhya (festive feast) management. Built with **FastAPI**, **SQLAlchemy (Async)**, **SQLite/PostgreSQL**, and **React + Vite + Tailwind CSS**.

---

## 🌟 Key Features

1. **Phone OTP Auth & Dev Switcher:** Phone verification workflow with rate-limiting cooldown and optional development mode (`DEV_MODE=false` in production).
2. **Payment Proof Upload:** Students submit UPI/cash reference proof images to request Sadhya access.
3. **Admin Verification:** Committee volunteers review pending payments, approve/reject with notes.
4. **Tamper-Proof Signed QR Codes:** Generates HMAC-SHA256 signed tokens (`base64(ticket_id).HMAC`) preventing QR forgery.
5. **Atomic Single-Use Gate Scanner:** Camera scanner uses atomic DB updates (`UPDATE ... RETURNING`) preventing race conditions and double entry.
6. **Super Admin Suite:** Role management (promote/demote), live analytics dashboard, ticket revocation, and CSV data export.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI (Async), SQLAlchemy (Async), Uvicorn, Pydantic, PyJWT, `qrcode`
- **Database:** SQLite (default for local dev) / PostgreSQL (via `asyncpg`)
- **Frontend:** React 18, Vite, Tailwind CSS, `html5-qrcode`, `lucide-react`, `axios`

---

## 🚀 Deployment & Production Readiness Checklist

### 1. Environment Variables (`backend/.env`)
Set the following environment variables for live event deployment:
```ini
DEV_MODE=false
SECRET_KEY=generate_a_long_random_secret_key_here_for_production
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/onam_db
```

### 2. Run Backend with Production Workers
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 3. Build & Host Frontend (Vercel / Netlify / Static Server)
```bash
cd frontend
npm install
VITE_API_BASE_URL=https://your-backend-api-url.com npm run build
```

---

## 🛡️ Roles & Permissions

- **Student:** Login via Phone OTP, submit payment proof, view ticket approval status, download signed QR code.
- **Admin:** View pending payments, approve/reject tickets, scan QR codes at venue entrance.
- **Super Admin:** All Admin capabilities + promote/demote users, view live financial/attendance analytics, revoke tickets, export CSV reports.

---

## 📄 License
MIT License. Created for College Onam Celebration Management.
