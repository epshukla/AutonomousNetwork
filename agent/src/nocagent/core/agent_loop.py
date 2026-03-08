"""
Main agent loop — Observe + Detect only.

The loop NEVER creates incidents or calls Claude on its own.
Incident + diagnosis happens ONCE per chaos run — tracked by run_id
so the same chaos scenario never triggers twice.
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
from nocagent.tools.handlers import get_http_client
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
        # Track chaos run IDs we already handled — prevents repeat calls
        self._handled_chaos_runs: set[int] = set()

    async def _load_handled_runs(self):
        """Reload previously handled chaos run IDs from incident metadata."""
        try:
            async with async_session() as session:
                result = await session.execute(
                    text(
                        "SELECT metadata FROM incidents "
                        "WHERE metadata IS NOT NULL "
                        "AND metadata->>'chaos_run_ids' IS NOT NULL"
                    )
                )
                for row in result.fetchall():
                    meta = row.metadata if isinstance(row.metadata, dict) else {}
                    for run_id in meta.get("chaos_run_ids", []):
                        self._handled_chaos_runs.add(run_id)
            logger.info(
                "loaded_handled_chaos_runs",
                count=len(self._handled_chaos_runs),
            )
        except Exception as exc:
            logger.warning("failed_to_load_handled_runs", error=str(exc))

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
        await self._load_handled_runs()
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

    async def _get_new_chaos_runs(self) -> list[dict]:
        """Return chaos runs we haven't handled yet. Empty = nothing to do."""
        try:
            client = get_http_client()
            resp = await client.get("/api/v1/chaos/active")
            active = resp.json()
            # Filter out runs we already created an incident for
            new_runs = [r for r in active if r.get("run_id") not in self._handled_chaos_runs]
            return new_runs
        except Exception:
            return []

    async def _observe_and_detect(self):
        """Observe → Detect anomalies. Create incident ONLY for new chaos runs."""

        # 1. OBSERVE — collect latest telemetry (free, no API calls)
        telemetry = await observer.observe()
        if not telemetry:
            return

        # 2. DETECT — anomalies (statistical, no LLM)
        anomalies = await anomaly_detector.detect(telemetry)
        if anomalies:
            self._anomalies_detected += len(anomalies)

        # 3. Check for NEW chaos runs we haven't handled yet
        new_chaos_runs = await self._get_new_chaos_runs()
        if not new_chaos_runs:
            return  # No new chaos = do nothing

        # Need at least some anomalies to justify an incident
        if not anomalies:
            return  # Chaos just started, no anomalies yet — wait

        critical_anomalies = [
            a for a in anomalies if a.severity in ("critical", "emergency")
        ]

        await agent_event_bus.publish("anomalies_detected", {
            "count": len(anomalies),
            "critical": len(critical_anomalies),
            "types": list({a.anomaly_type for a in anomalies}),
        })

        # 4. Create ONE incident for these new chaos runs, then mark them handled
        for run in new_chaos_runs:
            self._handled_chaos_runs.add(run.get("run_id"))

        await self._create_incident_and_diagnose(anomalies, new_chaos_runs)

        # 5. LEARN — update thresholds
        for anomaly in anomalies[:3]:
            await learner.learn(
                incident_id=None,
                decision_id=None,
                outcome_success=True,
                anomaly_type=anomaly.anomaly_type,
                metric=anomaly.metric,
                threshold_used=anomaly.threshold,
            )

    async def _create_incident_and_diagnose(
        self, anomalies: list[Anomaly], chaos_runs: list[dict]
    ):
        """Create ONE incident + ONE Claude call for new chaos run(s)."""

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

        # Build title
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
        scenarios = ", ".join(r.get("scenario", "?") for r in chaos_runs[:2])
        title = f"{severity.upper()}: {type_desc} [{scenarios}]"

        hypothesis = "; ".join(a.description for a in anomalies[:5])

        # Insert incident
        async with async_session() as session:
            async with session.begin():
                result = await session.execute(
                    text(
                        "INSERT INTO incidents (title, severity, status, "
                        "affected_devices, affected_links, root_cause_hypothesis, metadata) "
                        "VALUES (:title, :severity, 'open', "
                        ":affected_devices, :affected_links, :hypothesis, "
                        "CAST(:metadata AS jsonb)) "
                        "RETURNING id"
                    ),
                    {
                        "title": title,
                        "severity": severity,
                        "affected_devices": affected_devices or None,
                        "affected_links": affected_links or None,
                        "hypothesis": hypothesis,
                        "metadata": json.dumps({
                            "chaos_run_ids": [r.get("run_id") for r in chaos_runs],
                        }),
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
            "incident_created",
            incident_id=incident_id,
            severity=severity,
            chaos_runs=[r.get("run_id") for r in chaos_runs],
        )

        # Diagnosis is triggered by the engineer via the Approval Panel
        # (no automatic Claude call — human stays in the loop)


# Singleton
noc_agent = NOCAgent()
