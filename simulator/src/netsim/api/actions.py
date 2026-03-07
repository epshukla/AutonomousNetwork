from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import structlog

from netsim.core.network_state import network_state
from netsim.core.bgp_simulator import bgp_simulator
from netsim.events import event_bus, CHANNEL_EVENTS

logger = structlog.get_logger()
router = APIRouter(prefix="/api/v1/actions", tags=["actions"])


class RerouteRequest(BaseModel):
    from_link: str
    to_link: str
    reason: str


class RateLimitRequest(BaseModel):
    target: str
    limit_mbps: float
    duration_minutes: int | None = None
    reason: str


class BgpRouteRequest(BaseModel):
    device_id: str
    peer_as: int


class DeviceRestartRequest(BaseModel):
    device_id: str
    reason: str
    graceful: bool = True


class ConfigRollbackRequest(BaseModel):
    device_id: str
    reason: str


@router.post("/reroute")
async def reroute_traffic(req: RerouteRequest):
    from_link = await network_state.get_link(req.from_link)
    to_link = await network_state.get_link(req.to_link)
    if not from_link:
        raise HTTPException(404, f"Link {req.from_link} not found")
    if not to_link:
        raise HTTPException(404, f"Link {req.to_link} not found")

    # Reduce utilization on from_link, increase on to_link
    rerouted_traffic = from_link.utilization_percent * 0.7
    from_link.utilization_modifier -= rerouted_traffic
    to_link.utilization_modifier += rerouted_traffic * 0.8

    await event_bus.publish(CHANNEL_EVENTS, {
        "event_type": "traffic_rerouted",
        "source": "agent_action",
        "severity": "info",
        "description": f"Traffic rerouted from {req.from_link} to {req.to_link}: {req.reason}",
    })

    logger.info("traffic_rerouted", from_link=req.from_link, to_link=req.to_link, reason=req.reason)
    return {"status": "success", "action": "reroute", "from": req.from_link, "to": req.to_link}


@router.post("/rate-limit")
async def apply_rate_limit(req: RateLimitRequest):
    device = await network_state.get_device(req.target)
    link = await network_state.get_link(req.target)
    if not device and not link:
        raise HTTPException(404, f"Target {req.target} not found")

    if device:
        device.rate_limit_mbps = req.limit_mbps
        # Rate limiting reduces effective CPU load from traffic processing
        device.cpu_modifier = max(0, device.cpu_modifier - 10.0)
    if link:
        # Cap utilization
        max_util = (req.limit_mbps / 1000.0) / link.capacity_gbps * 100
        if link.utilization_percent > max_util:
            link.utilization_modifier -= (link.utilization_percent - max_util)

    await event_bus.publish(CHANNEL_EVENTS, {
        "event_type": "rate_limit_applied",
        "source": "agent_action",
        "severity": "info",
        "description": f"Rate limit {req.limit_mbps}Mbps applied to {req.target}: {req.reason}",
    })

    logger.info("rate_limit_applied", target=req.target, limit_mbps=req.limit_mbps)
    return {"status": "success", "action": "rate_limit", "target": req.target, "limit_mbps": req.limit_mbps}


@router.post("/bgp/withdraw")
async def withdraw_bgp_route(req: BgpRouteRequest):
    success = await bgp_simulator.withdraw_route(req.device_id, req.peer_as)
    if not success:
        raise HTTPException(404, f"BGP session not found for {req.device_id} AS{req.peer_as}")

    await event_bus.publish(CHANNEL_EVENTS, {
        "event_type": "bgp_withdraw",
        "source": "agent_action",
        "severity": "warning",
        "description": f"BGP route withdrawn on {req.device_id} for AS{req.peer_as}",
    })
    return {"status": "success", "action": "bgp_withdraw", "device_id": req.device_id, "peer_as": req.peer_as}


@router.post("/bgp/announce")
async def announce_bgp_route(req: BgpRouteRequest):
    success = await bgp_simulator.announce_route(req.device_id, req.peer_as)
    if not success:
        raise HTTPException(404, f"BGP session not found for {req.device_id} AS{req.peer_as}")

    await event_bus.publish(CHANNEL_EVENTS, {
        "event_type": "bgp_announce",
        "source": "agent_action",
        "severity": "info",
        "description": f"BGP route announced on {req.device_id} for AS{req.peer_as}",
    })
    return {"status": "success", "action": "bgp_announce", "device_id": req.device_id, "peer_as": req.peer_as}


@router.post("/device/restart")
async def restart_device(req: DeviceRestartRequest):
    success = await network_state.restart_device(req.device_id)
    if not success:
        raise HTTPException(404, f"Device {req.device_id} not found")

    # Also restore connected links
    links = await network_state.get_links_for_device(req.device_id)
    for link in links:
        link.forced_down = False
        link.utilization_modifier = 0
        link.latency_modifier = 0
        link.loss_modifier = 0

    await event_bus.publish(CHANNEL_EVENTS, {
        "event_type": "device_restarted",
        "source": "agent_action",
        "severity": "info",
        "description": f"Device {req.device_id} restarted: {req.reason}",
    })
    return {"status": "success", "action": "restart", "device_id": req.device_id}


@router.post("/config/rollback")
async def rollback_config(req: ConfigRollbackRequest):
    device = await network_state.get_device(req.device_id)
    if not device:
        raise HTTPException(404, f"Device {req.device_id} not found")

    # Reset all modifiers to baseline
    device.cpu_modifier = 0
    device.memory_modifier = 0
    device.temp_modifier = 0
    device.rate_limit_mbps = None

    links = await network_state.get_links_for_device(req.device_id)
    for link in links:
        link.utilization_modifier = 0
        link.latency_modifier = 0
        link.loss_modifier = 0

    await event_bus.publish(CHANNEL_EVENTS, {
        "event_type": "config_rollback",
        "source": "agent_action",
        "severity": "info",
        "description": f"Config rolled back on {req.device_id}: {req.reason}",
    })
    return {"status": "success", "action": "config_rollback", "device_id": req.device_id}
