"""
EventBus — Redis-backed pub/sub for real-time event distribution.

Follows the Chronos pattern: publish events to Redis channels,
WebSocket handlers subscribe and forward to connected clients.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine

import redis.asyncio as aioredis
import structlog

from netsim.config.settings import settings

logger = structlog.get_logger()

# Channel names
CHANNEL_TELEMETRY = "netsim:telemetry"
CHANNEL_EVENTS = "netsim:events"
CHANNEL_CHAOS = "netsim:chaos"


class EventBus:
    """Redis pub/sub event bus for distributing real-time events."""

    def __init__(self):
        self._redis: aioredis.Redis | None = None
        self._pubsub: aioredis.client.PubSub | None = None
        self._handlers: dict[str, list[Callable]] = {}

    async def connect(self):
        self._redis = aioredis.from_url(
            settings.redis_url, decode_responses=True
        )
        await self._redis.ping()
        logger.info("eventbus_connected", redis_url=settings.redis_url)

    async def disconnect(self):
        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()
        logger.info("eventbus_disconnected")

    async def publish(self, channel: str, data: dict[str, Any]):
        if not self._redis:
            return
        payload = json.dumps(data, default=_json_serializer)
        await self._redis.publish(channel, payload)

    async def subscribe(
        self, channel: str, handler: Callable[[dict], Coroutine]
    ):
        if not self._redis:
            return
        if channel not in self._handlers:
            self._handlers[channel] = []
        self._handlers[channel].append(handler)

    async def start_listening(self):
        if not self._redis or not self._handlers:
            return
        self._pubsub = self._redis.pubsub()
        await self._pubsub.subscribe(*self._handlers.keys())

        async for message in self._pubsub.listen():
            if message["type"] != "message":
                continue
            channel = message["channel"]
            data = json.loads(message["data"])
            for handler in self._handlers.get(channel, []):
                try:
                    await handler(data)
                except Exception:
                    logger.exception("eventbus_handler_error", channel=channel)

    async def get_redis(self) -> aioredis.Redis:
        return self._redis


def _json_serializer(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


# Singleton
event_bus = EventBus()
