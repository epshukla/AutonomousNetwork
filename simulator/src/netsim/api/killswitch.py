"""
Kill Switch API — manual device/link kill and restore with routing analysis.

Allows operators to manually bring down devices or links, independent of
the chaos engine, and see backup path rerouting + cost impact in real time.
"""

from __future__ import annotations

import json
import time
from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from netsim.core.network_state import network_state
from netsim.events import event_bus, CHANNEL_EVENTS
from netsim.models.enums import DeviceStatus, LinkStatus
from netsim.api.cost_calculator import calculate_outage_cost

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1/killswitch", tags=["killswitch"])

# ── Backup path map ───────────────────────────────────────────────────────

BACKUP_PATHS: dict[str, dict] = {
    # Inter-city backbone redundancy
    "link-del-mum-primary": {
        "backup_link": "link-del-mum-backup",
        "description": "Backup backbone via Core-Delhi-2 to Core-Mumbai-2",
        "hop_increase": 0,
        "latency_increase_ms": 2.0,
    },
    "link-del-mum-backup": {
        "backup_link": "link-del-mum-primary",
        "description": "Primary backbone via Core-Delhi-1 to Core-Mumbai-1",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
    # Delhi core-to-edge redundancy
    "link-del-c1-en": {
        "backup_link": "link-del-c2-en",
        "description": "Via Core-Delhi-2 to Edge-Delhi-North",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
    "link-del-c2-en": {
        "backup_link": "link-del-c1-en",
        "description": "Via Core-Delhi-1 to Edge-Delhi-North",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
    "link-del-c1-es": {
        "backup_link": "link-del-c2-es",
        "description": "Via Core-Delhi-2 to Edge-Delhi-South",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
    "link-del-c2-es": {
        "backup_link": "link-del-c1-es",
        "description": "Via Core-Delhi-1 to Edge-Delhi-South",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
    # Mumbai core-to-edge redundancy
    "link-mum-c1-ec": {
        "backup_link": "link-mum-c2-ec",
        "description": "Via Core-Mumbai-2 to Edge-Mumbai-Central",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
    "link-mum-c2-ec": {
        "backup_link": "link-mum-c1-ec",
        "description": "Via Core-Mumbai-1 to Edge-Mumbai-Central",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
    "link-mum-c1-eh": {
        "backup_link": "link-mum-c2-eh",
        "description": "Via Core-Mumbai-2 to Edge-Mumbai-Harbor",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
    "link-mum-c2-eh": {
        "backup_link": "link-mum-c1-eh",
        "description": "Via Core-Mumbai-1 to Edge-Mumbai-Harbor",
        "hop_increase": 0,
        "latency_increase_ms": 0.0,
    },
}

# ── Module state ──────────────────────────────────────────────────────────

_kill_state: dict[str, dict] = {
    "killed_devices": {},
    "killed_links": {},
}


# ── Request / helpers ─────────────────────────────────────────────────────

class KillRequest(BaseModel):
    target_type: Literal["device", "link"]
    target_id: str


async def _emit_event(event_type: str, target: str, severity: str, description: str, metadata: dict | None = None):
    """Emit event to Redis + persist to DB (same pattern as effects.py)."""
    from netsim.db.engine import async_session
    from sqlalchemy import text

    event = {
        "event_type": event_type,
        "source": "killswitch",
        "severity": severity,
        "description": description,
        "metadata": metadata or {},
    }
    await event_bus.publish(CHANNEL_EVENTS, event)

    try:
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text(
                        "INSERT INTO network_events (event_type, source, severity, description, metadata) "
                        "VALUES (:event_type, :source, :severity, :description, CAST(:metadata AS jsonb))"
                    ),
                    {
                        "event_type": event_type,
                        "source": "killswitch",
                        "severity": severity,
                        "description": description,
                        "metadata": json.dumps(metadata or {}),
                    },
                )
    except Exception:
        logger.exception("killswitch_event_persist_failed")


def _analyze_routing() -> dict:
    """Analyze routing efficiency based on current kill state."""
    all_links = network_state.links
    total = len(all_links)
    healthy = 0
    rerouted = 0
    broken = 0
    latency_increases: list[float] = []

    all_killed_links = set(_kill_state["killed_links"].keys())
    for dev_info in _kill_state["killed_devices"].values():
        all_killed_links.update(dev_info.get("affected_links", []))

    for link_id, link in all_links.items():
        if link_id in all_killed_links or link.forced_down:
            # This link is down — check for backup
            bp = BACKUP_PATHS.get(link_id)
            if bp:
                backup_link = all_links.get(bp["backup_link"])
                if backup_link and not backup_link.forced_down and bp["backup_link"] not in all_killed_links:
                    rerouted += 1
                    latency_increases.append(bp["latency_increase_ms"])
                else:
                    broken += 1
            else:
                broken += 1
        else:
            healthy += 1

    efficiency = (healthy / max(total, 1)) * 100
    avg_latency = sum(latency_increases) / max(len(latency_increases), 1) if latency_increases else 0.0

    return {
        "efficiency_percent": round(efficiency, 1),
        "total_paths": total,
        "healthy_paths": healthy,
        "rerouted_paths": rerouted,
        "broken_paths": broken,
        "avg_latency_increase_ms": round(avg_latency, 1),
    }


def _get_active_backup_paths() -> list[dict]:
    """Return backup paths that are currently active."""
    all_links = network_state.links
    all_killed_links = set(_kill_state["killed_links"].keys())
    for dev_info in _kill_state["killed_devices"].values():
        all_killed_links.update(dev_info.get("affected_links", []))

    active_paths = []
    for link_id in all_killed_links:
        bp = BACKUP_PATHS.get(link_id)
        if not bp:
            continue
        backup_link = all_links.get(bp["backup_link"])
        if backup_link and not backup_link.forced_down and bp["backup_link"] not in all_killed_links:
            status = "active"
        else:
            status = "unavailable"
        active_paths.append({
            "original_link": link_id,
            "backup_link": bp["backup_link"],
            "description": bp["description"],
            "status": status,
            "hop_increase": bp["hop_increase"],
            "latency_increase_ms": bp["latency_increase_ms"],
        })
    return active_paths


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/kill")
async def kill_target(req: KillRequest):
    """Kill a device or link manually."""
    now = time.time()

    if req.target_type == "device":
        device = await network_state.get_device(req.target_id)
        if not device:
            raise HTTPException(404, f"Device {req.target_id} not found")
        if req.target_id in _kill_state["killed_devices"]:
            raise HTTPException(409, f"Device {req.target_id} is already killed")

        # Kill the device
        device.status = DeviceStatus.DOWN
        device.cpu_modifier = 0
        device.memory_modifier = 0

        # Kill all connected links
        links = await network_state.get_links_for_device(req.target_id)
        affected_links = []
        for link in links:
            link.forced_down = True
            link.status = LinkStatus.DOWN
            affected_links.append(link.link_id)

        _kill_state["killed_devices"][req.target_id] = {
            "killed_at": now,
            "affected_links": affected_links,
        }

        # Activate backup paths — increase utilization on backups
        for lid in affected_links:
            bp = BACKUP_PATHS.get(lid)
            if bp:
                backup = await network_state.get_link(bp["backup_link"])
                if backup and not backup.forced_down:
                    backup.utilization_modifier += 25.0

        await _emit_event(
            "killswitch_kill", req.target_id, "critical",
            f"Device {req.target_id} manually killed — {len(affected_links)} links DOWN",
            {"target_type": "device", "target_id": req.target_id, "affected_links": affected_links},
        )

        return {
            "success": True,
            "target": {"target_type": "device", "target_id": req.target_id},
            "affected_links": affected_links,
            "backup_paths": _get_active_backup_paths(),
            "routing_analysis": _analyze_routing(),
        }

    else:  # link
        link = await network_state.get_link(req.target_id)
        if not link:
            raise HTTPException(404, f"Link {req.target_id} not found")
        if req.target_id in _kill_state["killed_links"]:
            raise HTTPException(409, f"Link {req.target_id} is already killed")

        link.forced_down = True
        link.status = LinkStatus.DOWN

        _kill_state["killed_links"][req.target_id] = {"killed_at": now}

        # Activate backup
        bp = BACKUP_PATHS.get(req.target_id)
        if bp:
            backup = await network_state.get_link(bp["backup_link"])
            if backup and not backup.forced_down:
                backup.utilization_modifier += 25.0

        await _emit_event(
            "killswitch_kill", req.target_id, "critical",
            f"Link {req.target_id} manually killed",
            {"target_type": "link", "target_id": req.target_id},
        )

        return {
            "success": True,
            "target": {"target_type": "link", "target_id": req.target_id},
            "affected_links": [req.target_id],
            "backup_paths": _get_active_backup_paths(),
            "routing_analysis": _analyze_routing(),
        }


@router.post("/restore")
async def restore_target(req: KillRequest):
    """Restore a manually killed device or link."""
    # Check if chaos engine has active scenarios affecting this target
    from netsim.chaos.engine import chaos_engine
    active_chaos = chaos_engine.get_active()

    if req.target_type == "device":
        if req.target_id not in _kill_state["killed_devices"]:
            raise HTTPException(404, f"Device {req.target_id} is not in killed state")

        kill_info = _kill_state["killed_devices"].pop(req.target_id)
        affected_links = kill_info.get("affected_links", [])

        # Restore device
        await network_state.restart_device(req.target_id)

        # Restore connected links (skip if chaos is still affecting them)
        restored_links = []
        chaos_affected_links = set()
        for scenario in active_chaos:
            params = scenario.get("params", {})
            if params.get("link_id"):
                chaos_affected_links.add(params["link_id"])

        for lid in affected_links:
            if lid in chaos_affected_links:
                continue
            link = await network_state.get_link(lid)
            if link:
                link.forced_down = False
                link.status = LinkStatus.UP
                link.utilization_modifier = max(0, link.utilization_modifier)
                link.latency_modifier = 0.0
                link.loss_modifier = 0.0
                restored_links.append(lid)

            # Reduce backup utilization
            bp = BACKUP_PATHS.get(lid)
            if bp:
                backup = await network_state.get_link(bp["backup_link"])
                if backup:
                    backup.utilization_modifier = max(0, backup.utilization_modifier - 25.0)

        await _emit_event(
            "killswitch_restore", req.target_id, "info",
            f"Device {req.target_id} restored — {len(restored_links)} links UP",
            {"target_type": "device", "target_id": req.target_id, "restored_links": restored_links},
        )

        return {
            "success": True,
            "target": {"target_type": "device", "target_id": req.target_id},
            "restored_links": restored_links,
        }

    else:  # link
        if req.target_id not in _kill_state["killed_links"]:
            raise HTTPException(404, f"Link {req.target_id} is not in killed state")

        _kill_state["killed_links"].pop(req.target_id)

        link = await network_state.get_link(req.target_id)
        if link:
            link.forced_down = False
            link.status = LinkStatus.UP
            link.utilization_modifier = 0.0
            link.latency_modifier = 0.0
            link.loss_modifier = 0.0

        # Reduce backup utilization
        bp = BACKUP_PATHS.get(req.target_id)
        if bp:
            backup = await network_state.get_link(bp["backup_link"])
            if backup:
                backup.utilization_modifier = max(0, backup.utilization_modifier - 25.0)

        await _emit_event(
            "killswitch_restore", req.target_id, "info",
            f"Link {req.target_id} restored",
            {"target_type": "link", "target_id": req.target_id},
        )

        return {
            "success": True,
            "target": {"target_type": "link", "target_id": req.target_id},
            "restored_links": [req.target_id],
        }


@router.get("/status")
async def get_status():
    """Get current kill switch state with routing analysis and cost impact."""
    killed_devices = list(_kill_state["killed_devices"].keys())
    killed_links = list(_kill_state["killed_links"].keys())

    # Calculate duration from earliest kill
    now = time.time()
    kill_times = []
    for info in _kill_state["killed_devices"].values():
        kill_times.append(info["killed_at"])
    for info in _kill_state["killed_links"].values():
        kill_times.append(info["killed_at"])

    duration = (now - min(kill_times)) if kill_times else 0.0

    # All affected links (from device kills + direct link kills)
    all_affected = set(killed_links)
    for info in _kill_state["killed_devices"].values():
        all_affected.update(info.get("affected_links", []))

    cost_impact = await calculate_outage_cost(
        killed_devices, list(all_affected), duration, network_state
    )

    # Build kill_details
    kill_details = {}
    for did, info in _kill_state["killed_devices"].items():
        kill_details[did] = {
            "killed_at": info["killed_at"],
            "affected_links": info.get("affected_links", []),
        }
    for lid, info in _kill_state["killed_links"].items():
        kill_details[lid] = {"killed_at": info["killed_at"]}

    return {
        "killed_devices": killed_devices,
        "killed_links": killed_links,
        "kill_details": kill_details,
        "routing_efficiency": _analyze_routing(),
        "cost_impact": cost_impact,
        "backup_paths": _get_active_backup_paths(),
    }
