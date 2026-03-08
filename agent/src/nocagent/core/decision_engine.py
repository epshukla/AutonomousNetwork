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
from nocagent.tools.handlers import handle_tool_call

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
    "replace_hardware": 4,
    "dispatch_field_tech": 4,
    "resplice_fiber": 4,
}

# Action type to category mapping
ACTION_CATEGORY_MAP = {
    "execute_reroute": "software",
    "apply_rate_limit": "software",
    "restart_device": "software",
    "config_rollback": "software",
    "bgp_withdraw": "software",
    "bgp_announce": "software",
    "escalate_to_engineer": "informational",
    "create_incident": "informational",
    "query_device_metrics": "informational",
    "query_link_metrics": "informational",
    "get_network_topology": "informational",
    "check_bgp_sessions": "informational",
    "get_affected_customers": "informational",
    "query_past_incidents": "informational",
    "replace_hardware": "physical",
    "dispatch_field_tech": "physical",
    "resplice_fiber": "physical",
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
        category = ACTION_CATEGORY_MAP.get(action_type, "software")

        # Physical actions are logged as work orders — never go through approve/execute
        if category == "physical":
            status = "logged"
        elif mode == "observe-only":
            status = "pending"
        elif tier == 1:
            status = "executed"
        elif tier == 2 and mode == "autonomous":
            status = "executed"
        else:
            status = "pending"

        # Skip duplicate pending decisions for the same incident + action
        if incident_id is not None and status == "pending":
            async with async_session() as session:
                existing = await session.execute(
                    text(
                        "SELECT id FROM decisions "
                        "WHERE incident_id = :incident_id "
                        "AND action_type = :action_type "
                        "AND status = 'pending' "
                        "LIMIT 1"
                    ),
                    {"incident_id": incident_id, "action_type": action_type},
                )
                row = existing.fetchone()
                if row:
                    logger.info(
                        "duplicate_decision_skipped",
                        incident_id=incident_id,
                        action_type=action_type,
                        existing_id=row.id,
                    )
                    return {
                        "id": row.id,
                        "incident_id": incident_id,
                        "action_type": action_type,
                        "autonomy_tier": tier,
                        "tier_label": AUTONOMY_TIERS[tier],
                        "confidence": confidence,
                        "status": "pending",
                        "blast_radius_estimate": blast_radius,
                        "parameters": parameters,
                        "duplicate": True,
                    }

        async with async_session() as session:
            async with session.begin():
                result = await session.execute(
                    text(
                        "INSERT INTO decisions "
                        "(incident_id, action_type, autonomy_tier, confidence, "
                        "reasoning, parameters, status, blast_radius_estimate, category"
                        + (", executed_at" if status == "executed" else "")
                        + ") VALUES ("
                        ":incident_id, :action_type, :tier, :confidence, "
                        ":reasoning, CAST(:parameters AS jsonb), :status, :blast_radius, :category"
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
                        "category": category,
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
            "category": category,
        }

        await agent_event_bus.publish("decision_created", decision)

        # Auto-execute Tier 1/2 decisions against the simulator
        if status == "executed" and category == "software":
            try:
                result_str = await handle_tool_call(action_type, parameters)
                import json as _json
                result_data = _json.loads(result_str)
                success = "error" not in result_data
                await self.mark_executed(decision_id, outcome=result_str, success=success)
                logger.info(
                    "auto_executed_decision",
                    decision_id=decision_id,
                    action=action_type,
                    success=success,
                )
            except Exception as exc:
                await self.mark_executed(decision_id, outcome=str(exc), success=False)
                logger.warning("auto_execute_failed", decision_id=decision_id, error=str(exc))

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


    async def get_field_tasks(self) -> list[dict]:
        """Physical tasks for ISP field team — work orders."""
        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT d.id, d.incident_id, d.action_type, d.autonomy_tier, "
                    "d.confidence, d.reasoning, d.parameters, d.status, "
                    "d.created_at, d.blast_radius_estimate, d.category, d.outcome, "
                    "i.title as incident_title, i.severity as incident_severity "
                    "FROM decisions d "
                    "LEFT JOIN incidents i ON d.incident_id = i.id "
                    "WHERE d.category = 'physical' "
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
                    "category": r.category,
                    "notes": r.outcome,
                }
                for r in result.fetchall()
            ]

    async def update_field_task_status(
        self, decision_id: int, status: str, notes: str = ""
    ) -> dict:
        """Field team updates a physical task status."""
        if status not in ("in_progress", "completed"):
            return {"error": "Status must be 'in_progress' or 'completed'"}

        async with async_session() as session:
            async with session.begin():
                result = await session.execute(
                    text(
                        "UPDATE decisions SET status = :status, "
                        "outcome = CASE WHEN :notes != '' THEN :notes ELSE outcome END "
                        + (", executed_at = NOW() " if status == "completed" else "")
                        + "WHERE id = :id AND category = 'physical' "
                        "RETURNING id"
                    ),
                    {"id": decision_id, "status": status, "notes": notes},
                )
                row = result.fetchone()
                if not row:
                    return {"error": f"Physical task {decision_id} not found"}

        await agent_event_bus.publish("field_task_updated", {
            "decision_id": decision_id,
            "status": status,
        })

        return {"decision_id": decision_id, "status": status}


decision_engine = DecisionEngine()
