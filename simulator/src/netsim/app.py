"""
FastAPI application factory for the Network Simulator.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import logging

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from netsim.config.settings import settings

LOG_LEVELS = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


def configure_logging():
    log_level = LOG_LEVELS.get(settings.log_level.upper(), logging.INFO)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if settings.log_level == "DEBUG"
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def create_app() -> FastAPI:
    configure_logging()
    logger = structlog.get_logger()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info("simulator_starting", port=settings.simulator_port)

        # Initialize database
        from netsim.db.engine import init_db, close_db

        await init_db()

        # Initialize network state
        from netsim.core.network_state import network_state

        await network_state.initialize()

        # Connect event bus
        from netsim.events import event_bus

        await event_bus.connect()

        # Start telemetry engine
        from netsim.core.telemetry_engine import telemetry_engine

        await telemetry_engine.start()

        # Start WebSocket relay
        from netsim.api.websocket import start_ws_relay

        ws_task = asyncio.create_task(start_ws_relay())

        logger.info("simulator_ready")

        yield

        # Shutdown
        logger.info("simulator_shutting_down")
        from netsim.chaos.engine import chaos_engine

        await chaos_engine.stop_all()
        await telemetry_engine.stop()
        ws_task.cancel()
        await event_bus.disconnect()
        await close_db()

    app = FastAPI(
        title="NetSim — Network Simulator",
        description="ISP Network Simulator with Chaos Engine",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    from netsim.api.topology import router as topology_router
    from netsim.api.telemetry import router as telemetry_router
    from netsim.api.actions import router as actions_router
    from netsim.api.chaos import router as chaos_router
    from netsim.api.websocket import router as ws_router
    from netsim.api.interfaces import router as interfaces_router
    from netsim.metrics import router as metrics_router

    app.include_router(topology_router)
    app.include_router(telemetry_router)
    app.include_router(actions_router)
    app.include_router(chaos_router)
    app.include_router(ws_router)
    app.include_router(interfaces_router)
    app.include_router(metrics_router)

    @app.get("/health")
    async def health():
        from netsim.core.network_state import network_state

        return {
            "status": "healthy",
            "service": "simulator",
            "devices": len(network_state.devices),
            "links": len(network_state.links),
        }

    return app
