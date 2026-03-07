"""
Chaos Engine — controls lifecycle of chaos scenarios.

Handles starting/stopping scenarios, tracking active runs,
and persisting run history to the database.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import text

from netsim.chaos.effects import EFFECT_HANDLERS
from netsim.chaos.scenarios import SCENARIOS, ScenarioDefinition
from netsim.db.engine import async_session
from netsim.events import event_bus, CHANNEL_CHAOS
from netsim.models.enums import ChaosScenarioName

logger = structlog.get_logger()


class ActiveScenario:
    def __init__(
        self,
        scenario: ScenarioDefinition,
        params: dict[str, Any],
        db_id: int,
    ):
        self.scenario = scenario
        self.params = params
        self.db_id = db_id
        self.stop_event = asyncio.Event()
        self.task: asyncio.Task | None = None
        self.started_at = datetime.now(timezone.utc)


class ChaosEngine:
    """Manages chaos scenario lifecycle."""

    def __init__(self):
        self._active: dict[str, ActiveScenario] = {}

    def list_scenarios(self) -> list[dict]:
        result = []
        for scenario in SCENARIOS.values():
            result.append({
                "name": scenario.name.value,
                "display_name": scenario.display_name,
                "description": scenario.description,
                "severity": scenario.severity,
                "default_params": scenario.default_params,
                "expected_effects": scenario.expected_effects,
                "affected_components": scenario.affected_components,
                "is_active": scenario.name.value in self._active,
            })
        return result

    async def start_scenario(
        self, name: str, params: dict[str, Any] | None = None
    ) -> dict:
        if name in self._active:
            return {"error": f"Scenario '{name}' is already running"}

        scenario_def = SCENARIOS.get(name)
        if not scenario_def:
            return {"error": f"Unknown scenario: {name}"}

        handler = EFFECT_HANDLERS.get(ChaosScenarioName(name))
        if not handler:
            return {"error": f"No handler for scenario: {name}"}

        # Merge defaults with overrides
        merged_params = {**scenario_def.default_params, **(params or {})}

        # Persist to DB
        db_id = await self._create_run(name, merged_params)

        active = ActiveScenario(scenario_def, merged_params, db_id)
        active.task = asyncio.create_task(
            self._run_scenario(name, handler, active)
        )
        self._active[name] = active

        await event_bus.publish(CHANNEL_CHAOS, {
            "action": "started",
            "scenario": name,
            "params": merged_params,
            "db_id": db_id,
        })

        logger.info("chaos_scenario_started", scenario=name, params=merged_params)
        return {
            "status": "started",
            "scenario": name,
            "params": merged_params,
            "run_id": db_id,
        }

    async def stop_scenario(self, name: str) -> dict:
        active = self._active.get(name)
        if not active:
            return {"error": f"Scenario '{name}' is not running"}

        active.stop_event.set()
        if active.task:
            try:
                await asyncio.wait_for(active.task, timeout=10)
            except asyncio.TimeoutError:
                active.task.cancel()

        await self._complete_run(active.db_id)
        del self._active[name]

        await event_bus.publish(CHANNEL_CHAOS, {
            "action": "stopped",
            "scenario": name,
        })

        logger.info("chaos_scenario_stopped", scenario=name)
        return {"status": "stopped", "scenario": name}

    async def _run_scenario(
        self,
        name: str,
        handler,
        active: ActiveScenario,
    ):
        try:
            duration = active.params.get("duration_seconds")
            if duration:
                # Auto-stop after duration
                async def auto_stop():
                    await asyncio.sleep(duration)
                    if not active.stop_event.is_set():
                        active.stop_event.set()

                asyncio.create_task(auto_stop())

            await handler(active.params, active.stop_event)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("chaos_scenario_error", scenario=name)
        finally:
            if name in self._active:
                await self._complete_run(active.db_id)
                del self._active[name]
                await event_bus.publish(CHANNEL_CHAOS, {
                    "action": "completed",
                    "scenario": name,
                })

    def get_active(self) -> list[dict]:
        return [
            {
                "scenario": name,
                "params": active.params,
                "run_id": active.db_id,
                "started_at": active.started_at.isoformat(),
                "elapsed_seconds": (
                    datetime.now(timezone.utc) - active.started_at
                ).total_seconds(),
            }
            for name, active in self._active.items()
        ]

    async def get_history(self, limit: int = 50) -> list[dict]:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT id, scenario_name, params, started_at, ended_at, status "
                    "FROM chaos_runs ORDER BY started_at DESC LIMIT :limit"
                ),
                {"limit": limit},
            )
            return [
                {
                    "id": row.id,
                    "scenario_name": row.scenario_name,
                    "params": row.params,
                    "started_at": row.started_at.isoformat() if row.started_at else None,
                    "ended_at": row.ended_at.isoformat() if row.ended_at else None,
                    "status": row.status,
                }
                for row in result.fetchall()
            ]

    async def _create_run(self, name: str, params: dict) -> int:
        import json

        async with async_session() as session:
            async with session.begin():
                result = await session.execute(
                    text(
                        "INSERT INTO chaos_runs (scenario_name, params) "
                        "VALUES (:name, CAST(:params AS jsonb)) RETURNING id"
                    ),
                    {"name": name, "params": json.dumps(params)},
                )
                return result.scalar_one()

    async def _complete_run(self, run_id: int):
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text(
                        "UPDATE chaos_runs SET ended_at = NOW(), status = 'completed' "
                        "WHERE id = :id"
                    ),
                    {"id": run_id},
                )

    async def stop_all(self):
        for name in list(self._active.keys()):
            await self.stop_scenario(name)


# Singleton
chaos_engine = ChaosEngine()
