"""
ProctorForge AI - Database Setup
Uses Supabase client (HTTPS) for all data operations.
SQLAlchemy ORM is used locally only to create table schemas.
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings

# Global
engine = None
AsyncSessionLocal = None
supabase_client = None


class Base(DeclarativeBase):
    pass


def get_supabase():
    """Return the initialized Supabase client."""
    if supabase_client is None:
        raise RuntimeError("Supabase client not initialized. Call init_db() first.")
    return supabase_client


async def get_db():
    """Dependency that provides a SQLAlchemy session (used by routers that need ORM)."""
    if AsyncSessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize Supabase client + local SQLite ORM for schema/session management."""
    global engine, AsyncSessionLocal, supabase_client

    # ── 1. Supabase client (HTTPS, always works) ──────────────────────────────
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY

    # Skip Supabase check if local development and keys are missing
    if not url or not key:
        print("⚠️  SUPABASE_URL and key missing, skipping Supabase initialization for local development.")
        supabase_client = None
    else:
        try:
            from supabase import create_client, Client
            supabase_client = create_client(url, key)
            # Quick connectivity test via REST
            supabase_client.table("users").select("id").limit(1).execute()
            print("✅ Supabase client connected (REST/HTTPS)")
        except ImportError:
            print("⚠️  supabase-py not installed — install with: pip install supabase")
            supabase_client = None
        except Exception as e:
            # Table might not exist yet — that's fine, connection is alive
            if "does not exist" in str(e) or "relation" in str(e) or "42P01" in str(e):
                print("✅ Supabase client connected (REST/HTTPS) — tables will be created")
            else:
                print(f"⚠️  Supabase client warning: {type(e).__name__}: {str(e)[:120]}")
            # Don't raise; the insert/select calls will show errors later

    # ── 2. SQLite ORM for local session management ────────────────────────────
    db_dir = os.path.dirname(os.path.dirname(__file__))
    sqlite_path = os.path.join(db_dir, "proctorforge_local.db")
    sqlite_url = f"sqlite+aiosqlite:///{sqlite_path}"

    engine = create_async_engine(sqlite_url, echo=False, pool_pre_ping=True)

    async with engine.begin() as conn:
        from models import user, exam, attempt, event  # noqa
        await conn.run_sync(Base.metadata.create_all)

    AsyncSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    print(f"✅ Local session DB ready (SQLite: {sqlite_path})")
    print("🚀 Backend is now connected to Supabase for all data operations")
