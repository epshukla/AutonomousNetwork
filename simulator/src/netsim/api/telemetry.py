from datetime import datetime, timezone, timedelta

import numpy as np
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from netsim.core.network_state import network_state
from netsim.db.engine import async_session

router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry"])


def parse_interval(s: str) -> timedelta:
    """Convert interval string like '5s', '1m', '5m', '1h' to timedelta."""
    s = s.strip().lower()
    if s.endswith("s"):
        return timedelta(seconds=int(s[:-1]))
    if s.endswith("m"):
        return timedelta(minutes=int(s[:-1]))
    if s.endswith("h"):
        return timedelta(hours=int(s[:-1]))
    return timedelta(seconds=5)


@router.get("/devices/{device_id}")
async def get_device_telemetry(
    device_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
    interval: str = Query(default="5s", description="Bucket interval: 5s, 1m, 5m, 1h"),
):
    device = await network_state.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")

    if not end:
        end = datetime.now(timezone.utc)
    if not start:
        start = end - timedelta(minutes=30)

    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT time_bucket(:interval, time) AS bucket, "
                "avg(cpu_utilization) AS cpu_utilization, "
                "avg(memory_utilization) AS memory_utilization, "
                "avg(temperature_celsius) AS temperature_celsius, "
                "last(status, time) AS status "
                "FROM device_metrics "
                "WHERE device_id = :device_id AND time >= :start AND time <= :end "
                "GROUP BY bucket ORDER BY bucket"
            ),
            {
                "interval": parse_interval(interval),
                "device_id": device_id,
                "start": start,
                "end": end,
            },
        )
        rows = result.fetchall()

    return {
        "device_id": device_id,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "interval": interval,
        "data": [
            {
                "time": row.bucket.isoformat(),
                "cpu_utilization": round(row.cpu_utilization, 2) if row.cpu_utilization else None,
                "memory_utilization": round(row.memory_utilization, 2) if row.memory_utilization else None,
                "temperature_celsius": round(row.temperature_celsius, 2) if row.temperature_celsius else None,
                "status": row.status,
            }
            for row in rows
        ],
    }


@router.get("/links/{link_id}")
async def get_link_telemetry(
    link_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
    interval: str = Query(default="5s", description="Bucket interval"),
):
    link = await network_state.get_link(link_id)
    if not link:
        raise HTTPException(status_code=404, detail=f"Link {link_id} not found")

    if not end:
        end = datetime.now(timezone.utc)
    if not start:
        start = end - timedelta(minutes=30)

    async with async_session() as session:
        result = await session.execute(
            text(
                "SELECT time_bucket(:interval, time) AS bucket, "
                "avg(utilization_percent) AS utilization_percent, "
                "avg(throughput_gbps) AS throughput_gbps, "
                "avg(latency_ms) AS latency_ms, "
                "avg(packet_loss_percent) AS packet_loss_percent, "
                "sum(errors_in) AS errors_in, "
                "sum(errors_out) AS errors_out, "
                "last(status, time) AS status "
                "FROM link_metrics "
                "WHERE link_id = :link_id AND time >= :start AND time <= :end "
                "GROUP BY bucket ORDER BY bucket"
            ),
            {
                "interval": parse_interval(interval),
                "link_id": link_id,
                "start": start,
                "end": end,
            },
        )
        rows = result.fetchall()

    return {
        "link_id": link_id,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "interval": interval,
        "data": [
            {
                "time": row.bucket.isoformat(),
                "utilization_percent": round(row.utilization_percent, 2) if row.utilization_percent else None,
                "throughput_gbps": round(row.throughput_gbps, 3) if row.throughput_gbps else None,
                "latency_ms": round(row.latency_ms, 3) if row.latency_ms else None,
                "packet_loss_percent": round(row.packet_loss_percent, 4) if row.packet_loss_percent else None,
                "errors_in": int(row.errors_in) if row.errors_in else 0,
                "errors_out": int(row.errors_out) if row.errors_out else 0,
                "status": row.status,
            }
            for row in rows
        ],
    }


