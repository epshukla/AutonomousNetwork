from fastapi import APIRouter
from sqlalchemy import text

from nocagent.db.engine import async_session
from nocagent.core.decision_engine import decision_engine

router = APIRouter(prefix="/api/v1", tags=["decisions"])


@router.get("/decisions")
async def list_decisions(limit: int = 100):
    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT d.id, d.incident_id, d.action_type, d.autonomy_tier, "
                "d.confidence, d.reasoning, d.parameters, d.status, "
                "d.created_at, d.executed_at, d.outcome, d.outcome_success, "
                "d.blast_radius_estimate, "
                "i.title as incident_title "
                "FROM decisions d "
                "LEFT JOIN incidents i ON d.incident_id = i.id "
                "ORDER BY d.created_at DESC LIMIT :limit"
            ),
            {"limit": limit},
        )
        return [
            {
                "id": r.id,
                "incident_id": r.incident_id,
                "incident_title": r.incident_title,
                "action_type": r.action_type,
                "autonomy_tier": r.autonomy_tier,
                "confidence": r.confidence,
                "reasoning": r.reasoning,
                "parameters": r.parameters,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "executed_at": r.executed_at.isoformat() if r.executed_at else None,
                "outcome": r.outcome,
                "outcome_success": r.outcome_success,
                "blast_radius_estimate": r.blast_radius_estimate,
            }
            for r in result.fetchall()
        ]


@router.get("/decisions/{decision_id}")
async def get_decision(decision_id: int):
    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT d.*, i.title as incident_title "
                "FROM decisions d "
                "LEFT JOIN incidents i ON d.incident_id = i.id "
                "WHERE d.id = :id"
            ),
            {"id": decision_id},
        )
        r = result.fetchone()
        if not r:
            from fastapi import HTTPException
            raise HTTPException(404, f"Decision {decision_id} not found")
        return {
            "id": r.id,
            "incident_id": r.incident_id,
            "incident_title": r.incident_title,
            "action_type": r.action_type,
            "autonomy_tier": r.autonomy_tier,
            "confidence": r.confidence,
            "reasoning": r.reasoning,
            "parameters": r.parameters,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "executed_at": r.executed_at.isoformat() if r.executed_at else None,
            "outcome": r.outcome,
            "outcome_success": r.outcome_success,
            "blast_radius_estimate": r.blast_radius_estimate,
        }


@router.get("/decisions/pending")
async def get_pending_decisions():
    return await decision_engine.get_pending_decisions()
