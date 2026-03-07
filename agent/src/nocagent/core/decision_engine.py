"""
Decision engine — determines autonomy tier and whether actions
should be auto-executed, recommended, or escalated.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import text

from nocagent.config.settings import settings
from nocagent.db.engine import async_session
from nocagent.events import agent_event_bus

logger = structlog.get_logger()

AUTONOMY_TIERS = {
    1: "auto_execute",
    2: "auto_with_audit",
    3: "recommend",
    4: "escalate",
}

# Action type to base tier mapping
ACTION_TIER_MAP = {
    "create_incident": 1,
    "query_device_metrics": 1,
    "query_link_metrics": 1,
    "get_network_topology": 1,
    "check_bgp_sessions": 1,
    "get_affected_customers": 1,
    "query_past_incidents": 1,
    "apply_rate_limit": 2,
    "execute_reroute": 3,
    "restart_device": 4,
    "escalate_to_engineer": 4,
}


def determine_tier(
    action_type: str,
    blast_radius: int,
    confidence: float,
) -> int:
    base_tier = ACTION_TIER_MAP.get(action_type, 4)

    # Upgrade tier if blast radius is large or confidence is low
    if base_tier == 2 and (blast_radius > 100000 or confidence < 0.6):
        return 3
    if base_tier == 3 and (blast_radius > 500000 or confidence < 0.5):
        return 4

    return base_tier


class DecisionEngine:
    async def create_decision(
        self,
        incident_id: int | None,
        action_type: str,
        reasoning: str,
        parameters: dict[str, Any],
        confidence: float,
        blast_radius: int,
    ) -> dict:
        tier = determine_tier(action_type, blast_radius, confidence)
        mode = settings.agent_mode

        # Determine status based on tier and mode
        if mode == "observe-only":
            status = "pending"
        elif tier == 1:
            status = "executed"
        elif tier == 2 and mode == "autonomous":
            status = "executed"
        elif tier <= 3 and mode == "autonomous":
            status = "executed"
        else:
            status = "pending"

        async with async_session() as session:
            async with session.begin():
                result = await session.execute(
                    text(
                        "INSERT INTO decisions "
                        "(incident_id, action_type, autonomy_tier, confidence, "
                        "reasoning, parameters, status, blast_radius_estimate"
                        + (", executed_at" if status == "executed" else "")
                        + ") VALUES ("
                        ":incident_id, :action_type, :tier, :confidence, "
                        ":reasoning, CAST(:parameters AS jsonb), :status, :blast_radius"
                        + (", NOW()" if status == "executed" else "")
                        + ") RETURNING id"
                    ),
                    {
                        "incident_id": incident_id,
                        "action_type": action_type,
                        "tier": tier,
                        "confidence": confidence,
                        "reasoning": reasoning,
                        "parameters": json.dumps(parameters),
                        "status": status,
                        "blast_radius": blast_radius,
                    },
                )
                decision_id = result.scalar_one()

        decision = {
            "id": decision_id,
            "incident_id": incident_id,
            "action_type": action_type,
            "autonomy_tier": tier,
            "tier_label": AUTONOMY_TIERS[tier],
            "confidence": confidence,
            "status": status,
            "blast_radius_estimate": blast_radius,
            "parameters": parameters,
        }

        await agent_event_bus.publish("decision_created", decision)

        logger.info(
            "decision_created",
            decision_id=decision_id,
            action=action_type,
            tier=tier,
            status=status,
        )

        return decision

    async def approve_decision(self, decision_id: int) -> dict:
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text(
                        "UPDATE decisions SET status = 'approved' "
                        "WHERE id = :id AND status = 'pending'"
                    ),
                    {"id": decision_id},
                )
        await agent_event_bus.publish("decision_approved", {"decision_id": decision_id})
        return {"decision_id": decision_id, "status": "approved"}

    async def reject_decision(self, decision_id: int) -> dict:
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text(
                        "UPDATE decisions SET status = 'rejected' "
                        "WHERE id = :id AND status = 'pending'"
                    ),
                    {"id": decision_id},
                )
        await agent_event_bus.publish("decision_rejected", {"decision_id": decision_id})
        return {"decision_id": decision_id, "status": "rejected"}

    async def mark_executed(
        self, decision_id: int, outcome: str, success: bool
    ):
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text(
                        "UPDATE decisions SET status = 'executed', "
                        "executed_at = NOW(), outcome = :outcome, "
                        "outcome_success = :success "
                        "WHERE id = :id"
                    ),
                    {"id": decision_id, "outcome": outcome, "success": success},
                )

    async def get_pending_decisions(self) -> list[dict]:
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT d.id, d.incident_id, d.action_type, d.autonomy_tier, "
                    "d.confidence, d.reasoning, d.parameters, d.status, "
                    "d.created_at, d.blast_radius_estimate, "
                    "i.title as incident_title, i.severity as incident_severity "
                    "FROM decisions d "
                    "LEFT JOIN incidents i ON d.incident_id = i.id "
                    "WHERE d.status = 'pending' "
                    "ORDER BY d.created_at DESC"
                )
            )
            return [
                {
                    "id": r.id,
                    "incident_id": r.incident_id,
                    "incident_title": r.incident_title,
                    "incident_severity": r.incident_severity,
                    "action_type": r.action_type,
                    "autonomy_tier": r.autonomy_tier,
                    "confidence": r.confidence,
                    "reasoning": r.reasoning,
                    "parameters": r.parameters,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "blast_radius_estimate": r.blast_radius_estimate,
                }
                for r in result.fetchall()
            ]


decision_engine = DecisionEngine()
