import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Engine configuration depending on DB type
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {"statement_cache_size": 0, "prepared_statement_cache_size": 0}

engine = create_async_engine(
    settings.DATABASE_URL,
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
                await conn.execute(text("ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(255);"))
                await conn.execute(text("ALTER TABLE otp_requests ALTER COLUMN phone TYPE VARCHAR(255);"))
            except Exception:
                pass

    # Seed Organiser Super Admin account explicitly if none exists
    async with AsyncSessionLocal() as session:
        try:
            from app.models import User, UserRole
            from sqlalchemy import select
            stmt = select(User).where(User.role == UserRole.SUPER_ADMIN)
            result = await session.execute(stmt)
            super_admin = result.scalars().first()
            if not super_admin:
                admin_email = os.getenv("ADMIN_EMAIL", "admin@onamsadhya.org")
                # Check if user with that email already exists
                user_stmt = select(User).where(User.phone == admin_email)
                existing = (await session.execute(user_stmt)).scalars().first()
                if existing:
                    existing.role = UserRole.SUPER_ADMIN
                else:
                    new_super = User(
                        phone=admin_email,
                        name="Onam Sadhya Organiser",
                        roll_no="SUPER-001",
                        role=UserRole.SUPER_ADMIN
                    )
                    session.add(new_super)
                await session.commit()
        except Exception as e:
            print(f"Organiser seed info: {e}")

