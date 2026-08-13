# 🌼 Onam Sadhya QR Ticketing System

A full-stack, single-use QR ticketing system designed for college Onam Sadhya (festive feast) management. Built with **FastAPI**, **SQLAlchemy (Async)**, **SQLite/PostgreSQL**, and **React + Vite + Tailwind CSS**.

![Onam Sadhya Ticketing Banner](https://img.shields.io/badge/Onam-Sadhya%20Ticketing-emerald?style=for-the-badge)

---

## 🌟 Key Features

1. **Phone OTP Auth & Dev Role Switcher:** Quick student/admin/super-admin testing with mock OTPs or phone auth integration.
2. **Payment Proof Upload:** Students submit UPI/cash reference proof images to request Sadhya access.
3. **Admin Verification:** Volunteers review pending payments, approve/reject with notes.
4. **Tamper-Proof Signed QR Codes:** Generates HMAC-SHA256 signed tokens (`base64(ticket_id).HMAC`) preventing QR forgery.
5. **Atomic Single-Use Gate Scanner:** Camera scanner uses atomic DB updates (`UPDATE ... RETURNING`) preventing race conditions and double entry.
6. **Super Admin Suite:** Role management (promote/demote), live analytics dashboard, ticket revocation, and CSV data export.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI (Async), SQLAlchemy (Async), Uvicorn, Pydantic, Pillow, PyJWT, `qrcode`
- **Database:** SQLite (default for local dev) / PostgreSQL (via `asyncpg`)
- **Frontend:** React 18, Vite, Tailwind CSS, `html5-qrcode`, `lucide-react`, `axios`, `canvas-confetti`

---

## 🚀 Quick Start (Local Setup)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend server runs at: `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Frontend app runs at: `http://localhost:5173`.

---

## 🛡️ Roles & Permissions

- **Student:** Register/login via Phone OTP, submit payment proof, view ticket approval status, download signed QR code.
- **Admin:** View pending payments, approve/reject tickets, scan QR codes at venue entrance.
- **Super Admin:** All Admin capabilities + promote/demote users, view live financial/attendance analytics, revoke tickets, export CSV reports.

---

## 📄 License
MIT License. Created for College Onam Celebration Management.
