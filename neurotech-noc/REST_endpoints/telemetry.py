"""
telemetry.py — Realistic ISP network telemetry simulator.
Generates time-series data for 10 nodes with realistic noise,
diurnal patterns, and injectable failure scenarios.
"""

import random
import math
import time
from datetime import datetime
from typing import Optional


class TelemetrySimulator:
    NODES = [
        {"id": "CORE-ATL-01", "type": "core",  "label": "Core Atlanta"},
        {"id": "CORE-NYC-01", "type": "core",  "label": "Core New York"},
        {"id": "EDGE-ATL-01", "type": "edge",  "label": "Edge ATL-1"},
        {"id": "EDGE-ATL-02", "type": "edge",  "label": "Edge ATL-2"},
        {"id": "EDGE-NYC-01", "type": "edge",  "label": "Edge NYC-1"},
        {"id": "EDGE-NYC-02", "type": "edge",  "label": "Edge NYC-2"},
        {"id": "PEER-IX-01",  "type": "peer",  "label": "IX Peer 1"},
        {"id": "PEER-IX-02",  "type": "peer",  "label": "IX Peer 2"},
        {"id": "POP-ATL-01",  "type": "pop",   "label": "POP Atlanta"},
        {"id": "POP-NYC-01",  "type": "pop",   "label": "POP New York"},
    ]

    SCENARIOS = {
        "congestion-atl": {
            "name": "Atlanta Congestion Cascade",
            "affected": ["POP-ATL-01", "EDGE-ATL-01", "EDGE-ATL-02"],
            "changes": {"utilization": +38, "latency": +22, "packetLoss": +0.9},
            "duration": 60,
        },
        "bgp-flap": {
            "name": "BGP Route Flap NYC",
            "affected": ["PEER-IX-02", "CORE-NYC-01"],
            "changes": {"utilization": +20, "latency": +50, "packetLoss": +2.2, "health": -18},
            "duration": 45,
        },
        "fiber-cut": {
            "name": "Fiber Degradation ATL-Core",
            "affected": ["CORE-ATL-01"],
            "changes": {"utilization": +12, "latency": +10, "packetLoss": +1.6, "health": -28},
            "duration": 120,
        },
        "ddos": {
            "name": "DDoS Absorption Event",
            "affected": ["PEER-IX-01", "PEER-IX-02", "CORE-NYC-01", "CORE-ATL-01"],
            "changes": {"utilization": +55, "latency": +35, "packetLoss": +1.2},
            "duration": 90,
        },
    }

    BASELINES = {
        "CORE-ATL-01": {"latency": 2.1,  "packetLoss": 0.01, "utilization": 42, "health": 100},
        "CORE-NYC-01": {"latency": 1.8,  "packetLoss": 0.00, "utilization": 38, "health": 100},
        "EDGE-ATL-01": {"latency": 3.2,  "packetLoss": 0.02, "utilization": 55, "health": 98},
        "EDGE-ATL-02": {"latency": 2.9,  "packetLoss": 0.01, "utilization": 48, "health": 100},
        "EDGE-NYC-01": {"latency": 2.4,  "packetLoss": 0.00, "utilization": 61, "health": 97},
        "EDGE-NYC-02": {"latency": 2.1,  "packetLoss": 0.01, "utilization": 44, "health": 100},
        "PEER-IX-01":  {"latency": 4.1,  "packetLoss": 0.03, "utilization": 72, "health": 95},
        "PEER-IX-02":  {"latency": 3.8,  "packetLoss": 0.02, "utilization": 68, "health": 96},
        "POP-ATL-01":  {"latency": 5.2,  "packetLoss": 0.04, "utilization": 81, "health": 92},
        "POP-NYC-01":  {"latency": 4.9,  "packetLoss": 0.03, "utilization": 77, "health": 94},
    }

    def __init__(self):
        self._state = {
            node_id: dict(vals) for node_id, vals in self.BASELINES.items()
        }
        self._active_scenarios: dict[str, dict] = {}  # scenario_id -> {start_tick, scenario}
        self._tick = 0
        self._start_time = time.time()

    def _diurnal_factor(self) -> float:
        """Simulate realistic traffic patterns — peak at 20:00, trough at 04:00."""
        hour = datetime.now().hour + datetime.now().minute / 60
        return 0.6 + 0.4 * math.sin((hour - 4) / 24 * 2 * math.pi)

    def tick(self) -> dict:
        """Advance simulation by one step. Returns full telemetry snapshot."""
        self._tick += 1
        diurnal = self._diurnal_factor()

        for node_id in list(self._state.keys()):
            base = self.BASELINES[node_id]
            s = self._state[node_id]

            # Random walk with mean reversion toward baseline
            def evolve(current, baseline, noise_scale, min_val=0, max_val=None):
                reversion = (baseline - current) * 0.05
                noise = random.gauss(0, noise_scale)
                val = current + reversion + noise
                val = max(min_val, val)
                if max_val is not None:
                    val = min(max_val, val)
                return round(val, 3)

            s["latency"] = evolve(s["latency"], base["latency"] * (0.8 + 0.4 * diurnal), 0.15, 0.3)
            s["packetLoss"] = evolve(s["packetLoss"], base["packetLoss"], 0.02, 0.0, 5.0)
            s["utilization"] = evolve(s["utilization"], base["utilization"] * (0.7 + 0.6 * diurnal), 1.2, 0.0, 120.0)
            s["health"] = evolve(s["health"], 100.0, 0.1, 0.0, 100.0)

        # Apply active scenario effects
        expired = []
        for scenario_id, ctx in self._active_scenarios.items():
            scenario = ctx["scenario"]
            elapsed = self._tick - ctx["start_tick"]
            if elapsed > scenario["duration"]:
                expired.append(scenario_id)
                continue

            # Decay effect over time
            intensity = 1.0 - (elapsed / scenario["duration"]) * 0.3

            for node_id in scenario["affected"]:
                if node_id in self._state:
                    s = self._state[node_id]
                    c = scenario["changes"]
                    if "utilization" in c:
                        s["utilization"] = min(120, s["utilization"] + c["utilization"] * intensity * random.uniform(0.8, 1.1))
                    if "latency" in c:
                        s["latency"] = s["latency"] + c["latency"] * intensity * random.uniform(0.8, 1.1)
                    if "packetLoss" in c:
                        s["packetLoss"] = min(5.0, s["packetLoss"] + c["packetLoss"] * intensity)
                    if "health" in c:
                        s["health"] = max(0, s["health"] + c["health"] * 0.1)  # gradual degradation

        for sid in expired:
            del self._active_scenarios[sid]

        return self.current_snapshot()

    def current_snapshot(self) -> dict:
        return {
            node_id: {
                "latency": round(vals["latency"], 2),
                "packetLoss": round(vals["packetLoss"], 3),
                "utilization": round(vals["utilization"], 1),
                "health": round(vals["health"], 1),
                "status": self._compute_status(vals),
            }
            for node_id, vals in self._state.items()
        }

    def _compute_status(self, t: dict) -> str:
        if t["health"] < 75 or t["packetLoss"] > 1.5 or t["utilization"] > 105:
            return "critical"
        if t["health"] < 88 or t["packetLoss"] > 0.5 or t["utilization"] > 85:
            return "warning"
        return "healthy"

    def inject_scenario(self, scenario_id: str) -> Optional[list]:
        """Manually inject a failure scenario."""
        scenario = self.SCENARIOS.get(scenario_id)
        if not scenario:
            return None
        self._active_scenarios[scenario_id] = {
            "start_tick": self._tick,
            "scenario": scenario,
        }
        return scenario["affected"]

    def get_node_history_summary(self, node_id: str, history: list) -> dict:
        """Extract per-node time-series from rolling history for anomaly context."""
        latencies = [h.get(node_id, {}).get("latency", 0) for h in history if node_id in h]
        utilizations = [h.get(node_id, {}).get("utilization", 0) for h in history if node_id in h]
        return {
            "latency_avg": round(sum(latencies) / len(latencies), 2) if latencies else 0,
            "latency_max": round(max(latencies), 2) if latencies else 0,
            "utilization_avg": round(sum(utilizations) / len(utilizations), 1) if utilizations else 0,
            "utilization_max": round(max(utilizations), 1) if utilizations else 0,
            "samples": len(latencies),
        }