@router.get("/traffic-analytics")
async def get_traffic_analytics():
    """Simulated NetFlow-style traffic analytics."""
    links = await network_state.get_all_links()
    total_throughput = sum(l.throughput_gbps for l in links.values())

    # Protocol split with slight noise
    protocol_base = {
        "HTTPS": 0.62,
        "HTTP": 0.12,
        "DNS": 0.085,
        "SSH": 0.032,
        "Other": 0.143,
    }
    protocols = {}
    for proto, ratio in protocol_base.items():
        noisy_ratio = ratio + np.random.normal(0, 0.005)
        protocols[proto] = round(total_throughput * max(0, noisy_ratio), 3)

    # Top destinations scaled by actual total traffic
    dest_base = {
        "Google": 0.28,
        "Cloudflare": 0.18,
        "Amazon": 0.15,
        "Microsoft": 0.12,
        "Meta": 0.10,
        "Other": 0.17,
    }
    destinations = {}
    for dest, ratio in dest_base.items():
        noisy_ratio = ratio + np.random.normal(0, 0.008)
        destinations[dest] = round(total_throughput * max(0, noisy_ratio), 3)

    # Per-link breakdown
    link_traffic = []
    for link in links.values():
        link_traffic.append({
            "link_id": link.link_id,
            "type": link.link_type,
            "throughput_gbps": round(link.throughput_gbps, 3),
            "utilization_percent": round(link.utilization_percent, 2),
        })

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_traffic_gbps": round(total_throughput, 3),
        "protocol_breakdown_gbps": protocols,
        "destination_breakdown_gbps": destinations,
        "link_traffic": sorted(link_traffic, key=lambda x: x["throughput_gbps"], reverse=True),
    }


@router.get("/overview")
async def get_telemetry_overview():
    devices = await network_state.get_all_devices()
    links = await network_state.get_all_links()

    total_throughput = sum(l.throughput_gbps for l in links.values())
    avg_latency = (
        sum(l.latency_ms for l in links.values() if l.status != "down")
        / max(1, sum(1 for l in links.values() if l.status != "down"))
    )
    avg_util = (
        sum(l.utilization_percent for l in links.values())
        / max(1, len(links))
    )
    avg_cpu = (
        sum(d.cpu_utilization for d in devices.values())
        / max(1, len(devices))
    )
    avg_memory = (
        sum(d.memory_utilization for d in devices.values())
        / max(1, len(devices))
    )
    avg_packet_loss = (
        sum(l.packet_loss_percent for l in links.values())
        / max(1, len(links))
    )

    device_status_counts = {}
    for d in devices.values():
        device_status_counts[d.status.value] = device_status_counts.get(d.status.value, 0) + 1

    link_status_counts = {}
    for l in links.values():
        link_status_counts[l.status.value] = link_status_counts.get(l.status.value, 0) + 1

    # Health score: 100 if all healthy/up, decreases with degradation
    healthy_devices = sum(1 for d in devices.values() if d.status.value == "healthy")
    up_links = sum(1 for l in links.values() if l.status.value == "up")
    health_score = int(
        (healthy_devices / max(1, len(devices)) * 50)
        + (up_links / max(1, len(links)) * 50)
    )

    return {
        "health_score": health_score,
        "total_throughput_gbps": round(total_throughput, 2),
        "avg_latency_ms": round(avg_latency, 3),
        "avg_utilization_percent": round(avg_util, 2),
        "avg_cpu_percent": round(avg_cpu, 2),
        "avg_memory_percent": round(avg_memory, 2),
        "avg_packet_loss_percent": round(avg_packet_loss, 4),
        "device_count": len(devices),
        "link_count": len(links),
        "device_status": device_status_counts,
        "link_status": link_status_counts,
    }
