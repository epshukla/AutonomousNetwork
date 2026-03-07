"""
Statistical anomaly detector — no LLM, pure threshold-based detection
with configurable thresholds that the learning loop can update.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import structlog

logger = structlog.get_logger()


@dataclass
class Anomaly:
    anomaly_type: str
    source_id: str
    source_type: str  # "device" | "link" | "bgp"
    severity: str  # "warning" | "critical" | "emergency"
    metric: str
    current_value: float
    threshold: float
    description: str


class AnomalyDetector:
    def __init__(self):
        self.thresholds = {
            "link_utilization_warning": 75.0,
            "link_utilization_critical": 90.0,
            "latency_spike_factor": 2.0,
            "packet_loss_warning": 0.5,
            "packet_loss_critical": 2.0,
            "device_cpu_warning": 80.0,
            "device_cpu_critical": 95.0,
            "device_memory_warning": 85.0,
            "device_memory_critical": 95.0,
            "device_temp_warning": 70.0,
            "bgp_flap_threshold": 3,
        }

    def update_thresholds(self, updates: dict[str, float]):
        self.thresholds.update(updates)
        logger.info("thresholds_updated", updates=updates)

    async def detect(self, telemetry: dict[str, Any]) -> list[Anomaly]:
        anomalies = []

        devices = telemetry.get("devices", {})
        for device_id, device in devices.items():
            anomalies.extend(self._check_device(device_id, device))

        links = telemetry.get("links", {})
        for link_id, link in links.items():
            anomalies.extend(self._check_link(link_id, link))

        bgp_sessions = telemetry.get("bgp_sessions", [])
        for session in bgp_sessions:
            anomalies.extend(self._check_bgp(session))

        if anomalies:
            logger.info("anomalies_detected", count=len(anomalies))

        return anomalies

    def _check_device(self, device_id: str, device: dict) -> list[Anomaly]:
        anomalies = []
        status = device.get("status", "healthy")

        if status == "down":
            anomalies.append(Anomaly(
                anomaly_type="device_down",
                source_id=device_id,
                source_type="device",
                severity="emergency",
                metric="status",
                current_value=0,
                threshold=0,
                description=f"Device {device_id} is DOWN",
            ))
            return anomalies

        cpu = device.get("cpu_utilization", 0)
        if cpu >= self.thresholds["device_cpu_critical"]:
            anomalies.append(Anomaly(
                anomaly_type="high_cpu",
                source_id=device_id,
                source_type="device",
                severity="critical",
                metric="cpu_utilization",
                current_value=cpu,
                threshold=self.thresholds["device_cpu_critical"],
                description=f"Device {device_id} CPU at {cpu:.1f}% (critical threshold: {self.thresholds['device_cpu_critical']}%)",
            ))
        elif cpu >= self.thresholds["device_cpu_warning"]:
            anomalies.append(Anomaly(
                anomaly_type="high_cpu",
                source_id=device_id,
                source_type="device",
                severity="warning",
                metric="cpu_utilization",
                current_value=cpu,
                threshold=self.thresholds["device_cpu_warning"],
                description=f"Device {device_id} CPU at {cpu:.1f}% (warning threshold: {self.thresholds['device_cpu_warning']}%)",
            ))

        mem = device.get("memory_utilization", 0)
        if mem >= self.thresholds["device_memory_critical"]:
            anomalies.append(Anomaly(
                anomaly_type="high_memory",
                source_id=device_id,
                source_type="device",
                severity="critical",
                metric="memory_utilization",
                current_value=mem,
                threshold=self.thresholds["device_memory_critical"],
                description=f"Device {device_id} memory at {mem:.1f}%",
            ))
        elif mem >= self.thresholds["device_memory_warning"]:
            anomalies.append(Anomaly(
                anomaly_type="high_memory",
                source_id=device_id,
                source_type="device",
                severity="warning",
                metric="memory_utilization",
                current_value=mem,
                threshold=self.thresholds["device_memory_warning"],
                description=f"Device {device_id} memory at {mem:.1f}%",
            ))

        temp = device.get("temperature_celsius", 0)
        if temp >= self.thresholds["device_temp_warning"]:
            anomalies.append(Anomaly(
                anomaly_type="high_temperature",
                source_id=device_id,
                source_type="device",
                severity="warning",
                metric="temperature_celsius",
                current_value=temp,
                threshold=self.thresholds["device_temp_warning"],
                description=f"Device {device_id} temperature at {temp:.1f}°C",
            ))

        return anomalies

    def _check_link(self, link_id: str, link: dict) -> list[Anomaly]:
        anomalies = []
        status = link.get("status", "up")

        if status == "down":
            anomalies.append(Anomaly(
                anomaly_type="link_down",
                source_id=link_id,
                source_type="link",
                severity="critical",
                metric="status",
                current_value=0,
                threshold=0,
                description=f"Link {link_id} is DOWN",
            ))
            return anomalies

        util = link.get("utilization_percent", 0)
        if util >= self.thresholds["link_utilization_critical"]:
            anomalies.append(Anomaly(
                anomaly_type="high_utilization",
                source_id=link_id,
                source_type="link",
                severity="critical",
                metric="utilization_percent",
                current_value=util,
                threshold=self.thresholds["link_utilization_critical"],
                description=f"Link {link_id} utilization at {util:.1f}%",
            ))
        elif util >= self.thresholds["link_utilization_warning"]:
            anomalies.append(Anomaly(
                anomaly_type="high_utilization",
                source_id=link_id,
                source_type="link",
                severity="warning",
                metric="utilization_percent",
                current_value=util,
                threshold=self.thresholds["link_utilization_warning"],
                description=f"Link {link_id} utilization at {util:.1f}%",
            ))

        loss = link.get("packet_loss_percent", 0)
        if loss >= self.thresholds["packet_loss_critical"]:
            anomalies.append(Anomaly(
                anomaly_type="packet_loss",
                source_id=link_id,
                source_type="link",
                severity="critical",
                metric="packet_loss_percent",
                current_value=loss,
                threshold=self.thresholds["packet_loss_critical"],
                description=f"Link {link_id} packet loss at {loss:.2f}%",
            ))
        elif loss >= self.thresholds["packet_loss_warning"]:
            anomalies.append(Anomaly(
                anomaly_type="packet_loss",
                source_id=link_id,
                source_type="link",
                severity="warning",
                metric="packet_loss_percent",
                current_value=loss,
                threshold=self.thresholds["packet_loss_warning"],
                description=f"Link {link_id} packet loss at {loss:.2f}%",
            ))

        return anomalies

    def _check_bgp(self, session: dict) -> list[Anomaly]:
        anomalies = []
        device_id = session.get("device_id", "")
        status = session.get("status", "established")

        if status != "established":
            anomalies.append(Anomaly(
                anomaly_type="bgp_session_down",
                source_id=device_id,
                source_type="bgp",
                severity="critical",
                metric="bgp_status",
                current_value=0,
                threshold=0,
                description=f"BGP session on {device_id} with AS{session.get('peer_as')} is {status}",
            ))

        flaps = session.get("flap_count", 0)
        if flaps >= self.thresholds["bgp_flap_threshold"]:
            anomalies.append(Anomaly(
                anomaly_type="bgp_flapping",
                source_id=device_id,
                source_type="bgp",
                severity="warning",
                metric="flap_count",
                current_value=flaps,
                threshold=self.thresholds["bgp_flap_threshold"],
                description=f"BGP session on {device_id} flapping — {flaps} flaps",
            ))

        return anomalies


anomaly_detector = AnomalyDetector()
