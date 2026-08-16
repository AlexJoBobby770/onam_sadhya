import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Live Supabase PostgreSQL pooler URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres.iwgceitpbvcuzvsvyxvt:Alex%2BShalom2005@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres")

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0}
)

async def wipe_data():
    async with engine.begin() as conn:
        print("--> Truncating Supabase PostgreSQL tickets table...")
        await conn.execute(text("TRUNCATE TABLE tickets CASCADE;"))
        print("--> Truncating Supabase PostgreSQL otp_requests table...")
        await conn.execute(text("TRUNCATE TABLE otp_requests CASCADE;"))
        print("--> Clearing test student users...")
        await conn.execute(text("DELETE FROM users WHERE role::text NOT IN ('SUPER_ADMIN');"))
        print("--> SUCCESS: Live Supabase PostgreSQL database wiped cleanly!")

if __name__ == "__main__":
    asyncio.run(wipe_data())
