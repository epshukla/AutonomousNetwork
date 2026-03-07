"""
FastAPI application factory for the AI NOC Agent.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import logging

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from nocagent.config.settings import settings

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
        logger.info("agent_starting", port=settings.agent_port)

        # Initialize database
        from nocagent.db.engine import init_db, close_db

        await init_db()

        # Connect event bus
        from nocagent.events import agent_event_bus

        await agent_event_bus.connect()

        # Start WebSocket relay
        from nocagent.api.websocket import start_agent_ws_relay

        ws_task = asyncio.create_task(start_agent_ws_relay())

        # Start agent loop
        from nocagent.core.agent_loop import noc_agent

        await noc_agent.start()

        logger.info("agent_ready")

        yield

        # Shutdown
        logger.info("agent_shutting_down")
        await noc_agent.stop()
        ws_task.cancel()

        from nocagent.tools.handlers import close_http_client

        await close_http_client()
        await agent_event_bus.disconnect()
        await close_db()

    app = FastAPI(
        title="NOC Agent — AI Network Engineer",
        description="Autonomous AI agent for network operations",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from nocagent.api.agent_control import router as agent_router
    from nocagent.api.incidents import router as incidents_router
    from nocagent.api.decisions import router as decisions_router
    from nocagent.api.websocket import router as ws_router

    app.include_router(agent_router)
    app.include_router(incidents_router)
    app.include_router(decisions_router)
    app.include_router(ws_router)

    @app.get("/health")
    async def health():
        from nocagent.core.agent_loop import noc_agent

        return {
            "status": "healthy",
            "service": "agent",
            "agent_running": noc_agent._running,
            "agent_mode": noc_agent._mode,
        }

    @app.get("/metrics")
    async def metrics():
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        from fastapi.responses import Response

        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST,
        )

    return app
