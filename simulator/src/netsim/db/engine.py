from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
import structlog

from netsim.config.settings import settings

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
    from netsim.models.base import Base

    async with engine.begin() as conn:
        # Create TimescaleDB extension
        await conn.execute(
            __import__("sqlalchemy").text(
                "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE"
            )
        )
        await conn.run_sync(Base.metadata.create_all)

        # Convert to hypertables (idempotent with if_not_exists)
        for table in ["device_metrics", "link_metrics", "bgp_metrics"]:
            try:
                await conn.execute(
                    __import__("sqlalchemy").text(
                        f"SELECT create_hypertable('{table}', 'time', "
                        f"if_not_exists => TRUE)"
                    )
                )
            except Exception as e:
                logger.warning("hypertable_creation_skipped", table=table, error=str(e))

    logger.info("database_initialized")


async def close_db():
    await engine.dispose()
    logger.info("database_closed")
