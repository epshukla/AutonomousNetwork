"""
Persistent agent memory — stores learned patterns in the database.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from nocagent.db.engine import async_session


class AgentMemoryStore:
    async def get(self, key: str) -> Any | None:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT value FROM agent_memory WHERE key = :key"),
                {"key": key},
            )
            row = result.fetchone()
            return row.value if row else None

    async def set(self, key: str, value: Any, memory_type: str = "general"):
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text(
                        "INSERT INTO agent_memory (memory_type, key, value, updated_at) "
                        "VALUES (:type, :key, CAST(:value AS jsonb), NOW()) "
                        "ON CONFLICT (key) DO UPDATE SET "
                        "value = CAST(:value AS jsonb), updated_at = NOW()"
                    ),
                    {"type": memory_type, "key": key, "value": json.dumps(value)},
                )

    async def delete(self, key: str):
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text("DELETE FROM agent_memory WHERE key = :key"),
                    {"key": key},
                )

    async def list_all(self) -> list[dict]:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT memory_type, key, value, updated_at "
                    "FROM agent_memory ORDER BY updated_at DESC"
                )
            )
            return [
                {
                    "type": r.memory_type,
                    "key": r.key,
                    "value": r.value,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                }
                for r in result.fetchall()
            ]


memory_store = AgentMemoryStore()
