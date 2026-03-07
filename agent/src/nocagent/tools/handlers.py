"""
Tool execution handlers — each tool maps to a simulator API call
or a local database operation.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta

import httpx
import structlog
from sqlalchemy import text

from nocagent.config.settings import settings
from nocagent.db.engine import async_session

logger = structlog.get_logger()

_http_client: httpx.AsyncClient | None = None

# Track the most recent incident created during a reasoning cycle
# so action tools can associate decisions with the right incident.
_current_incident_id: int | None = None


def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            base_url=settings.simulator_url, timeout=30.0
        )
    return _http_client


async def close_http_client():
    global _http_client
    if _http_client:
        await _http_client.aclose()
        _http_client = None


async def _create_decision_record(
    action_type: str,
    reasoning: str,
    parameters: dict,
    confidence: float,
    blast_radius: int,
    incident_id: int | None = None,
) -> dict:
    """Create a decision record via the decision engine."""
    from nocagent.core.decision_engine import decision_engine
    return await decision_engine.create_decision(
        incident_id=incident_id or _current_incident_id,
        action_type=action_type,
        reasoning=reasoning,
        parameters=parameters,
        confidence=confidence,
        blast_radius=blast_radius,
    )


async def handle_tool_call(
    tool_name: str, tool_input: dict, *, from_executor: bool = False
) -> str:
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
    try:
        result = await handler(tool_input, from_executor=from_executor)
        return json.dumps(result, default=str)
    except Exception as e:
        logger.exception("tool_execution_error", tool=tool_name, error=str(e))
        return json.dumps({"error": str(e)})


def _summarize_timeseries(data: list[dict], metric_keys: list[str]) -> dict:
    """Summarize a large timeseries into stats + recent samples to avoid context overflow."""
    if not data:
        return {"summary": {}, "recent_samples": [], "total_points": 0}

    summary = {}
    for key in metric_keys:
        values = [d[key] for d in data if key in d and isinstance(d[key], (int, float))]
        if values:
            summary[key] = {
                "min": round(min(values), 2),
                "max": round(max(values), 2),
                "avg": round(sum(values) / len(values), 2),
                "latest": round(values[-1], 2),
                "first": round(values[0], 2),
            }

    # Return only last 5 data points for detail
    recent = data[-5:] if len(data) > 5 else data
    return {
        "summary": summary,
        "recent_samples": recent,
        "total_points": len(data),
        "time_range": {"start": data[0].get("time"), "end": data[-1].get("time")} if data else {},
    }


async def query_device_metrics(params: dict, **kwargs) -> dict:
    client = get_http_client()
    device_id = params["device_id"]
    minutes = params.get("time_range_minutes", 30)
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=minutes)

    resp = await client.get(
        f"/api/v1/telemetry/devices/{device_id}",
        params={"start": start.isoformat(), "end": end.isoformat()},
    )
    resp.raise_for_status()
    result = resp.json()

    # Summarize to avoid blowing up Claude's context window
    data = result.get("data", [])
    if len(data) > 10:
        result["data"] = _summarize_timeseries(
            data, ["cpu_utilization", "memory_utilization", "temperature_celsius"]
        )
    return result


async def query_link_metrics(params: dict, **kwargs) -> dict:
    client = get_http_client()
    link_id = params["link_id"]
    minutes = params.get("time_range_minutes", 30)
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=minutes)

    resp = await client.get(
        f"/api/v1/telemetry/links/{link_id}",
        params={"start": start.isoformat(), "end": end.isoformat()},
    )
    resp.raise_for_status()
    result = resp.json()

    # Summarize to avoid blowing up Claude's context window
    data = result.get("data", [])
    if len(data) > 10:
        result["data"] = _summarize_timeseries(
            data, ["utilization_percent", "throughput_gbps", "latency_ms", "packet_loss_percent"]
        )
    return result


async def get_network_topology(params: dict, **kwargs) -> dict:
    client = get_http_client()
    resp = await client.get("/api/v1/topology")
    resp.raise_for_status()
    return resp.json()


async def check_bgp_sessions(params: dict, **kwargs) -> dict:
    client = get_http_client()
    resp = await client.get("/api/v1/topology/bgp-sessions")
    resp.raise_for_status()
    sessions = resp.json()
    device_id = params.get("device_id")
    if device_id:
        sessions = [s for s in sessions if s.get("device_id") == device_id]
    return {"sessions": sessions}


async def get_affected_customers(params: dict, **kwargs) -> dict:
    client = get_http_client()
    device_id = params["device_id"]
    severity = params["severity"]

    resp = await client.get(f"/api/v1/topology/devices/{device_id}")
    resp.raise_for_status()
    device = resp.json()

    # Get topology to access customer distribution
    topo_resp = await client.get("/api/v1/topology")
    topo_resp.raise_for_status()
    topo = topo_resp.json()

    city = device.get("city", "delhi")
    customers = topo.get("customer_distribution", {}).get(city, {})
    total = customers.get("total", 0)

    device_type = device.get("type", "")
    if device_type == "core_router":
        fraction = 0.5 if severity == "full" else 0.2
    elif device_type == "edge_router":
        fraction = 0.25 if severity == "full" else 0.1
    else:
        fraction = 0.1 if severity == "full" else 0.03

    affected = int(total * fraction)
    return {
        "device_id": device_id,
        "city": city,
        "severity": severity,
        "estimated_affected_customers": affected,
        "total_customers_in_city": total,
    }


async def execute_reroute(params: dict, *, from_executor: bool = False) -> dict:
    # Create decision record (tier 3) unless called from executor
    if not from_executor:
        decision = await _create_decision_record(
            action_type="execute_reroute",
            reasoning=params.get("reason", "Traffic reroute requested"),
            parameters=params,
            confidence=0.7,
            blast_radius=200000,
        )
        if decision["status"] == "pending":
            return {
                "status": "pending_approval",
                "decision_id": decision["id"],
                "message": f"Reroute requires approval (Tier {decision['autonomy_tier']}). Decision #{decision['id']} created.",
            }

    client = get_http_client()
    resp = await client.post("/api/v1/actions/reroute", json=params)
    resp.raise_for_status()
    result = resp.json()

    if not from_executor and decision["status"] == "executed":
        from nocagent.core.decision_engine import decision_engine
        await decision_engine.mark_executed(
            decision["id"],
            outcome=json.dumps(result, default=str),
            success=True,
        )

    return result


async def apply_rate_limit(params: dict, *, from_executor: bool = False) -> dict:
    # Create decision record (tier 2) unless called from executor
    if not from_executor:
        decision = await _create_decision_record(
            action_type="apply_rate_limit",
            reasoning=params.get("reason", "Rate limit applied"),
            parameters=params,
            confidence=0.8,
            blast_radius=50000,
        )
        if decision["status"] == "pending":
            return {
                "status": "pending_approval",
                "decision_id": decision["id"],
                "message": f"Rate limit requires approval (Tier {decision['autonomy_tier']}). Decision #{decision['id']} created.",
            }

    client = get_http_client()
    resp = await client.post("/api/v1/actions/rate-limit", json=params)
    resp.raise_for_status()
    result = resp.json()

    if not from_executor:
        from nocagent.core.decision_engine import decision_engine
        await decision_engine.mark_executed(
            decision["id"],
            outcome=json.dumps(result, default=str),
            success=True,
        )

    return result


async def restart_device(params: dict, *, from_executor: bool = False) -> dict:
    # Create decision record (tier 4) unless called from executor
    if not from_executor:
        decision = await _create_decision_record(
            action_type="restart_device",
            reasoning=params.get("reason", "Device restart requested"),
            parameters=params,
            confidence=0.6,
            blast_radius=500000,
        )
        if decision["status"] == "pending":
            return {
                "status": "pending_approval",
                "decision_id": decision["id"],
                "message": f"Device restart requires approval (Tier {decision['autonomy_tier']}). Decision #{decision['id']} created.",
            }

    client = get_http_client()
    resp = await client.post("/api/v1/actions/device/restart", json=params)
    resp.raise_for_status()
    result = resp.json()

    if not from_executor and decision["status"] == "executed":
        from nocagent.core.decision_engine import decision_engine
        await decision_engine.mark_executed(
            decision["id"],
            outcome=json.dumps(result, default=str),
            success=True,
        )

    return result


async def create_incident(params: dict, **kwargs) -> dict:
    global _current_incident_id
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                text(
                    "INSERT INTO incidents (title, severity, affected_devices, "
                    "affected_links, root_cause_hypothesis) "
                    "VALUES (:title, :severity, :affected_devices, "
                    ":affected_links, :root_cause_hypothesis) RETURNING id"
                ),
                {
                    "title": params["title"],
                    "severity": params["severity"],
                    "affected_devices": params.get("affected_devices", []),
                    "affected_links": params.get("affected_links", []),
                    "root_cause_hypothesis": params["root_cause_hypothesis"],
                },
            )
            incident_id = result.scalar_one()

    _current_incident_id = incident_id

    # Create a tier-1 decision record for the incident creation
    await _create_decision_record(
        action_type="create_incident",
        reasoning=f"Created incident: {params['title']}",
        parameters=params,
        confidence=0.9,
        blast_radius=0,
        incident_id=incident_id,
    )

    return {
        "incident_id": incident_id,
        "status": "created",
        "title": params["title"],
        "severity": params["severity"],
    }


async def escalate_to_engineer(params: dict, *, from_executor: bool = False) -> dict:
    # Create decision record (tier 4) for the escalation
    if not from_executor:
        decision = await _create_decision_record(
            action_type="escalate_to_engineer",
            reasoning=params.get("context", "Escalation to engineer"),
            parameters=params,
            confidence=0.5,
            blast_radius=0,
        )

    async with async_session() as session:
        async with session.begin():
            result = await session.execute(
                text(
                    "INSERT INTO incidents (title, severity, status, "
                    "root_cause_hypothesis, metadata) "
                    "VALUES (:title, :severity, 'action_pending', "
                    ":hypothesis, CAST(:metadata AS jsonb)) RETURNING id"
                ),
                {
                    "title": f"[ESCALATION] {params.get('urgency', 'medium').upper()} — Engineer review needed",
                    "severity": params["urgency"],
                    "hypothesis": params["context"],
                    "metadata": json.dumps({
                        "escalation": True,
                        "recommended_action": params.get("recommended_action"),
                    }),
                },
            )
            incident_id = result.scalar_one()
    return {
        "incident_id": incident_id,
        "status": "escalated",
        "urgency": params["urgency"],
    }


async def query_past_incidents(params: dict, **kwargs) -> dict:
    keyword = params["keyword"]
    hours = params.get("time_range_hours", 24)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT id, title, severity, status, detected_at, "
                "root_cause_hypothesis, final_root_cause "
                "FROM incidents "
                "WHERE (title ILIKE :pattern OR root_cause_hypothesis ILIKE :pattern) "
                "AND detected_at >= :since "
                "ORDER BY detected_at DESC LIMIT 10"
            ),
            {"pattern": f"%{keyword}%", "since": since},
        )
        rows = result.fetchall()

    return {
        "keyword": keyword,
        "count": len(rows),
        "incidents": [
            {
                "id": r.id,
                "title": r.title,
                "severity": r.severity,
                "status": r.status,
                "detected_at": r.detected_at.isoformat() if r.detected_at else None,
                "root_cause": r.root_cause_hypothesis,
            }
            for r in rows
        ],
    }


TOOL_HANDLERS = {
    "query_device_metrics": query_device_metrics,
    "query_link_metrics": query_link_metrics,
    "get_network_topology": get_network_topology,
    "check_bgp_sessions": check_bgp_sessions,
    "get_affected_customers": get_affected_customers,
    "execute_reroute": execute_reroute,
    "apply_rate_limit": apply_rate_limit,
    "restart_device": restart_device,
    "create_incident": create_incident,
    "escalate_to_engineer": escalate_to_engineer,
    "query_past_incidents": query_past_incidents,
}
