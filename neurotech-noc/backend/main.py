"""
Neurotech NOC — Autonomous Network Operations Backend
FastAPI + Claude AI + WebSocket live telemetry
"""

import asyncio
import json
import random
import math
import time
import sys
import os
from datetime import datetime
from typing import Optional
from collections import deque

# Add parent directory to path so we can import from sibling dirs
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import anthropic
import uvicorn

# Import from sibling directories
from REST_endpoints.telemetry import TelemetrySimulator
from REST_endpoints.anomaly import AnomalyDetector
from REST_endpoints.agent import NetworkAgent
from thresholds.models import ActionRequest, TelemetrySnapshot

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="Neurotech NOC API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global State ──────────────────────────────────────────────────────────────
telemetry_sim = TelemetrySimulator()
anomaly_detector = AnomalyDetector()
network_agent = NetworkAgent()

connected_clients: list[WebSocket] = []
incident_history: list[dict] = []
action_history: list[dict] = []
telemetry_history: deque = deque(maxlen=500)  # rolling window for learning


# ── WebSocket Broadcast ───────────────────────────────────────────────────────
async def broadcast(message: dict):
    disconnected = []
    for ws in connected_clients:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        connected_clients.remove(ws)


# ── Background Telemetry Loop ─────────────────────────────────────────────────
async def telemetry_loop():
    """Main observe → reason → decide → act loop. Runs every 2 seconds."""
    tick = 0
    while True:
        await asyncio.sleep(2)
        tick += 1

        # 1. OBSERVE — get latest telemetry
        snapshot = telemetry_sim.tick()
        telemetry_history.append(snapshot)

        # 2. DETECT anomalies
        anomalies = anomaly_detector.analyze(snapshot, list(telemetry_history))

        # 3. Broadcast telemetry to all connected frontends
        await broadcast({
            "type": "telemetry",
            "tick": tick,
            "data": snapshot,
            "anomalies": anomalies,
            "timestamp": datetime.now().isoformat(),
        })

        # 4. REASON — if anomalies detected, invoke agent
        if anomalies and tick % 3 == 0:  # throttle to avoid hammering Claude API
            for anomaly in anomalies[:1]:  # process one anomaly at a time
                await broadcast({
                    "type": "agent_state",
                    "state": "reasoning",
                    "anomaly": anomaly,
                })

                # Call Claude to reason about the anomaly
                reasoning = await network_agent.reason(anomaly, snapshot, list(telemetry_history)[-20:])

                if reasoning:
                    incident = {
                        "id": f"INC-{int(time.time())}",
                        "name": anomaly["name"],
                        "time": datetime.now().strftime("%H:%M:%S"),
                        "affected": anomaly["affected"],
                        "riskScore": reasoning.get("riskScore", 50),
                        "hypothesis": reasoning.get("hypothesis", ""),
                        "rootCause": reasoning.get("rootCause", ""),
                        "actions": reasoning.get("actions", []),
                        "confidence": reasoning.get("confidence"),
                        "status": "active",
                    }
                    incident_history.append(incident)

                    await broadcast({
                        "type": "incident",
                        "incident": incident,
                    })

                    await broadcast({
                        "type": "agent_state",
                        "state": "acting",
                    })

                    # Auto-execute Tier 1 actions
                    for action in reasoning.get("actions", []):
                        if action["type"] == "auto":
                            result = await network_agent.execute_action(action, incident["id"])
                            action_history.append(result)
                            await broadcast({
                                "type": "action_executed",
                                "action": result,
                            })


@app.on_event("startup")
async def startup():
    asyncio.create_task(telemetry_loop())


# ── REST Endpoints ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "Neurotech NOC Backend", "version": "1.0.0"}


@app.get("/telemetry/current")
def get_current_telemetry():
    """Latest snapshot of all node telemetry."""
    return telemetry_sim.current_snapshot()


@app.get("/telemetry/history")
def get_telemetry_history(limit: int = 100):
    """Recent telemetry history for graphing."""
    history = list(telemetry_history)[-limit:]
    return {"snapshots": history, "count": len(history)}


@app.get("/incidents")
def get_incidents():
    """All detected incidents."""
    return {"incidents": incident_history, "count": len(incident_history)}


@app.get("/incidents/{incident_id}")
def get_incident(incident_id: str):
    for inc in incident_history:
        if inc["id"] == incident_id:
            return inc
    raise HTTPException(status_code=404, detail="Incident not found")


@app.get("/actions/history")
def get_action_history():
    """All executed actions with outcomes."""
    return {"actions": action_history, "count": len(action_history)}


@app.post("/actions/approve")
async def approve_action(request: ActionRequest):
    """Operator approves a Tier 2 action."""
    result = await network_agent.execute_action(request.action, request.incident_id)
    result["approvedBy"] = "operator"
    action_history.append(result)

    await broadcast({
        "type": "action_executed",
        "action": result,
    })
    return result


@app.post("/actions/reject")
async def reject_action(request: ActionRequest):
    """Operator rejects a proposed action."""
    entry = {
        **request.action,
        "status": "rejected",
        "rejectedAt": datetime.now().isoformat(),
        "incidentId": request.incident_id,
    }
    action_history.append(entry)
    await broadcast({"type": "action_rejected", "action": entry})
    return entry


@app.post("/actions/rollback/{action_id}")
async def rollback_action(action_id: str):
    """Roll back a previously executed action."""
    for action in reversed(action_history):
        if action.get("id") == action_id:
            rollback = {
                **action,
                "status": "rolled_back",
                "rolledBackAt": datetime.now().isoformat(),
            }
            action_history.append(rollback)
            await broadcast({"type": "action_rolled_back", "action": rollback})
            return rollback
    raise HTTPException(status_code=404, detail="Action not found")


@app.post("/simulate/scenario/{scenario_id}")
async def trigger_scenario(scenario_id: str):
    """Manually trigger a failure scenario for testing."""
    result = telemetry_sim.inject_scenario(scenario_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {scenario_id}")
    return {"triggered": scenario_id, "affected": result}


@app.get("/agent/stats")
def get_agent_stats():
    """Agent performance stats for the learn loop."""
    total = len(action_history)
    successful = sum(1 for a in action_history if a.get("outcome") == "success")
    rolled_back = sum(1 for a in action_history if a.get("status") == "rolled_back")
    return {
        "totalActions": total,
        "successRate": round(successful / total * 100, 1) if total else 0,
        "rollbackRate": round(rolled_back / total * 100, 1) if total else 0,
        "incidentsDetected": len(incident_history),
        "nodesMonitored": len(telemetry_sim.NODES),
        "telemetryPoints": len(telemetry_history),
    }


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"[WS] Client connected. Total: {len(connected_clients)}")

    # Send current state immediately on connect
    await websocket.send_json({
        "type": "init",
        "telemetry": telemetry_sim.current_snapshot(),
        "incidents": incident_history[-10:],
        "actions": action_history[-20:],
    })

    try:
        while True:
            # Keep connection alive, handle incoming messages
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        print(f"[WS] Client disconnected. Total: {len(connected_clients)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)