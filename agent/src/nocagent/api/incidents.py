from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from nocagent.db.engine import async_session
from nocagent.core.decision_engine import decision_engine
from nocagent.core.executor import executor
from nocagent.core.reasoner import reasoner

router = APIRouter(prefix="/api/v1", tags=["incidents"])


@router.get("/incidents")
async def list_incidents(limit: int = 50, status: str | None = None):
    async with async_session() as session:
        query = (
            "SELECT id, title, severity, status, detected_at, resolved_at, "
            "affected_devices, affected_links, root_cause_hypothesis, "
            "estimated_customer_impact "
            "FROM incidents "
        )
        params = {"limit": limit}
        if status:
            query += "WHERE status = :status "
            params["status"] = status
        query += "ORDER BY detected_at DESC LIMIT :limit"

        result = await session.execute(text(query), params)
        return [
            {
                "id": r.id,
                "title": r.title,
                "severity": r.severity,
                "status": r.status,
                "detected_at": r.detected_at.isoformat() if r.detected_at else None,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "affected_devices": r.affected_devices,
                "affected_links": r.affected_links,
                "root_cause_hypothesis": r.root_cause_hypothesis,
                "estimated_customer_impact": r.estimated_customer_impact,
            }
            for r in result.fetchall()
        ]


@router.get("/incidents/active")
async def active_incidents():
    """Return all non-resolved incidents with their decisions (for Approval Panel)."""
    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT id, title, severity, status, detected_at, resolved_at, "
                "affected_devices, affected_links, root_cause_hypothesis, "
                "estimated_customer_impact, final_root_cause, claude_reasoning "
                "FROM incidents "
                "WHERE status != 'resolved' "
                "ORDER BY detected_at DESC"
            )
        )
        incidents = result.fetchall()
        if not incidents:
            return []

        # Build incidents list and collect IDs for decisions query
        incident_dicts = []
        ids_params = {}
        for idx, r in enumerate(incidents):
            ids_params[f"id_{idx}"] = r.id
            incident_dicts.append({
                "id": r.id,
                "title": r.title,
                "severity": r.severity,
                "status": r.status,
                "detected_at": r.detected_at.isoformat() if r.detected_at else None,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "affected_devices": r.affected_devices,
                "affected_links": r.affected_links,
                "root_cause_hypothesis": r.root_cause_hypothesis,
                "estimated_customer_impact": r.estimated_customer_impact,
                "final_root_cause": r.final_root_cause,
                "claude_reasoning": r.claude_reasoning,
                "decisions": [],
            })

        # Get all decisions for these incidents in one query
        placeholders = ", ".join(f":id_{i}" for i in range(len(incidents)))
        decisions_result = await session.execute(
            text(
                f"SELECT id, incident_id, action_type, autonomy_tier, confidence, "
                f"reasoning, parameters, status, created_at, executed_at, "
                f"outcome, outcome_success, blast_radius_estimate, category "
                f"FROM decisions WHERE incident_id IN ({placeholders}) "
                f"ORDER BY created_at"
            ),
            ids_params,
        )

        # Group decisions by incident_id
        decisions_by_incident: dict[int, list] = {}
        for d in decisions_result.fetchall():
            decisions_by_incident.setdefault(d.incident_id, []).append({
                "id": d.id,
                "incident_id": d.incident_id,
                "action_type": d.action_type,
                "autonomy_tier": d.autonomy_tier,
                "confidence": d.confidence,
                "reasoning": d.reasoning,
                "parameters": d.parameters,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "executed_at": d.executed_at.isoformat() if d.executed_at else None,
                "outcome": d.outcome,
                "outcome_success": d.outcome_success,
                "blast_radius_estimate": d.blast_radius_estimate,
                "category": d.category,
            })

        for inc in incident_dicts:
            inc["decisions"] = decisions_by_incident.get(inc["id"], [])

        return incident_dicts


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: int):
    async with async_session() as session:
        result = await session.execute(
            text("SELECT * FROM incidents WHERE id = :id"),
            {"id": incident_id},
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(404, f"Incident {incident_id} not found")

        # Get associated decisions
        decisions = await session.execute(
            text(
                "SELECT id, action_type, autonomy_tier, confidence, reasoning, "
                "parameters, status, created_at, executed_at, outcome, "
                "outcome_success, blast_radius_estimate "
                "FROM decisions WHERE incident_id = :id ORDER BY created_at"
            ),
            {"id": incident_id},
        )

        return {
            "id": row.id,
            "title": row.title,
            "severity": row.severity,
            "status": row.status,
            "detected_at": row.detected_at.isoformat() if row.detected_at else None,
            "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
            "affected_devices": row.affected_devices,
            "affected_links": row.affected_links,
            "root_cause_hypothesis": row.root_cause_hypothesis,
            "final_root_cause": row.final_root_cause,
            "estimated_customer_impact": row.estimated_customer_impact,
            "claude_reasoning": row.claude_reasoning,
            "metadata": row.metadata,
            "decisions": [
                {
                    "id": d.id,
                    "action_type": d.action_type,
                    "autonomy_tier": d.autonomy_tier,
                    "confidence": d.confidence,
                    "reasoning": d.reasoning,
                    "parameters": d.parameters,
                    "status": d.status,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                    "executed_at": d.executed_at.isoformat() if d.executed_at else None,
                    "outcome": d.outcome,
                    "outcome_success": d.outcome_success,
                    "blast_radius_estimate": d.blast_radius_estimate,
                }
                for d in decisions.fetchall()
            ],
        }


@router.post("/incidents/{incident_id}/diagnose")
async def diagnose_incident(incident_id: int):
    """
    Trigger AI diagnosis for an incident. This is the ONLY place
    Claude gets called — on-demand, when the user clicks 'Diagnose'.
    Makes exactly 1 Claude API call.
    """
    result = await reasoner.diagnose_incident(incident_id)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.post("/incidents/{incident_id}/approve")
async def approve_incident_action(incident_id: int):
    # Approve all pending decisions for this incident
    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT id, action_type, parameters FROM decisions "
                "WHERE incident_id = :id AND status = 'pending'"
            ),
            {"id": incident_id},
        )
        pending = result.fetchall()

    results = []
    for decision in pending:
        await decision_engine.approve_decision(decision.id)
        exec_result = await executor.execute_decision({
            "id": decision.id,
            "action_type": decision.action_type,
            "parameters": decision.parameters,
        })
        results.append(exec_result)

    return {"incident_id": incident_id, "approved_count": len(results), "results": results}


@router.post("/incidents/{incident_id}/reject")
async def reject_incident_action(incident_id: int):
    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT id FROM decisions "
                "WHERE incident_id = :id AND status = 'pending'"
            ),
            {"id": incident_id},
        )
        pending = result.fetchall()

    for decision in pending:
        await decision_engine.reject_decision(decision.id)

    return {"incident_id": incident_id, "rejected_count": len(pending)}


@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: int):
    """Mark an incident as resolved (engineer confirms fix is in place)."""
    async with async_session() as session:
        async with session.begin():
            await session.execute(
                text(
                    "UPDATE incidents SET status = 'resolved', "
                    "resolved_at = NOW() WHERE id = :id"
                ),
                {"id": incident_id},
            )
    return {"incident_id": incident_id, "status": "resolved"}
