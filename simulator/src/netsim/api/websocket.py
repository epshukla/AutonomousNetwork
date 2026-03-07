"""
WebSocket endpoints — real-time telemetry and event streams.

Subscribes to Redis channels and forwards messages to connected
WebSocket clients.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
import structlog

from netsim.config.settings import settings
from netsim.events import CHANNEL_TELEMETRY, CHANNEL_EVENTS

logger = structlog.get_logger()
router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for a channel."""

    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


telemetry_manager = ConnectionManager()
events_manager = ConnectionManager()


async def start_ws_relay():
    """Subscribe to Redis and relay to WebSocket clients."""
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe(CHANNEL_TELEMETRY, CHANNEL_EVENTS)

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue
        channel = message["channel"]
        data = json.loads(message["data"])

        if channel == CHANNEL_TELEMETRY:
            await telemetry_manager.broadcast(data)
        elif channel == CHANNEL_EVENTS:
            await events_manager.broadcast(data)


@router.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket):
    await telemetry_manager.connect(ws)
    logger.info("ws_telemetry_connected", clients=len(telemetry_manager.active))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        telemetry_manager.disconnect(ws)
        logger.info("ws_telemetry_disconnected", clients=len(telemetry_manager.active))


@router.websocket("/ws/events")
async def ws_events(ws: WebSocket):
    await events_manager.connect(ws)
    logger.info("ws_events_connected", clients=len(events_manager.active))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        events_manager.disconnect(ws)
        logger.info("ws_events_disconnected", clients=len(events_manager.active))
