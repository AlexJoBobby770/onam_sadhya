# Onam Sadhya QR Ticketing — working notes

## What this is

Single-event QR ticketing system for a college Onam Sadhya (feast). ~1,000 students,
Rs 250/ticket paid manually via UPI outside the app, admin verifies payment proof by eye
and approves, approved tickets get an HMAC-signed single-use QR code checked at the gate.
Event date: 21 Aug 2026. There is no payment gateway and none is planned.

Auth is email OTP (any personal email, e.g. Gmail — not a college-issued domain, there's
no institutional email system involved). Backend: FastAPI + SQLAlchemy async + Postgres
(Supabase). Frontend: React + Vite + Tailwind.

## How to work in this repo

**Before fixing anything, explain it first.** State what the bug actually is, give a
concrete example of the input/scenario that triggers it, and describe the fix in plain
terms — before touching code. Skip this only for typos/one-line trivial changes.

**Optimize for least code that stays readable.** Prefer the smallest diff that correctly
fixes the problem over a more "thorough" rewrite. Don't refactor surrounding code while
fixing an unrelated bug.

**Comments: minimal, and never self-congratulatory.** Only comment on genuinely non-obvious
"why" (a workaround, a subtle invariant). Never write comments like "this is now bulletproof",
"fixed!", "robust solution", or similar confidence claims — describe what's true, not how
good the fix is. Most changes need zero comments.

**Branching:** fixes go on a working branch (currently `fix/pre-launch-audit`), get tested,
then get merged/pushed to `main` only after confirmation — not committed straight to main.

**Testing:** run `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q` after backend
changes. All tests must pass before considering a fix done.

## Known constraints worth remembering

- Free-tier Supabase: 1GB storage, project auto-pauses after ~1 week idle. Client-side image
  compression already in place to stay under quota.
- Render free tier (if used) sleeps after 15 min idle; `/health` endpoint exists for uptime
  pinging.
- No budget for Firebase Phone Auth (needs a Blaze billing card) — that's why auth is
  self-hosted email OTP via SMTP instead of SMS.
- `ADMIN_EMAIL` env var seeds the initial super admin on first `init_db()` run — must be a
  real, checked mailbox or the organiser locks themselves out (login is email-OTP only).
