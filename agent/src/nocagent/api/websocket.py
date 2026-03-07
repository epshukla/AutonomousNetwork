"""Agent WebSocket — streams agent events to connected dashboards."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
import structlog

from nocagent.config.settings import settings
from nocagent.events import CHANNEL_AGENT

logger = structlog.get_logger()
router = APIRouter()


class AgentWSManager:
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


agent_ws_manager = AgentWSManager()


async def start_agent_ws_relay():
    redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe(CHANNEL_AGENT)

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue
        data = json.loads(message["data"])
        await agent_ws_manager.broadcast(data)


@router.websocket("/ws/agent-events")
async def ws_agent_events(ws: WebSocket):
    await agent_ws_manager.connect(ws)
    logger.info("ws_agent_connected", clients=len(agent_ws_manager.active))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        agent_ws_manager.disconnect(ws)
        logger.info("ws_agent_disconnected", clients=len(agent_ws_manager.active))
