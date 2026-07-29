import asyncio
import os
import sys
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import get_settings

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=1 if os.getenv("VERCEL") else 5,
    max_overflow=0 if os.getenv("VERCEL") else 5,
    pool_recycle=300,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
