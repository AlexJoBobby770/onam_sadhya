# Onam Sadhya Ticketing System — Production Architecture

A zero-spend ($0 cost), high-concurrency QR ticketing and gate entry management platform built with FastAPI, PostgreSQL (Supabase Free Tier), and React.

---

## 🏛️ System Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                     Student Web Frontend                     │
 │          (Vercel / Netlify Free Tier - Free HTTPS)           │
 └──────────────┬──────────────────────────────┬───────────────┘
                │                              │
        HTTPS (REST API)               HTML5 Canvas Client-Side
                │                      Image Compression (WebP/JPEG)
                ▼                              │
 ┌──────────────────────────────┐              ▼
 │        FastAPI Backend        │──────► ┌──────────────────────────────┐
 │     (Render Free Tier)       │        │    Supabase Storage Bucket   │
 │   Warmed via Uptime Pinger   │        │     (1GB Free Tier Limit)    │
 └──────────────┬───────────────┘        └──────────────────────────────┘
                │
   Pooled Port 6543 (pgbouncer)
                │
                ▼
 ┌──────────────────────────────┐
 │   Supabase Postgres DB       │
 │   (Free Tier Database)       │
 └──────────────────────────────┘
```

---

## 🔑 Key Architectural Design Principles

### 1. Zero-Cost Email OTP Authentication
- **No Paid SMS or Firebase Blaze Cards**: Replaces Firebase Phone Auth (which mandates credit card attachment) with transactional **Email OTP**.
- **Universal Email Access**: Accepts any valid student email address (allowing first-year students without college emails to register). Verification OTP proves email ownership.
- **Roll Number Capture**: Captures required `roll_no` alongside full name on signup.


### 2. Micro-Storage & Free Tier Hardening
- **Client-Side Image Compression**: Compresses receipt images on the client using native HTML5 Canvas before uploading, keeping file sizes under 500KB.
- **5MB Stream Cap & MIME Validation**: FastApi backend enforces a strict 5MB upload size limit and rejects non-`image/*` MIME types, streaming bytes directly to Supabase Storage free tier (1GB free storage).
- **QR Base64 Payload Optimization**: `build_ticket_response()` uses `with_qr: bool = False` by default. QR image base64 data is rendered **only** on `/tickets/me` for the ticket owner, keeping admin list responses lightweight and fast.

### 3. Atomic Single-Use Gate Entry
- **HMAC-SHA256 Token Signatures**: QR tokens are signed via HMAC-SHA256 (`base64(ticket_id).HMAC`).
- **Atomic SQL Updates**: Entrance scanning executes atomic SQL:
  ```sql
  UPDATE tickets
  SET used = true, scanned_at = NOW(), scanned_by = :admin_id
  WHERE id = :ticket_id AND used = false AND status = 'approved';
  ```
  If `rowcount == 0`, the scanner immediately identifies if the pass was already used or unapproved, preventing race conditions and double entries.
- **Timezone Accuracy**: Scanned timestamps are rendered in `Asia/Kolkata` IST timezone.

### 4. Offline Fallback Gate Scanner
- **`localStorage` Pass Cache**: Gatekeepers load approved ticket passes into local browser storage on page load.
- **Offline Entry & Sync Queue**: Gatekeepers can validate signed passes offline. Gate entries taken offline are queued in `onam_queued_scans` and automatically synced to the server once connection is restored.
- **Manual Dead-Phone Entry**: Admins can search students by name, email, or roll number and trigger an atomic "Mark as entered" update directly from the gate scanner page.

---

## ⚡ Cold-Start Prevention (Render Free Tier)

Render's free tier spins down backends after 15 minutes of inactivity, causing a ~50-second cold start delay.

To keep the instance warm during ticket sales week and on event day (August 21):
1. **Lightweight Health Endpoint**: `GET /health` returns `{ "status": "healthy" }` without database overhead.
2. **External Uptime Pinger**: Set up a free account on [UptimeRobot](https://uptimerobot.com/) or a GitHub Actions scheduled cron workflow to curl `https://your-render-app.onrender.com/health` every **10 minutes**.

---

## 📜 Database Seeding & Security

- **`DEV_MODE=false`**: Disables `/auth/dev-login` endpoints in production environments.
- **Organiser Account Seeding**: Super Admin organiser account is seeded explicitly in `init_db()`, removing reliance on first-user-wins assignment rules.
- **CORS Hardening**: Restricts origin requests strictly to the configured `FRONTEND_URL` since `allow_credentials=True` invalidates wildcard `*` origins.
