"""
Telemetry engine — generates realistic metrics every N seconds
for all devices and links, persists to TimescaleDB, and publishes
to Redis for real-time consumption.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone

import structlog
from sqlalchemy import text

from netsim.config.settings import settings
from netsim.core.network_state import network_state, DeviceState, LinkState
from netsim.core.traffic_model import (
    device_cpu_utilization,
    device_memory_utilization,
    device_temperature,
    link_utilization,
    link_latency,
    link_packet_loss,
    link_throughput,
    link_errors,
)
from netsim.db.engine import async_session
from netsim.events import event_bus, CHANNEL_TELEMETRY
from netsim.models.enums import DeviceStatus, LinkStatus

logger = structlog.get_logger()


class TelemetryEngine:
    """Generates and persists telemetry at a configurable interval."""

    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None
        self._tick_count = 0

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info(
            "telemetry_engine_started",
            interval=settings.telemetry_interval_seconds,
        )

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("telemetry_engine_stopped")

    async def _loop(self):
        while self._running:
            try:
                await self._generate_tick()
                self._tick_count += 1
            except Exception:
                logger.exception("telemetry_tick_error")
            await asyncio.sleep(settings.telemetry_interval_seconds)

    async def _generate_tick(self):
        now = datetime.now(timezone.utc)

        device_rows = []
        link_rows = []
        bgp_rows = []
        telemetry_payload = {"timestamp": now.isoformat(), "devices": {}, "links": {}}

        # Generate device telemetry
        devices = await network_state.get_all_devices()
        for device_id, device in devices.items():
            metrics = self._compute_device_metrics(device, now)
            # Update in-memory state
            device.cpu_utilization = metrics["cpu_utilization"]
            device.memory_utilization = metrics["memory_utilization"]
            device.temperature_celsius = metrics["temperature_celsius"]
            device.uptime_seconds = int(time.time() - device.boot_time)
            device.status = self._derive_device_status(device)

            metrics["status"] = device.status.value
            metrics["uptime_seconds"] = device.uptime_seconds

            device_rows.append(
                {
                    "time": now,
                    "device_id": device_id,
                    "cpu_utilization": metrics["cpu_utilization"],
                    "memory_utilization": metrics["memory_utilization"],
                    "temperature_celsius": metrics["temperature_celsius"],
                    "uptime_seconds": metrics["uptime_seconds"],
                    "status": metrics["status"],
                }
            )
            telemetry_payload["devices"][device_id] = metrics

        # Generate link telemetry
        links = await network_state.get_all_links()
        for link_id, link in links.items():
            metrics = self._compute_link_metrics(link, devices, now)
            # Update in-memory state
            link.utilization_percent = metrics["utilization_percent"]
            link.throughput_gbps = metrics["throughput_gbps"]
            link.latency_ms = metrics["latency_ms"]
            link.packet_loss_percent = metrics["packet_loss_percent"]
            link.errors_in = metrics["errors_in"]
            link.errors_out = metrics["errors_out"]
            link.status = self._derive_link_status(link)
            metrics["status"] = link.status.value

            link_rows.append(
                {
                    "time": now,
                    "link_id": link_id,
                    "utilization_percent": metrics["utilization_percent"],
                    "throughput_gbps": metrics["throughput_gbps"],
                    "latency_ms": metrics["latency_ms"],
                    "packet_loss_percent": metrics["packet_loss_percent"],
                    "errors_in": metrics["errors_in"],
                    "errors_out": metrics["errors_out"],
                    "status": metrics["status"],
                }
            )
            telemetry_payload["links"][link_id] = metrics

        # Generate BGP telemetry
        bgp_sessions = await network_state.get_all_bgp_sessions()
        for key, session in bgp_sessions.items():
            bgp_rows.append(
                {
                    "time": now,
                    "device_id": session.device_id,
                    "peer_as": session.peer_as,
                    "status": session.status.value,
                    "prefixes_received": session.prefixes_received
                    + session.leaked_prefixes,
                    "flap_count": session.flap_count,
                }
            )

        # Persist to database
        await self._persist(device_rows, link_rows, bgp_rows)

        # Publish to Redis
        await event_bus.publish(CHANNEL_TELEMETRY, telemetry_payload)

    def _compute_device_metrics(
        self, device: DeviceState, now: datetime
    ) -> dict:
        if device.status == DeviceStatus.DOWN:
            return {
                "cpu_utilization": 0.0,
                "memory_utilization": 0.0,
                "temperature_celsius": 25.0,
            }

        cpu = device_cpu_utilization(device.device_type, device.city, now=now)
        cpu = min(cpu + device.cpu_modifier, 100.0)

        mem = device_memory_utilization(device.device_type, device.city, now=now)
        mem = min(mem + device.memory_modifier, 100.0)

        temp = device_temperature(cpu)
        temp = min(temp + device.temp_modifier, 105.0)

        return {
            "cpu_utilization": round(cpu, 2),
            "memory_utilization": round(mem, 2),
            "temperature_celsius": round(temp, 2),
        }

    def _compute_link_metrics(
        self,
        link: LinkState,
        devices: dict[str, DeviceState],
        now: datetime,
    ) -> dict:
        if link.forced_down or link.status == LinkStatus.DOWN:
            return {
                "utilization_percent": 0.0,
                "throughput_gbps": 0.0,
                "latency_ms": 0.0,
                "packet_loss_percent": 100.0,
                "errors_in": 0,
                "errors_out": 0,
            }

        # Check if either endpoint is down
        from_dev = devices.get(link.from_device)
        to_dev = devices.get(link.to_device)
        if (from_dev and from_dev.status == DeviceStatus.DOWN) or (
            to_dev and to_dev.status == DeviceStatus.DOWN
        ):
            return {
                "utilization_percent": 0.0,
                "throughput_gbps": 0.0,
                "latency_ms": 0.0,
                "packet_loss_percent": 100.0,
                "errors_in": 0,
                "errors_out": 0,
            }

        from_city = from_dev.city if from_dev else "delhi"
        to_city = to_dev.city if to_dev else "mumbai"

        util = link_utilization(link.link_type, from_city, to_city, now=now)
        util = min(util + link.utilization_modifier, 100.0)

        lat = link_latency(link.base_latency_ms + link.latency_modifier, util)
        loss = link_packet_loss(util) + link.loss_modifier
        loss = max(0.0, min(loss, 100.0))
        tp = link_throughput(link.capacity_gbps, util)
        err_in, err_out = link_errors(util)

        return {
            "utilization_percent": round(util, 2),
            "throughput_gbps": round(tp, 3),
            "latency_ms": round(lat, 3),
            "packet_loss_percent": round(loss, 4),
            "errors_in": err_in,
            "errors_out": err_out,
        }

    def _derive_device_status(self, device: DeviceState) -> DeviceStatus:
        if device.status == DeviceStatus.DOWN:
            return DeviceStatus.DOWN
        if device.cpu_utilization > 95 or device.memory_utilization > 95:
            return DeviceStatus.CRITICAL
        if (
            device.cpu_utilization > 80
            or device.memory_utilization > 85
            or device.temperature_celsius > 70
        ):
            return DeviceStatus.DEGRADED
        return DeviceStatus.HEALTHY

    def _derive_link_status(self, link: LinkState) -> LinkStatus:
        if link.forced_down:
            return LinkStatus.DOWN
        if link.packet_loss_percent > 5 or link.utilization_percent > 95:
            return LinkStatus.DOWN
        if link.packet_loss_percent > 1 or link.utilization_percent > 80:
            return LinkStatus.DEGRADED
        return LinkStatus.UP

    async def _persist(
        self,
        device_rows: list[dict],
        link_rows: list[dict],
        bgp_rows: list[dict],
    ):
        async with async_session() as session:
            async with session.begin():
                if device_rows:
                    await session.execute(
                        text(
                            "INSERT INTO device_metrics "
                            "(time, device_id, cpu_utilization, memory_utilization, "
                            "temperature_celsius, uptime_seconds, status) "
                            "VALUES (:time, :device_id, :cpu_utilization, "
                            ":memory_utilization, :temperature_celsius, "
                            ":uptime_seconds, :status)"
                        ),
                        device_rows,
                    )
                if link_rows:
                    await session.execute(
                        text(
                            "INSERT INTO link_metrics "
                            "(time, link_id, utilization_percent, throughput_gbps, "
                            "latency_ms, packet_loss_percent, errors_in, "
                            "errors_out, status) "
                            "VALUES (:time, :link_id, :utilization_percent, "
                            ":throughput_gbps, :latency_ms, :packet_loss_percent, "
                            ":errors_in, :errors_out, :status)"
                        ),
                        link_rows,
                    )
                if bgp_rows:
                    await session.execute(
                        text(
                            "INSERT INTO bgp_metrics "
                            "(time, device_id, peer_as, status, "
                            "prefixes_received, flap_count) "
                            "VALUES (:time, :device_id, :peer_as, :status, "
                            ":prefixes_received, :flap_count)"
                        ),
                        bgp_rows,
                    )


# Singleton
telemetry_engine = TelemetryEngine()
