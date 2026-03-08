"""
8 chaos scenarios — each defines metadata, default params, and expected effects.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from netsim.models.enums import ChaosScenarioName


@dataclass
class ScenarioDefinition:
    name: ChaosScenarioName
    display_name: str
    description: str
    severity: str
    default_params: dict[str, Any]
    expected_effects: list[str]
    affected_components: list[str]


SCENARIOS: dict[str, ScenarioDefinition] = {
    ChaosScenarioName.FIBER_CUT: ScenarioDefinition(
        name=ChaosScenarioName.FIBER_CUT,
        display_name="Fiber Cut",
        description="Complete link failure simulating a physical fiber optic cable cut. "
        "Triggers BGP reconvergence and automatic traffic redistribution to backup paths.",
        severity="critical",
        default_params={
            "link_id": "link-del-mum-primary",
        },
        expected_effects=[
            "Link goes DOWN immediately",
            "Traffic reroutes to backup path",
            "Latency increases on backup link",
            "BGP reconvergence within 30s",
        ],
        affected_components=["links", "bgp", "traffic"],
    ),
    ChaosScenarioName.GRADUAL_DEGRADATION: ScenarioDefinition(
        name=ChaosScenarioName.GRADUAL_DEGRADATION,
        display_name="Gradual Degradation",
        description="Slow increase in latency and packet loss over minutes, simulating "
        "fiber aging, connector degradation, or environmental interference.",
        severity="warning",
        default_params={
            "link_id": "link-del-mum-primary",
            "latency_increase_ms": 50,
            "loss_increase_percent": 3.0,
            "ramp_seconds": 180,
        },
        expected_effects=[
            "Latency gradually increases",
            "Packet loss slowly rises",
            "Link status degrades from UP to DEGRADED",
            "Throughput decreases",
        ],
        affected_components=["links"],
    ),
    ChaosScenarioName.DDOS_ATTACK: ScenarioDefinition(
        name=ChaosScenarioName.DDOS_ATTACK,
        display_name="DDoS Attack",
        description="Sudden volumetric traffic spike flooding an edge router, overwhelming "
        "its capacity and causing collateral impact on connected links.",
        severity="critical",
        default_params={
            "target_device": "edge-delhi-north",
            "traffic_multiplier": 5.0,
        },
        expected_effects=[
            "CPU spike on target device",
            "Connected links saturated to ~100%",
            "Packet loss spike on connected links",
            "Device may enter CRITICAL state",
        ],
        affected_components=["devices", "links"],
    ),
    ChaosScenarioName.DEVICE_FAILURE: ScenarioDefinition(
        name=ChaosScenarioName.DEVICE_FAILURE,
        display_name="Device Failure",
        description="CPU and memory spike followed by complete device crash. Simulates "
        "hardware failure or kernel panic.",
        severity="emergency",
        default_params={
            "device_id": "core-delhi-1",
            "ramp_seconds": 30,
        },
        expected_effects=[
            "CPU spikes to 100%",
            "Memory fills to 100%",
            "Device goes DOWN after ramp",
            "All connected links go DOWN",
            "Traffic must reroute via redundant paths",
        ],
        affected_components=["devices", "links", "bgp"],
    ),
    ChaosScenarioName.BGP_ROUTE_LEAK: ScenarioDefinition(
        name=ChaosScenarioName.BGP_ROUTE_LEAK,
        display_name="BGP Route Leak",
        description="Peer announces incorrect routes causing traffic to be misrouted "
        "through suboptimal paths or into a blackhole.",
        severity="critical",
        default_params={
            "device_id": "peer-delhi-1",
            "leaked_prefixes": 50000,
        },
        expected_effects=[
            "Sudden spike in received prefixes",
            "Traffic blackholing for affected routes",
            "Increased latency for misrouted traffic",
            "BGP session instability",
        ],
        affected_components=["bgp", "traffic"],
    ),
    ChaosScenarioName.CONGESTION_CASCADE: ScenarioDefinition(
        name=ChaosScenarioName.CONGESTION_CASCADE,
        display_name="Congestion Cascade",
        description="One link fails, pushing traffic to neighbors, which then overload "
        "and push to their neighbors — a cascading failure pattern.",
        severity="emergency",
        default_params={
            "initial_link": "link-del-c1-en",
            "cascade_delay_seconds": 15,
        },
        expected_effects=[
            "Initial link goes DOWN",
            "Neighbor links spike to >90% utilization",
            "Cascading packet loss",
            "Multiple links enter DEGRADED state",
            "Device CPU spikes from increased routing work",
        ],
        affected_components=["links", "devices"],
    ),
    ChaosScenarioName.MEMORY_LEAK: ScenarioDefinition(
        name=ChaosScenarioName.MEMORY_LEAK,
        display_name="Memory Leak",
        description="Slow memory consumption increase simulating a software bug in the "
        "router's control plane, eventually causing OOM crash.",
        severity="warning",
        default_params={
            "device_id": "core-mumbai-1",
            "leak_rate_percent_per_minute": 5.0,
            "crash_threshold": 98.0,
        },
        expected_effects=[
            "Memory utilization slowly climbs",
            "Device status degrades to DEGRADED then CRITICAL",
            "Control plane instability as memory fills",
            "Eventual OOM crash (device DOWN)",
        ],
        affected_components=["devices"],
    ),
    ChaosScenarioName.FLAPPING_LINK: ScenarioDefinition(
        name=ChaosScenarioName.FLAPPING_LINK,
        display_name="Flapping Link",
        description="Link rapidly toggles between UP and DOWN states, simulating a loose "
        "fiber connector or faulty transceiver causing route instability.",
        severity="warning",
        default_params={
            "link_id": "link-del-mum-primary",
            "flap_interval_seconds": 10,
        },
        expected_effects=[
            "Link alternates UP/DOWN rapidly",
            "BGP flap counter increases",
            "Route table instability",
            "Intermittent packet loss bursts",
        ],
        affected_components=["links", "bgp"],
    ),
}
