"""
Learner — feedback loop that updates detection thresholds
based on incident outcomes.
"""

from __future__ import annotations

import json
from typing import Any

import structlog
from sqlalchemy import text

from nocagent.core.anomaly_detector import anomaly_detector
from nocagent.db.engine import async_session
from nocagent.events import agent_event_bus

logger = structlog.get_logger()


class Learner:
    async def learn(
        self,
        incident_id: int | None,
        decision_id: int | None,
        outcome_success: bool,
        anomaly_type: str,
        metric: str,
        threshold_used: float,
    ):
        if not outcome_success:
            # If action failed, slightly raise threshold to reduce sensitivity
            adjustment = 1.05
            direction = "raised"
        else:
            # If action succeeded, slightly lower threshold to catch sooner
            adjustment = 0.98
            direction = "lowered"

        threshold_key = self._metric_to_threshold_key(anomaly_type, metric)
        if not threshold_key:
            return

        original = anomaly_detector.thresholds.get(threshold_key)
        if original is None:
            return

        updated = round(original * adjustment, 2)
        anomaly_detector.update_thresholds({threshold_key: updated})

        # Persist learning record
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text(
                        "INSERT INTO learning_records "
                        "(incident_id, decision_id, original_threshold, "
                        "updated_threshold, reason) "
                        "VALUES (:incident_id, :decision_id, "
                        "CAST(:original AS jsonb), CAST(:updated AS jsonb), :reason)"
                    ),
                    {
                        "incident_id": incident_id,
                        "decision_id": decision_id,
                        "original": json.dumps({threshold_key: original}),
                        "updated": json.dumps({threshold_key: updated}),
                        "reason": f"Threshold {direction} from {original} to {updated} "
                        f"based on {'successful' if outcome_success else 'failed'} action",
                    },
                )

        await agent_event_bus.publish("threshold_updated", {
            "key": threshold_key,
            "original": original,
            "updated": updated,
            "direction": direction,
        })

        logger.info(
            "learning_applied",
            threshold_key=threshold_key,
            original=original,
            updated=updated,
            direction=direction,
        )

    async def get_effectiveness(self) -> dict[str, Any]:
        async with async_session() as session:
            # MTTD: average time from chaos start to incident detection
            mttd_result = await session.execute(
                text(
                    "SELECT AVG(EXTRACT(EPOCH FROM (i.detected_at - c.started_at))) as avg_mttd "
                    "FROM incidents i "
                    "JOIN chaos_runs c ON i.detected_at >= c.started_at "
                    "WHERE c.started_at >= NOW() - INTERVAL '24 hours'"
                )
            )
            mttd_row = mttd_result.fetchone()
            avg_mttd = round(mttd_row.avg_mttd, 1) if mttd_row and mttd_row.avg_mttd else None

            # MTTR: average time from detection to resolution
            mttr_result = await session.execute(
                text(
                    "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at))) as avg_mttr "
                    "FROM incidents "
                    "WHERE resolved_at IS NOT NULL "
                    "AND detected_at >= NOW() - INTERVAL '24 hours'"
                )
            )
            mttr_row = mttr_result.fetchone()
            avg_mttr = round(mttr_row.avg_mttr, 1) if mttr_row and mttr_row.avg_mttr else None

            # Decision success rate
            success_result = await session.execute(
                text(
                    "SELECT "
                    "COUNT(*) FILTER (WHERE outcome_success = true) as successful, "
                    "COUNT(*) FILTER (WHERE outcome_success = false) as failed, "
                    "COUNT(*) as total "
                    "FROM decisions "
                    "WHERE executed_at IS NOT NULL "
                    "AND created_at >= NOW() - INTERVAL '24 hours'"
                )
            )
            sr = success_result.fetchone()

            # Learning records count
            lr_result = await session.execute(
                text(
                    "SELECT COUNT(*) as count FROM learning_records "
                    "WHERE created_at >= NOW() - INTERVAL '24 hours'"
                )
            )
            lr_count = lr_result.scalar_one()

        return {
            "mttd_seconds": avg_mttd,
            "mttr_seconds": avg_mttr,
            "decisions_total": sr.total if sr else 0,
            "decisions_successful": sr.successful if sr else 0,
            "decisions_failed": sr.failed if sr else 0,
            "success_rate": round(sr.successful / max(sr.total, 1) * 100, 1) if sr else 0,
            "learning_records_24h": lr_count,
            "current_thresholds": dict(anomaly_detector.thresholds),
        }

    def _metric_to_threshold_key(
        self, anomaly_type: str, metric: str
    ) -> str | None:
        mapping = {
            ("high_cpu", "cpu_utilization"): "device_cpu_warning",
            ("high_memory", "memory_utilization"): "device_memory_warning",
            ("high_utilization", "utilization_percent"): "link_utilization_warning",
            ("packet_loss", "packet_loss_percent"): "packet_loss_warning",
            ("high_temperature", "temperature_celsius"): "device_temp_warning",
            ("bgp_flapping", "flap_count"): "bgp_flap_threshold",
        }
        return mapping.get((anomaly_type, metric))


learner = Learner()
