"""
Chaos effects — how each scenario modifies the in-memory network state.

Each effect is an async function that runs in a background task,
modifying NetworkState until the scenario is stopped or expires.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import structlog

from netsim.core.network_state import network_state
from netsim.events import event_bus, CHANNEL_EVENTS, CHANNEL_CHAOS
from netsim.models.enums import (
    DeviceStatus,
    LinkStatus,
    BgpSessionStatus,
    ChaosScenarioName,
)

logger = structlog.get_logger()


async def _emit_event(event_type: str, source: str, severity: str, description: str, metadata: dict | None = None):
    from netsim.db.engine import async_session
    from sqlalchemy import text

    event = {
        "event_type": event_type,
        "source": source,
        "severity": severity,
        "description": description,
        "metadata": metadata or {},
    }
    await event_bus.publish(CHANNEL_EVENTS, event)

    async with async_session() as session:
        async with session.begin():
            await session.execute(
                text(
                    "INSERT INTO network_events (event_type, source, severity, description, metadata) "
                    "VALUES (:event_type, :source, :severity, :description, CAST(:metadata AS jsonb))"
                ),
                {
                    "event_type": event_type,
                    "source": source,
                    "severity": severity,
                    "description": description,
                    "metadata": __import__("json").dumps(metadata or {}),
                },
            )


async def apply_fiber_cut(params: dict[str, Any], stop_event: asyncio.Event):
    link_id = params["link_id"]
    link = await network_state.get_link(link_id)
    if not link:
        logger.error("chaos_target_not_found", link_id=link_id)
        return

    link.forced_down = True
    link.status = LinkStatus.DOWN
    await _emit_event(
        "link_down", link_id, "critical",
        f"Fiber cut on {link_id} — link DOWN",
        {"scenario": "fiber_cut", "link_id": link_id},
    )
    logger.info("chaos_fiber_cut_applied", link_id=link_id)

    # Simulate traffic redistribution: increase utilization on parallel links
    all_links = await network_state.get_all_links()
    # Find links between same pair of cities
    from_dev = await network_state.get_device(link.from_device)
    to_dev = await network_state.get_device(link.to_device)
    if from_dev and to_dev:
        for other_link in all_links.values():
            if other_link.link_id == link_id:
                continue
            o_from = await network_state.get_device(other_link.from_device)
            o_to = await network_state.get_device(other_link.to_device)
            if o_from and o_to:
                cities = {o_from.city, o_to.city}
                if {from_dev.city, to_dev.city} == cities and not other_link.forced_down:
                    other_link.utilization_modifier += 25.0

    await stop_event.wait()

    # Restore
    link.forced_down = False
    link.status = LinkStatus.UP
    if from_dev and to_dev:
        for other_link in all_links.values():
            if other_link.link_id == link_id:
                continue
            o_from = await network_state.get_device(other_link.from_device)
            o_to = await network_state.get_device(other_link.to_device)
            if o_from and o_to:
                cities = {o_from.city, o_to.city}
                if {from_dev.city, to_dev.city} == cities:
                    other_link.utilization_modifier = max(
                        0, other_link.utilization_modifier - 25.0
                    )
    await _emit_event(
        "link_up", link_id, "info",
        f"Fiber restored on {link_id} — link UP",
        {"scenario": "fiber_cut", "link_id": link_id},
    )


async def apply_gradual_degradation(params: dict[str, Any], stop_event: asyncio.Event):
    link_id = params["link_id"]
    latency_increase = params.get("latency_increase_ms", 50)
    loss_increase = params.get("loss_increase_percent", 3.0)
    ramp_seconds = params.get("ramp_seconds", 180)

    link = await network_state.get_link(link_id)
    if not link:
        return

    steps = ramp_seconds // 5  # update every 5 seconds
    lat_step = latency_increase / max(steps, 1)
    loss_step = loss_increase / max(steps, 1)

    await _emit_event(
        "link_degrading", link_id, "warning",
        f"Gradual degradation starting on {link_id}",
        {"scenario": "gradual_degradation", "link_id": link_id},
    )

    for i in range(steps):
        if stop_event.is_set():
            break
        link.latency_modifier += lat_step
        link.loss_modifier += loss_step
        await asyncio.sleep(5)

    # Hold until stopped
    await stop_event.wait()

    # Restore
    link.latency_modifier = 0.0
    link.loss_modifier = 0.0
    await _emit_event(
        "link_recovered", link_id, "info",
        f"Degradation resolved on {link_id}",
    )


async def apply_ddos_attack(params: dict[str, Any], stop_event: asyncio.Event):
    device_id = params["target_device"]
    multiplier = params.get("traffic_multiplier", 5.0)

    device = await network_state.get_device(device_id)
    if not device:
        return

    device.cpu_modifier += 40.0 * (multiplier / 5.0)
    device.memory_modifier += 15.0

    # Saturate connected links
    links = await network_state.get_links_for_device(device_id)
    for link in links:
        link.utilization_modifier += 40.0 * (multiplier / 5.0)
        link.loss_modifier += 2.0

    await _emit_event(
        "ddos_detected", device_id, "critical",
        f"DDoS attack on {device_id} — traffic {multiplier}x normal",
        {"scenario": "ddos_attack", "target": device_id, "multiplier": multiplier},
    )

    await stop_event.wait()

    device.cpu_modifier = max(0, device.cpu_modifier - 40.0 * (multiplier / 5.0))
    device.memory_modifier = max(0, device.memory_modifier - 15.0)
    for link in links:
        link.utilization_modifier = max(0, link.utilization_modifier - 40.0 * (multiplier / 5.0))
        link.loss_modifier = max(0, link.loss_modifier - 2.0)
    await _emit_event(
        "ddos_mitigated", device_id, "info",
        f"DDoS attack on {device_id} mitigated",
    )


async def apply_device_failure(params: dict[str, Any], stop_event: asyncio.Event):
    device_id = params["device_id"]
    ramp_seconds = params.get("ramp_seconds", 30)

    device = await network_state.get_device(device_id)
    if not device:
        return

    # Ramp up CPU/memory
    steps = ramp_seconds // 5
    cpu_step = (100 - device.cpu_utilization) / max(steps, 1)
    mem_step = (100 - device.memory_utilization) / max(steps, 1)

    await _emit_event(
        "device_degrading", device_id, "warning",
        f"Device {device_id} showing signs of failure",
        {"scenario": "device_failure"},
    )

    for i in range(steps):
        if stop_event.is_set():
            break
        device.cpu_modifier += cpu_step
        device.memory_modifier += mem_step
        await asyncio.sleep(5)

    if not stop_event.is_set():
        # Crash the device
        device.status = DeviceStatus.DOWN
        device.cpu_modifier = 0
        device.memory_modifier = 0

        # Down all connected links
        links = await network_state.get_links_for_device(device_id)
        for link in links:
            link.forced_down = True
            link.status = LinkStatus.DOWN

        await _emit_event(
            "device_down", device_id, "emergency",
            f"Device {device_id} has CRASHED",
            {"scenario": "device_failure"},
        )

        await stop_event.wait()

        # Restore
        device.status = DeviceStatus.HEALTHY
        device.cpu_modifier = 0
        device.memory_modifier = 0
        device.boot_time = time.time()
        for link in links:
            link.forced_down = False
            link.status = LinkStatus.UP

        await _emit_event(
            "device_up", device_id, "info",
            f"Device {device_id} restored",
        )
    else:
        device.cpu_modifier = 0
        device.memory_modifier = 0


async def apply_bgp_route_leak(params: dict[str, Any], stop_event: asyncio.Event):
    device_id = params["device_id"]
    leaked = params.get("leaked_prefixes", 50000)

    sessions = await network_state.get_all_bgp_sessions()
    target_sessions = [s for s in sessions.values() if s.device_id == device_id]
    if not target_sessions:
        return

    for session in target_sessions:
        session.leaked_prefixes = leaked
        session.flap_count += 1

    await _emit_event(
        "bgp_route_leak", device_id, "critical",
        f"BGP route leak detected on {device_id} — {leaked} leaked prefixes",
        {"scenario": "bgp_route_leak", "leaked_prefixes": leaked},
    )

    # Increase latency on peering links to simulate misrouting
    links = await network_state.get_links_for_device(device_id)
    for link in links:
        link.latency_modifier += 20.0
        link.loss_modifier += 5.0

    await stop_event.wait()

    for session in target_sessions:
        session.leaked_prefixes = 0
    for link in links:
        link.latency_modifier = max(0, link.latency_modifier - 20.0)
        link.loss_modifier = max(0, link.loss_modifier - 5.0)
    await _emit_event(
        "bgp_route_leak_resolved", device_id, "info",
        f"BGP route leak on {device_id} resolved",
    )


async def apply_congestion_cascade(params: dict[str, Any], stop_event: asyncio.Event):
    initial_link_id = params["initial_link"]
    cascade_delay = params.get("cascade_delay_seconds", 15)

    link = await network_state.get_link(initial_link_id)
    if not link:
        return

    # Phase 1: kill initial link
    link.forced_down = True
    link.status = LinkStatus.DOWN
    await _emit_event(
        "link_down", initial_link_id, "critical",
        f"Link {initial_link_id} failed — congestion cascade starting",
        {"scenario": "congestion_cascade"},
    )

    # Phase 2: cascade to neighbors
    affected_links = [link]
    device_id = link.from_device
    neighbor_links = await network_state.get_links_for_device(device_id)
    neighbor_links = [l for l in neighbor_links if l.link_id != initial_link_id and not l.forced_down]

    for i, neighbor in enumerate(neighbor_links):
        if stop_event.is_set():
            break
        await asyncio.sleep(cascade_delay)
        if stop_event.is_set():
            break
        neighbor.utilization_modifier += 35.0
        neighbor.loss_modifier += 1.5
        affected_links.append(neighbor)
        # Also stress the connected device
        dev = await network_state.get_device(neighbor.to_device)
        if dev:
            dev.cpu_modifier += 15.0
        await _emit_event(
            "cascade_spread", neighbor.link_id, "warning",
            f"Congestion spreading to {neighbor.link_id}",
            {"scenario": "congestion_cascade", "stage": i + 1},
        )

    await stop_event.wait()

    # Restore everything
    link.forced_down = False
    link.status = LinkStatus.UP
    for neighbor in affected_links[1:]:
        neighbor.utilization_modifier = max(0, neighbor.utilization_modifier - 35.0)
        neighbor.loss_modifier = max(0, neighbor.loss_modifier - 1.5)
        dev = await network_state.get_device(neighbor.to_device)
        if dev:
            dev.cpu_modifier = max(0, dev.cpu_modifier - 15.0)
    await _emit_event(
        "cascade_resolved", initial_link_id, "info",
        "Congestion cascade resolved",
    )


async def apply_memory_leak(params: dict[str, Any], stop_event: asyncio.Event):
    device_id = params["device_id"]
    leak_rate = params.get("leak_rate_percent_per_minute", 5.0)
    crash_threshold = params.get("crash_threshold", 98.0)

    device = await network_state.get_device(device_id)
    if not device:
        return

    step_interval = 5  # seconds
    step_increase = leak_rate / (60 / step_interval)

    await _emit_event(
        "memory_leak_detected", device_id, "warning",
        f"Memory leak detected on {device_id}",
        {"scenario": "memory_leak", "leak_rate": leak_rate},
    )

    while not stop_event.is_set():
        device.memory_modifier += step_increase
        effective_mem = device.memory_utilization + device.memory_modifier

        if effective_mem >= crash_threshold:
            device.status = DeviceStatus.DOWN
            device.memory_modifier = 0
            links = await network_state.get_links_for_device(device_id)
            for link in links:
                link.forced_down = True
                link.status = LinkStatus.DOWN
            await _emit_event(
                "device_oom_crash", device_id, "emergency",
                f"Device {device_id} OOM crash — all links DOWN",
                {"scenario": "memory_leak"},
            )
            await stop_event.wait()
            # Restore
            device.status = DeviceStatus.HEALTHY
            device.boot_time = time.time()
            for link in links:
                link.forced_down = False
                link.status = LinkStatus.UP
            await _emit_event(
                "device_up", device_id, "info",
                f"Device {device_id} restored after OOM",
            )
            return

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=step_interval)
        except asyncio.TimeoutError:
            continue

    # Stopped before crash
    device.memory_modifier = 0
    await _emit_event(
        "memory_leak_fixed", device_id, "info",
        f"Memory leak on {device_id} patched",
    )


async def apply_flapping_link(params: dict[str, Any], stop_event: asyncio.Event):
    link_id = params["link_id"]
    flap_interval = params.get("flap_interval_seconds", 10)

    link = await network_state.get_link(link_id)
    if not link:
        return

    # Find associated BGP sessions
    sessions = await network_state.get_all_bgp_sessions()
    related_sessions = []
    for session in sessions.values():
        if session.device_id in (link.from_device, link.to_device):
            related_sessions.append(session)

    await _emit_event(
        "link_flapping", link_id, "warning",
        f"Link {link_id} is flapping",
        {"scenario": "flapping_link", "interval": flap_interval},
    )

    is_down = False
    while not stop_event.is_set():
        is_down = not is_down
        link.forced_down = is_down
        link.status = LinkStatus.DOWN if is_down else LinkStatus.UP

        for session in related_sessions:
            session.flap_count += 1
            session.last_flap_time = time.time()

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=flap_interval)
        except asyncio.TimeoutError:
            continue

    # Restore to UP
    link.forced_down = False
    link.status = LinkStatus.UP
    await _emit_event(
        "link_stable", link_id, "info",
        f"Link {link_id} stabilized",
    )


# Map scenario names to effect functions
EFFECT_HANDLERS = {
    ChaosScenarioName.FIBER_CUT: apply_fiber_cut,
    ChaosScenarioName.GRADUAL_DEGRADATION: apply_gradual_degradation,
    ChaosScenarioName.DDOS_ATTACK: apply_ddos_attack,
    ChaosScenarioName.DEVICE_FAILURE: apply_device_failure,
    ChaosScenarioName.BGP_ROUTE_LEAK: apply_bgp_route_leak,
    ChaosScenarioName.CONGESTION_CASCADE: apply_congestion_cascade,
    ChaosScenarioName.MEMORY_LEAK: apply_memory_leak,
    ChaosScenarioName.FLAPPING_LINK: apply_flapping_link,
}
