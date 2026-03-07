"""
Main OODA + Learn agent loop.

Observe → Orient (detect anomalies) → Decide (Claude reasoning) →
Act (execute/recommend) → Learn (update thresholds)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog

from nocagent.config.settings import settings
from nocagent.core.observer import observer
from nocagent.core.anomaly_detector import anomaly_detector, Anomaly
from nocagent.core.reasoner import reasoner
from nocagent.core.decision_engine import decision_engine
from nocagent.core.executor import executor
from nocagent.core.learner import learner
from nocagent.events import agent_event_bus

logger = structlog.get_logger()


class NOCAgent:
    """Autonomous Network Operations Center Agent."""

    def __init__(self):
        self._running = False
        self._paused = False
        self._task: asyncio.Task | None = None
        self._mode = settings.agent_mode
        self._started_at: datetime | None = None
        self._loop_count = 0
        self._anomalies_detected = 0
        self._incidents_created = 0

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "paused": self._paused,
            "mode": self._mode,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "uptime_seconds": (
                (datetime.now(timezone.utc) - self._started_at).total_seconds()
                if self._started_at
                else 0
            ),
            "loop_count": self._loop_count,
            "anomalies_detected": self._anomalies_detected,
            "incidents_created": self._incidents_created,
            "observe_interval": settings.observe_interval_seconds,
        }

    async def start(self):
        if self._running:
            return
        self._running = True
        self._started_at = datetime.now(timezone.utc)
        self._task = asyncio.create_task(self._run())
        logger.info("noc_agent_started", mode=self._mode)
        await agent_event_bus.publish("agent_started", {"mode": self._mode})

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("noc_agent_stopped")

    async def pause(self):
        self._paused = True
        logger.info("noc_agent_paused")
        await agent_event_bus.publish("agent_paused", {})

    async def resume(self):
        self._paused = False
        logger.info("noc_agent_resumed")
        await agent_event_bus.publish("agent_resumed", {})

    def set_mode(self, mode: str):
        self._mode = mode
        settings.agent_mode = mode
        logger.info("agent_mode_changed", mode=mode)

    async def _run(self):
        while self._running:
            try:
                if not self._paused:
                    await self._ooda_cycle()
                    self._loop_count += 1
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("agent_loop_error")
            await asyncio.sleep(settings.observe_interval_seconds)

    async def _ooda_cycle(self):
        # 1. OBSERVE — collect latest telemetry
        telemetry = await observer.observe()
        if not telemetry:
            return

        # 2. ORIENT — detect anomalies (statistical, no LLM)
        anomalies = await anomaly_detector.detect(telemetry)
        if not anomalies:
            return

        self._anomalies_detected += len(anomalies)

        # Deduplicate: only process if we have critical/emergency anomalies
        # or more than 2 warnings
        critical_anomalies = [
            a for a in anomalies if a.severity in ("critical", "emergency")
        ]
        if not critical_anomalies and len(anomalies) < 3:
            logger.debug(
                "anomalies_below_reasoning_threshold",
                count=len(anomalies),
            )
            return

        await agent_event_bus.publish("anomalies_detected", {
            "count": len(anomalies),
            "critical": len(critical_anomalies),
            "types": list({a.anomaly_type for a in anomalies}),
        })

        # 3. DECIDE — use Claude to diagnose and plan
        diagnosis = await reasoner.diagnose(anomalies, telemetry)

        # The reasoner already executed tool calls (including create_incident,
        # rate_limit, etc.) through Claude's tool-use loop. The tools
        # themselves create incidents and decisions.

        # 4. ACT — execute any approved/pending decisions
        pending = await decision_engine.get_pending_decisions()
        for decision in pending:
            if decision["autonomy_tier"] <= 2 and self._mode == "autonomous":
                await executor.execute_decision(decision)

        # 5. LEARN — update thresholds based on outcomes
        for anomaly in anomalies[:3]:  # Learn from top anomalies
            await learner.learn(
                incident_id=None,
                decision_id=None,
                outcome_success=True,
                anomaly_type=anomaly.anomaly_type,
                metric=anomaly.metric,
                threshold_used=anomaly.threshold,
            )


# Singleton
noc_agent = NOCAgent()
