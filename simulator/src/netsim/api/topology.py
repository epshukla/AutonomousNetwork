from fastapi import APIRouter, HTTPException

from netsim.core.network_state import network_state
from netsim.core.bgp_simulator import bgp_simulator

router = APIRouter(prefix="/api/v1/topology", tags=["topology"])


@router.get("")
async def get_topology():
    return await network_state.get_topology_snapshot()


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
    }


@router.get("/bgp-sessions")
async def get_bgp_sessions():
    return await bgp_simulator.get_sessions()
