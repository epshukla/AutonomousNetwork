from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
import structlog

from nocagent.config.settings import settings

logger = structlog.get_logger()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

async_session = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session


async def init_db():
    from nocagent.models.base import Base
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Add category column to existing decisions table (idempotent)
        await conn.execute(text(
            "ALTER TABLE decisions ADD COLUMN IF NOT EXISTS "
            "category TEXT DEFAULT 'software'"
        ))

    logger.info("agent_database_initialized")


async def close_db():
    await engine.dispose()
    logger.info("agent_database_closed")
