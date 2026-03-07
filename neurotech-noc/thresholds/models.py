"""
models.py — Pydantic request/response models for the NOC API.
"""

from pydantic import BaseModel
from typing import Optional, Any


class ActionRequest(BaseModel):
    action: dict
    incident_id: str


class TelemetrySnapshot(BaseModel):
    node_id: str
    latency: float
    packetLoss: float
    utilization: float
    health: float


class ScenarioTrigger(BaseModel):
    scenario_id: str
    intensity: Optional[float] = 1.0