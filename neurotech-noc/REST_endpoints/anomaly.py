"""
anomaly.py — Statistical anomaly detection for network telemetry.
Uses Z-score analysis + threshold rules + rate-of-change detection.
This is the Perception Engine — feeds the AI reasoning agent.
"""

import math
from collections import defaultdict
from typing import Optional


class AnomalyDetector:
    # Thresholds per metric per node type
    THRESHOLDS = {
        "core":  {"latency": 15,  "packetLoss": 0.8,  "utilization": 80, "health": 85},
        "edge":  {"latency": 20,  "packetLoss": 1.0,  "utilization": 85, "health": 82},
        "peer":  {"latency": 25,  "packetLoss": 1.5,  "utilization": 88, "health": 80},
        "pop":   {"latency": 30,  "packetLoss": 1.8,  "utilization": 90, "health": 78},
    }

    NODE_TYPES = {
        "CORE-ATL-01": "core", "CORE-NYC-01": "core",
        "EDGE-ATL-01": "edge", "EDGE-ATL-02": "edge",
        "EDGE-NYC-01": "edge", "EDGE-NYC-02": "edge",
        "PEER-IX-01": "peer",  "PEER-IX-02": "peer",
        "POP-ATL-01": "pop",   "POP-NYC-01": "pop",
    }

    # Scenario detection rules: if these nodes show anomalies together, name it
    COMPOSITE_PATTERNS = [
        {
            "id": "congestion-cascade",
            "name": "Congestion Cascade Detected",
            "requires": [["POP-ATL-01", "EDGE-ATL-01"], ["POP-NYC-01", "EDGE-NYC-01"]],
            "metric": "utilization",
            "description": "Multiple downstream nodes simultaneously high — likely upstream congestion",
        },
        {
            "id": "bgp-instability",
            "name": "BGP Instability Detected",
            "requires": [["PEER-IX-01", "CORE-ATL-01"], ["PEER-IX-02", "CORE-NYC-01"]],
            "metric": "packetLoss",
            "description": "Peering + core node showing correlated packet loss — possible BGP flap",
        },
        {
            "id": "fiber-degradation",
            "name": "Physical Layer Degradation",
            "requires": [["CORE-ATL-01"], ["CORE-NYC-01"]],
            "metric": "health",
            "description": "Core node health degrading — possible fiber or hardware fault",
        },
    ]

    def __init__(self):
        self._history: dict[str, list] = defaultdict(list)
        self._zscore_window = 20  # samples for Z-score baseline
        self._cooldown: dict[str, int] = {}  # prevent duplicate alerts

    def analyze(self, snapshot: dict, history: list) -> list:
        """
        Analyze current snapshot against history.
        Returns list of anomaly dicts, sorted by severity.
        """
        anomalies = []
        anomalous_nodes = set()

        for node_id, metrics in snapshot.items():
            node_type = self.NODE_TYPES.get(node_id, "edge")
            thresholds = self.THRESHOLDS[node_type]

            node_anomalies = []

            # Update per-node rolling history
            self._history[node_id].append(metrics)
            if len(self._history[node_id]) > self._zscore_window:
                self._history[node_id].pop(0)

            # ── Rule 1: Threshold breach ──────────────────────────────────────
            for metric in ["latency", "packetLoss", "utilization"]:
                val = metrics.get(metric, 0)
                thresh = thresholds.get(metric, 999)
                if val > thresh:
                    severity = "critical" if val > thresh * 1.4 else "warning"
                    node_anomalies.append({
                        "metric": metric,
                        "value": val,
                        "threshold": thresh,
                        "severity": severity,
                        "type": "threshold_breach",
                    })

            # ── Rule 2: Z-score (statistical deviation) ───────────────────────
            for metric in ["latency", "utilization"]:
                hist_vals = [h.get(metric, 0) for h in self._history[node_id]]
                if len(hist_vals) >= 5:
                    mean = sum(hist_vals) / len(hist_vals)
                    variance = sum((x - mean) ** 2 for x in hist_vals) / len(hist_vals)
                    std = math.sqrt(variance) if variance > 0 else 0.001
                    zscore = abs((metrics.get(metric, 0) - mean) / std)
                    if zscore > 3.0:
                        node_anomalies.append({
                            "metric": metric,
                            "zscore": round(zscore, 2),
                            "value": metrics.get(metric),
                            "baseline_mean": round(mean, 2),
                            "severity": "critical" if zscore > 4.5 else "warning",
                            "type": "statistical_deviation",
                        })

            # ── Rule 3: Rate of change (sudden spikes) ────────────────────────
            if len(self._history[node_id]) >= 3:
                prev = self._history[node_id][-2]
                for metric in ["latency", "packetLoss"]:
                    curr_val = metrics.get(metric, 0)
                    prev_val = prev.get(metric, 0)
                    if prev_val > 0:
                        roc = abs(curr_val - prev_val) / prev_val
                        if roc > 0.5:  # 50% change in one tick
                            node_anomalies.append({
                                "metric": metric,
                                "rate_of_change": round(roc * 100, 1),
                                "prev": prev_val,
                                "current": curr_val,
                                "severity": "critical" if roc > 1.0 else "warning",
                                "type": "rapid_change",
                            })

            if node_anomalies:
                anomalous_nodes.add(node_id)
                # Cooldown: don't re-alert same node within 6 ticks
                cooldown_key = node_id
                self._cooldown[cooldown_key] = self._cooldown.get(cooldown_key, 0)
                if self._cooldown[cooldown_key] <= 0:
                    anomalies.append({
                        "nodeId": node_id,
                        "nodeType": node_type,
                        "name": f"Anomaly on {node_id}",
                        "affected": [node_id],
                        "indicators": node_anomalies,
                        "severity": max(a["severity"] for a in node_anomalies),
                        "metrics": metrics,
                        "detectedAt": None,  # set by caller
                    })
                    self._cooldown[cooldown_key] = 6
                else:
                    self._cooldown[cooldown_key] -= 1

        # ── Composite pattern detection ───────────────────────────────────────
        for pattern in self.COMPOSITE_PATTERNS:
            for group in pattern["requires"]:
                if all(n in anomalous_nodes for n in group):
                    cid = pattern["id"]
                    if self._cooldown.get(cid, 0) <= 0:
                        anomalies.append({
                            "nodeId": group[0],
                            "nodeType": "composite",
                            "name": pattern["name"],
                            "affected": group,
                            "indicators": [{"type": "composite_pattern", "description": pattern["description"]}],
                            "severity": "critical",
                            "metrics": {n: snapshot.get(n, {}) for n in group},
                        })
                        self._cooldown[cid] = 10

        # Sort: critical first
        anomalies.sort(key=lambda a: 0 if a["severity"] == "critical" else 1)
        return anomalies