import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

db_url = settings.DATABASE_URL.strip().strip("'\"").strip()
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

is_sqlite = db_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {"statement_cache_size": 0, "prepared_statement_cache_size": 0}

engine = create_async_engine(
    db_url,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if not is_sqlite:
            from sqlalchemy import text
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);"))
                await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);"))
                await conn.execute(text("ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;"))
            except Exception as e:
                print(f"PostgreSQL DDL Migration note: {e}")

    # Seed Organiser Super Admin accounts explicitly
    async with AsyncSessionLocal() as session:
        try:
            from app.models import User, UserRole
            from sqlalchemy import select
            admin_emails_raw = os.getenv("ADMIN_EMAIL", "admin@onamsadhya.org")
            admin_emails = [e.strip().lower() for e in admin_emails_raw.split(",") if e.strip()]
            for a_email in admin_emails:
                user_stmt = select(User).where(User.email == a_email)
                existing = (await session.execute(user_stmt)).scalars().first()
                if existing:
                    if existing.role != UserRole.SUPER_ADMIN:
                        existing.role = UserRole.SUPER_ADMIN
                else:
                    new_super = User(
                        email=a_email,
                        name="Onam Sadhya Organiser",
                        roll_no="SUPER-001",
                        role=UserRole.SUPER_ADMIN
                    )
                    session.add(new_super)
            await session.commit()
        except Exception as e:
            print(f"Organiser seed info: {e}")

