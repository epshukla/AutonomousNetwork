from fastapi import APIRouter, HTTPException

from netsim.core.network_state import network_state
from netsim.core.bgp_simulator import bgp_simulator
from netsim.chaos.engine import chaos_engine
from netsim.chaos.scenarios import SCENARIOS

router = APIRouter(prefix="/api/v1/topology", tags=["topology"])


@router.get("")
async def get_topology():
    snapshot = await network_state.get_topology_snapshot()
    active = chaos_engine.get_active()

    # Build per-device and per-link chaos overlay
    device_chaos: dict[str, list] = {}
    link_chaos: dict[str, list] = {}

    for entry in active:
        scenario_name = entry["scenario"]
        scenario_def = SCENARIOS.get(scenario_name)
        if not scenario_def:
            continue
        params = entry.get("params", scenario_def.default_params)
        info = {
            "scenario": scenario_name,
            "display_name": scenario_def.display_name,
            "severity": scenario_def.severity,
        }

        if "link_id" in params:
            link_chaos.setdefault(params["link_id"], []).append(info)
        if "initial_link" in params:
            link_chaos.setdefault(params["initial_link"], []).append(info)
        if "device_id" in params or "target_device" in params:
            did = params.get("device_id") or params.get("target_device")
            device_chaos.setdefault(did, []).append(info)

    for did, dev in snapshot.get("devices", {}).items():
        dev["active_chaos"] = device_chaos.get(did, [])
    for lid, link in snapshot.get("links", {}).items():
        link["active_chaos"] = link_chaos.get(lid, [])

    snapshot["active_chaos"] = [
        {
            "scenario": e["scenario"],
            "display_name": SCENARIOS[e["scenario"]].display_name,
            "severity": SCENARIOS[e["scenario"]].severity,
            "params": e.get("params", {}),
        }
        for e in active
        if e["scenario"] in SCENARIOS
    ]
    return snapshot


@router.get("/devices")
async def get_devices():
    devices = await network_state.get_all_devices()
    return {
        did: {
            "device_id": d.device_id,
            "type": d.device_type,
            "city": d.city,
            "region": d.region,
            "peer_as": d.peer_as,
            "peer_name": d.peer_name,
            "status": d.status.value,
            "cpu_utilization": round(d.cpu_utilization, 2),
            "memory_utilization": round(d.memory_utilization, 2),
            "temperature_celsius": round(d.temperature_celsius, 2),
            "uptime_seconds": d.uptime_seconds,
            "vendor": d.vendor,
            "model": d.model,
            "interfaces": d.interfaces,
            "subscribers": d.subscribers,
            "pon_ports": d.pon_ports,
            "cpu_cores": d.cpu_cores,
            "memory_gb": d.memory_gb,
            "power_status": d.power_status,
            "fan_status": d.fan_status,
            "psu_count": d.psu_count,
            "psu_active": d.psu_active,
            "fan_count": d.fan_count,
            "fan_active": d.fan_active,
        }
        for did, d in devices.items()
    }


@router.get("/devices/{device_id}")
async def get_device(device_id: str):
    device = await network_state.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    return {
        "device_id": device.device_id,
        "type": device.device_type,
        "city": device.city,
        "region": device.region,
        "peer_as": device.peer_as,
        "peer_name": device.peer_name,
        "status": device.status.value,
        "cpu_utilization": round(device.cpu_utilization, 2),
        "memory_utilization": round(device.memory_utilization, 2),
        "temperature_celsius": round(device.temperature_celsius, 2),
        "uptime_seconds": device.uptime_seconds,
        "rate_limit_mbps": device.rate_limit_mbps,
        "vendor": device.vendor,
        "model": device.model,
        "interfaces": device.interfaces,
        "subscribers": device.subscribers,
        "pon_ports": device.pon_ports,
        "cpu_cores": device.cpu_cores,
        "memory_gb": device.memory_gb,
        "power_status": device.power_status,
        "fan_status": device.fan_status,
        "psu_count": device.psu_count,
        "psu_active": device.psu_active,
        "fan_count": device.fan_count,
        "fan_active": device.fan_active,
    }


@router.get("/links")
async def get_links():
    links = await network_state.get_all_links()
    return {
        lid: {
            "link_id": link.link_id,
            "from": link.from_device,
            "to": link.to_device,
            "type": link.link_type,
            "capacity_gbps": link.capacity_gbps,
            "status": link.status.value,
            "utilization_percent": round(link.utilization_percent, 2),
            "throughput_gbps": round(link.throughput_gbps, 3),
            "latency_ms": round(link.latency_ms, 3),
            "packet_loss_percent": round(link.packet_loss_percent, 4),
            "interface_from": link.interface_from,
            "interface_to": link.interface_to,
        }
        for lid, link in links.items()
    }


@router.get("/links/{link_id}")
async def get_link(link_id: str):
    link = await network_state.get_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail=f"Link {link_id} not found")
    return {
        "link_id": link.link_id,
        "from": link.from_device,
        "to": link.to_device,
        "type": link.link_type,
        "capacity_gbps": link.capacity_gbps,
        "base_latency_ms": link.base_latency_ms,
        "status": link.status.value,
        "utilization_percent": round(link.utilization_percent, 2),
        "throughput_gbps": round(link.throughput_gbps, 3),
        "latency_ms": round(link.latency_ms, 3),
        "packet_loss_percent": round(link.packet_loss_percent, 4),
        "errors_in": link.errors_in,
        "errors_out": link.errors_out,
        "interface_from": link.interface_from,
        "interface_to": link.interface_to,
    }


@router.get("/bgp-sessions")
async def get_bgp_sessions():
    return await bgp_simulator.get_sessions()
