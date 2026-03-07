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


async def handle_tool_call(tool_name: str, tool_input: dict) -> str:
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
    try:
        result = await handler(tool_input)
        return json.dumps(result, default=str)
    except Exception as e:
        logger.exception("tool_execution_error", tool=tool_name)
        return json.dumps({"error": str(e)})


async def query_device_metrics(params: dict) -> dict:
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
    return resp.json()


async def query_link_metrics(params: dict) -> dict:
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
    return resp.json()


async def get_network_topology(params: dict) -> dict:
    client = get_http_client()
    resp = await client.get("/api/v1/topology")
    resp.raise_for_status()
    return resp.json()


async def check_bgp_sessions(params: dict) -> dict:
    client = get_http_client()
    resp = await client.get("/api/v1/topology/bgp-sessions")
    resp.raise_for_status()
    sessions = resp.json()
    device_id = params.get("device_id")
    if device_id:
        sessions = [s for s in sessions if s.get("device_id") == device_id]
    return {"sessions": sessions}


async def get_affected_customers(params: dict) -> dict:
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


async def execute_reroute(params: dict) -> dict:
    client = get_http_client()
    resp = await client.post("/api/v1/actions/reroute", json=params)
    resp.raise_for_status()
    return resp.json()


async def apply_rate_limit(params: dict) -> dict:
    client = get_http_client()
    resp = await client.post("/api/v1/actions/rate-limit", json=params)
    resp.raise_for_status()
    return resp.json()


async def restart_device(params: dict) -> dict:
    client = get_http_client()
    resp = await client.post("/api/v1/actions/device/restart", json=params)
    resp.raise_for_status()
    return resp.json()


async def create_incident(params: dict) -> dict:
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
    return {
        "incident_id": incident_id,
        "status": "created",
        "title": params["title"],
        "severity": params["severity"],
    }


async def escalate_to_engineer(params: dict) -> dict:
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


async def query_past_incidents(params: dict) -> dict:
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
