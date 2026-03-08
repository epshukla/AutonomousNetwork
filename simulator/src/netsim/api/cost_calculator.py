"""
Indian ISP outage cost calculator.

Cost model based on TRAI/industry data — computes revenue loss,
SLA penalties, and operational costs for network outages.
"""

from __future__ import annotations

import math

from netsim.config.topology import TOPOLOGY

COST_MODEL = {
    "subscriber_arpu_monthly": 183,        # INR — TRAI average
    "enterprise_arpu_monthly": 45000,      # INR
    "peering_cost_per_mbps": 0.5,          # INR — NIXI
    "transit_cost_per_mbps": 80,           # INR — international
    "sla_penalty_per_hour": 50000,         # INR — SLA breach penalty
    "noc_staff_per_hour": 2500,            # INR — NOC engineer
    "power_per_device_hour": 150,          # INR — per device
}

# OLT subscriber counts from topology
_OLT_SUBSCRIBERS: dict[str, int] = {
    did: cfg["subscribers"]
    for did, cfg in TOPOLOGY["devices"].items()
    if cfg.get("subscribers")
}

# Customer distribution by city
_CUSTOMER_DIST = TOPOLOGY["customer_distribution"]


async def calculate_outage_cost(
    killed_devices: list[str],
    killed_links: list[str],
    duration_seconds: float,
    network_state,
) -> dict:
    """Calculate the financial impact of an outage."""
    affected_subscribers = 0
    affected_olts: set[str] = set()

    # Direct OLT kills
    for did in killed_devices:
        if did in _OLT_SUBSCRIBERS:
            affected_olts.add(did)

    # Trace downstream from non-OLT killed devices to find cut-off OLTs
    for did in killed_devices:
        if did in _OLT_SUBSCRIBERS:
            continue
        await _trace_downstream_olts(did, killed_devices, killed_links, network_state, affected_olts)

    # Check killed links — if an OLT's only uplink is killed, it's cut off
    for lid in killed_links:
        link = await network_state.get_link(lid)
        if not link:
            continue
        for endpoint in (link.from_device, link.to_device):
            if endpoint in _OLT_SUBSCRIBERS:
                affected_olts.add(endpoint)

    for olt_id in affected_olts:
        affected_subscribers += _OLT_SUBSCRIBERS.get(olt_id, 0)

    # Revenue loss calculation
    total_subs = sum(c["total"] for c in _CUSTOMER_DIST.values())
    total_enterprise = sum(c["enterprise"] for c in _CUSTOMER_DIST.values())
    enterprise_ratio = total_enterprise / max(total_subs, 1)
    residential_ratio = 1 - enterprise_ratio

    enterprise_affected = int(affected_subscribers * enterprise_ratio)
    residential_affected = affected_subscribers - enterprise_affected

    seconds_in_month = 30 * 24 * 3600
    revenue_per_second = (
        residential_affected * COST_MODEL["subscriber_arpu_monthly"] / seconds_in_month
        + enterprise_affected * COST_MODEL["enterprise_arpu_monthly"] / seconds_in_month
    )
    revenue_loss = revenue_per_second * duration_seconds

    # SLA penalty — kicks in after 1 hour
    sla_penalty = 0.0
    if duration_seconds > 3600:
        hours = math.ceil(duration_seconds / 3600)
        sla_penalty = COST_MODEL["sla_penalty_per_hour"] * hours

    # Operational cost
    hours_ceil = max(1, math.ceil(duration_seconds / 3600))
    operational_cost = (
        COST_MODEL["noc_staff_per_hour"] * hours_ceil * 2  # 2 NOC engineers
        + COST_MODEL["power_per_device_hour"] * len(killed_devices) * hours_ceil
    )

    total_cost = revenue_loss + sla_penalty + operational_cost
    cost_per_second = revenue_per_second + (sla_penalty + operational_cost) / max(duration_seconds, 1)

    return {
        "total_cost": round(total_cost, 2),
        "revenue_loss": round(revenue_loss, 2),
        "sla_penalty": round(sla_penalty, 2),
        "operational_cost": round(operational_cost, 2),
        "affected_subscribers": affected_subscribers,
        "cost_per_second": round(cost_per_second, 2),
        "duration_seconds": round(duration_seconds, 1),
    }


async def _trace_downstream_olts(
    device_id: str,
    killed_devices: list[str],
    killed_links: list[str],
    network_state,
    affected_olts: set[str],
    visited: set[str] | None = None,
):
    """Walk downstream from a killed device to find cut-off OLTs."""
    if visited is None:
        visited = set()
    if device_id in visited:
        return
    visited.add(device_id)

    links = await network_state.get_links_for_device(device_id)
    for link in links:
        # Only walk downstream (away from killed device)
        neighbor = link.to_device if link.from_device == device_id else link.from_device
        if neighbor in visited:
            continue

        # Check if this neighbor is an OLT
        if neighbor in _OLT_SUBSCRIBERS:
            # OLT is cut off if the device connecting to it is killed
            affected_olts.add(neighbor)
        elif neighbor not in killed_devices:
            # Don't recurse through non-killed devices — they can still serve
            continue
        else:
            await _trace_downstream_olts(
                neighbor, killed_devices, killed_links, network_state, affected_olts, visited
            )
