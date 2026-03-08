"""
Tool execution handlers — each tool maps to a simulator API call
or a local database operation.

These are called by the executor when an approved decision is executed.
They are NOT called by Claude directly (no more tool_use).
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


def _summarize_timeseries(data: list[dict], metric_keys: list[str]) -> dict:
    """Summarize a large timeseries into stats + recent samples."""
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

    recent = data[-5:] if len(data) > 5 else data
    return {
        "summary": summary,
        "recent_samples": recent,
        "total_points": len(data),
        "time_range": {"start": data[0].get("time"), "end": data[-1].get("time")} if data else {},
    }


async def handle_tool_call(
    tool_name: str, tool_input: dict, **kwargs
) -> str:
    """Execute an action against the simulator. Called by the executor."""
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
    try:
        result = await handler(tool_input)
        return json.dumps(result, default=str)
    except Exception as e:
        logger.exception("tool_execution_error", tool=tool_name, error=str(e))
        return json.dumps({"error": str(e)})


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


async def escalate_to_engineer(params: dict) -> dict:
    """Escalation just logs — no simulator action needed."""
    return {
        "status": "escalated",
        "urgency": params.get("urgency", "medium"),
        "message": "Escalation logged. Engineer notified.",
    }


async def replace_hardware(params: dict) -> dict:
    """Physical task — logged as work order for field team."""
    return {
        "status": "logged",
        "message": f"Hardware replacement work order created: {params.get('component', 'unknown')} on {params.get('device_id', 'unknown')}",
    }


async def dispatch_field_tech(params: dict) -> dict:
    """Physical task — field technician dispatch logged."""
    return {
        "status": "logged",
        "message": f"Field technician dispatch to {params.get('location', 'unknown')}: {params.get('task', '')}",
    }


async def resplice_fiber(params: dict) -> dict:
    """Physical task — fiber re-splice work order created."""
    return {
        "status": "logged",
        "message": f"Fiber re-splice work order for {params.get('link_id', 'unknown')} at {params.get('location', 'unknown')}",
    }


TOOL_HANDLERS = {
    "execute_reroute": execute_reroute,
    "apply_rate_limit": apply_rate_limit,
    "restart_device": restart_device,
    "escalate_to_engineer": escalate_to_engineer,
    "replace_hardware": replace_hardware,
    "dispatch_field_tech": dispatch_field_tech,
    "resplice_fiber": resplice_fiber,
}
