"""Agent EventBus — publishes agent events to Redis for dashboard consumption."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis
import structlog

from nocagent.config.settings import settings

logger = structlog.get_logger()

CHANNEL_AGENT = "nocagent:events"


class AgentEventBus:
    def __init__(self):
        self._redis: aioredis.Redis | None = None

    async def connect(self):
        self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        await self._redis.ping()
        logger.info("agent_eventbus_connected")

    async def disconnect(self):
        if self._redis:
            await self._redis.close()

    async def publish(self, event_type: str, data: dict[str, Any]):
        if not self._redis:
            return
        payload = {
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
        }
        await self._redis.publish(
            CHANNEL_AGENT, json.dumps(payload, default=str)
        )

    async def get_redis(self) -> aioredis.Redis:
        return self._redis


agent_event_bus = AgentEventBus()
