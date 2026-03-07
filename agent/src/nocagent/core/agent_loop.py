"""
Main agent loop — Observe + Detect + Auto-Incident + Learn.

Claude is NOT called in the loop. Claude is only called on-demand
when a user clicks "Diagnose" on an incident in the dashboard.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import structlog
from sqlalchemy import text

from nocagent.config.settings import settings
from nocagent.core.observer import observer
from nocagent.core.anomaly_detector import anomaly_detector, Anomaly
from nocagent.core.learner import learner
from nocagent.db.engine import async_session
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
                    await self._observe_and_detect()
                    self._loop_count += 1
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.exception("agent_loop_error", error=str(exc), error_type=type(exc).__name__)
            await asyncio.sleep(settings.observe_interval_seconds)

    async def _observe_and_detect(self):
        """Observe → Detect → Auto-create incidents. NO Claude calls."""

        # 1. OBSERVE — collect latest telemetry
        telemetry = await observer.observe()
        if not telemetry:
            return

        # 2. ORIENT — detect anomalies (statistical, no LLM)
        anomalies = await anomaly_detector.detect(telemetry)
        if not anomalies:
            return

        self._anomalies_detected += len(anomalies)

        # Only create incidents for critical/emergency anomalies or 3+ warnings
        critical_anomalies = [
            a for a in anomalies if a.severity in ("critical", "emergency")
        ]
        if not critical_anomalies and len(anomalies) < 3:
            return

        await agent_event_bus.publish("anomalies_detected", {
            "count": len(anomalies),
            "critical": len(critical_anomalies),
            "types": list({a.anomaly_type for a in anomalies}),
        })

        # 3. AUTO-CREATE INCIDENT (no Claude — just DB insert)
        await self._auto_create_incident(anomalies, telemetry)

        # 4. LEARN — update thresholds based on anomaly patterns
        for anomaly in anomalies[:3]:
            await learner.learn(
                incident_id=None,
                decision_id=None,
                outcome_success=True,
                anomaly_type=anomaly.anomaly_type,
                metric=anomaly.metric,
                threshold_used=anomaly.threshold,
            )

    async def _auto_create_incident(
        self, anomalies: list[Anomaly], telemetry: dict
    ):
        """Create an incident from anomalies without calling Claude."""

        # Determine severity from worst anomaly
        if any(a.severity == "emergency" for a in anomalies):
            severity = "emergency"
        elif any(a.severity == "critical" for a in anomalies):
            severity = "critical"
        else:
            severity = "warning"

        # Collect affected devices and links
        affected_devices = list({
            a.source_id for a in anomalies if a.source_type == "device"
        })
        affected_links = list({
            a.source_id for a in anomalies if a.source_type == "link"
        })

        # Build a descriptive title from anomalies
        anomaly_types = list({a.anomaly_type for a in anomalies})
        type_labels = {
            "link_down": "Link Down",
            "high_utilization": "High Utilization",
            "packet_loss": "Packet Loss",
            "device_down": "Device Down",
            "high_cpu": "High CPU",
            "high_memory": "High Memory",
            "high_temperature": "High Temperature",
            "bgp_session_down": "BGP Session Down",
            "bgp_flapping": "BGP Flapping",
        }
        type_desc = ", ".join(type_labels.get(t, t) for t in anomaly_types[:3])
        sources = ", ".join(
            a.source_id for a in anomalies[:3]
        )
        title = f"{severity.upper()}: {type_desc} — {sources}"

        # Build hypothesis from anomaly descriptions
        hypothesis = "; ".join(a.description for a in anomalies[:5])

        # Deduplicate: check if a similar open incident already exists
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT id FROM incidents "
                    "WHERE status NOT IN ('resolved') "
                    "AND title = :title "
                    "AND detected_at > NOW() - INTERVAL '5 minutes' "
                    "LIMIT 1"
                ),
                {"title": title},
            )
            if result.fetchone():
                return  # Already have this incident

        # Insert in a separate session to avoid transaction nesting
        async with async_session() as session:
            async with session.begin():
                result = await session.execute(
                    text(
                        "INSERT INTO incidents (title, severity, status, "
                        "affected_devices, affected_links, root_cause_hypothesis) "
                        "VALUES (:title, :severity, 'open', "
                        ":affected_devices, :affected_links, :hypothesis) "
                        "RETURNING id"
                    ),
                    {
                        "title": title,
                        "severity": severity,
                        "affected_devices": affected_devices or None,
                        "affected_links": affected_links or None,
                        "hypothesis": hypothesis,
                    },
                )
                incident_id = result.scalar_one()

        self._incidents_created += 1

        await agent_event_bus.publish("incident_created", {
            "incident_id": incident_id,
            "title": title,
            "severity": severity,
        })

        logger.info(
            "auto_incident_created",
            incident_id=incident_id,
            severity=severity,
            anomaly_count=len(anomalies),
        )

        # Auto-diagnose with Claude (1 API call per new incident)
        # This creates decision records that show in the Approval Panel
        try:
            from nocagent.core.reasoner import reasoner
            result = await reasoner.diagnose_incident(incident_id)
            logger.info(
                "auto_diagnosis_complete",
                incident_id=incident_id,
                actions_proposed=result.get("actions_proposed", 0),
            )
        except Exception as exc:
            logger.warning(
                "auto_diagnosis_failed",
                incident_id=incident_id,
                error=str(exc),
            )


# Singleton
noc_agent = NOCAgent()
