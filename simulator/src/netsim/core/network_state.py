"""
In-memory network state — the single source of truth for all devices,
links, and BGP sessions. Chaos scenarios modify this state, and the
telemetry engine reads from it to generate realistic metrics.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import structlog

from netsim.config.topology import TOPOLOGY
from netsim.models.enums import DeviceStatus, LinkStatus, BgpSessionStatus

logger = structlog.get_logger()


@dataclass
class DeviceState:
    device_id: str
    device_type: str
    city: str
    cpu_cores: int
    memory_gb: int
    region: str | None = None
    peer_as: int | None = None
    peer_name: str | None = None
    # Mutable runtime state
    status: DeviceStatus = DeviceStatus.HEALTHY
    cpu_utilization: float = 0.0
    memory_utilization: float = 0.0
    temperature_celsius: float = 35.0
    uptime_seconds: int = 0
    # Chaos modifiers (additive)
    cpu_modifier: float = 0.0
    memory_modifier: float = 0.0
    temp_modifier: float = 0.0
    # Rate limiting
    rate_limit_mbps: float | None = None
    boot_time: float = field(default_factory=time.time)


@dataclass
class LinkState:
    link_id: str
    from_device: str
    to_device: str
    capacity_gbps: float
    base_latency_ms: float
    link_type: str
    # Mutable runtime state
    status: LinkStatus = LinkStatus.UP
    utilization_percent: float = 0.0
    throughput_gbps: float = 0.0
    latency_ms: float = 0.0
    packet_loss_percent: float = 0.0
    errors_in: int = 0
    errors_out: int = 0
    # Chaos modifiers
    latency_modifier: float = 0.0
    loss_modifier: float = 0.0
    utilization_modifier: float = 0.0
    forced_down: bool = False


@dataclass
class BgpSessionState:
    device_id: str
    peer_as: int
    peer_name: str
    prefixes_received: int
    status: BgpSessionStatus = BgpSessionStatus.ESTABLISHED
    flap_count: int = 0
    last_flap_time: float | None = None
    # Chaos modifiers
    leaked_prefixes: int = 0
    forced_down: bool = False


class NetworkState:
    """Thread-safe in-memory network state."""

    def __init__(self):
        self._lock = asyncio.Lock()
        self.devices: dict[str, DeviceState] = {}
        self.links: dict[str, LinkState] = {}
        self.bgp_sessions: dict[str, BgpSessionState] = {}
        self._start_time = time.time()

    async def initialize(self):
        async with self._lock:
            # Initialize devices
            for device_id, config in TOPOLOGY["devices"].items():
                self.devices[device_id] = DeviceState(
                    device_id=device_id,
                    device_type=config["type"],
                    city=config["city"],
                    cpu_cores=config.get("cpu_cores", 4),
                    memory_gb=config.get("memory_gb", 16),
                    region=config.get("region"),
                    peer_as=config.get("peer_as"),
                    peer_name=config.get("peer_name"),
                )

            # Initialize links
            for link_config in TOPOLOGY["links"]:
                self.links[link_config["id"]] = LinkState(
                    link_id=link_config["id"],
                    from_device=link_config["from"],
                    to_device=link_config["to"],
                    capacity_gbps=link_config["capacity_gbps"],
                    base_latency_ms=link_config["base_latency_ms"],
                    link_type=link_config["type"],
                    latency_ms=link_config["base_latency_ms"],
                )

            # Initialize BGP sessions
            for bgp_config in TOPOLOGY["bgp_sessions"]:
                key = f"{bgp_config['device']}-AS{bgp_config['peer_as']}"
                self.bgp_sessions[key] = BgpSessionState(
                    device_id=bgp_config["device"],
                    peer_as=bgp_config["peer_as"],
                    peer_name=bgp_config["peer_name"],
                    prefixes_received=bgp_config["prefixes_received"],
                    status=BgpSessionStatus(bgp_config["status"]),
                )

            logger.info(
                "network_state_initialized",
                devices=len(self.devices),
                links=len(self.links),
                bgp_sessions=len(self.bgp_sessions),
            )

    async def get_device(self, device_id: str) -> DeviceState | None:
        return self.devices.get(device_id)

    async def get_link(self, link_id: str) -> LinkState | None:
        return self.links.get(link_id)

    async def get_all_devices(self) -> dict[str, DeviceState]:
        return dict(self.devices)

    async def get_all_links(self) -> dict[str, LinkState]:
        return dict(self.links)

    async def get_all_bgp_sessions(self) -> dict[str, BgpSessionState]:
        return dict(self.bgp_sessions)

    async def get_devices_by_city(self, city: str) -> list[DeviceState]:
        return [d for d in self.devices.values() if d.city == city]

    async def get_links_for_device(self, device_id: str) -> list[LinkState]:
        return [
            link
            for link in self.links.values()
            if link.from_device == device_id or link.to_device == device_id
        ]

    async def get_topology_snapshot(self) -> dict[str, Any]:
        return {
            "devices": {
                did: {
                    "device_id": d.device_id,
                    "type": d.device_type,
                    "city": d.city,
                    "status": d.status.value,
                    "cpu_utilization": round(d.cpu_utilization, 2),
                    "memory_utilization": round(d.memory_utilization, 2),
                    "temperature_celsius": round(d.temperature_celsius, 2),
                    "uptime_seconds": d.uptime_seconds,
                    "region": d.region,
                    "peer_as": d.peer_as,
                    "peer_name": d.peer_name,
                    "rate_limit_mbps": d.rate_limit_mbps,
                }
                for did, d in self.devices.items()
            },
            "links": {
                lid: {
                    "link_id": link.link_id,
                    "from": link.from_device,
                    "to": link.to_device,
                    "type": link.link_type,
                    "status": link.status.value,
                    "capacity_gbps": link.capacity_gbps,
                    "utilization_percent": round(link.utilization_percent, 2),
                    "throughput_gbps": round(link.throughput_gbps, 3),
                    "latency_ms": round(link.latency_ms, 2),
                    "packet_loss_percent": round(link.packet_loss_percent, 4),
                    "errors_in": link.errors_in,
                    "errors_out": link.errors_out,
                }
                for lid, link in self.links.items()
            },
            "bgp_sessions": {
                key: {
                    "device_id": s.device_id,
                    "peer_as": s.peer_as,
                    "peer_name": s.peer_name,
                    "status": s.status.value,
                    "prefixes_received": s.prefixes_received,
                    "flap_count": s.flap_count,
                }
                for key, s in self.bgp_sessions.items()
            },
            "customer_distribution": TOPOLOGY["customer_distribution"],
        }

    async def update_device_status(self, device_id: str, status: DeviceStatus):
        if device_id in self.devices:
            self.devices[device_id].status = status

    async def restart_device(self, device_id: str):
        async with self._lock:
            device = self.devices.get(device_id)
            if not device:
                return False
            device.status = DeviceStatus.HEALTHY
            device.cpu_utilization = 0.0
            device.memory_utilization = 0.0
            device.temperature_celsius = 35.0
            device.cpu_modifier = 0.0
            device.memory_modifier = 0.0
            device.temp_modifier = 0.0
            device.rate_limit_mbps = None
            device.boot_time = time.time()
            device.uptime_seconds = 0
            logger.info("device_restarted", device_id=device_id)
            return True


# Singleton
network_state = NetworkState()
