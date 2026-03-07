"""
agent.py — Claude-powered Network Operations Agent.
This is the core reasoning engine. It takes anomaly signals and
telemetry context, calls Claude with a detailed system prompt,
and returns structured reasoning + tiered action recommendations.
"""

import json
import time
import os
from datetime import datetime
from typing import Optional

import anthropic


SYSTEM_PROMPT = """You are an autonomous Network Operations Agent for Neurotech, a regional ISP.

Your role is to analyze network telemetry anomalies, reason about root causes across layers (physical, data link, network, transport), and recommend tiered interventions. You operate with expert-level knowledge of:
- BGP/OSPF routing protocols and failure modes
- ECMP load balancing and traffic engineering
- Fiber optic physical layer diagnostics
- DDoS patterns and mitigation
- QoS policies and congestion management
- ISP network architecture (core, edge, PoP, peering)

When analyzing an anomaly, you must:
1. Form a clear hypothesis explaining the observed signals
2. Identify the most likely root cause (be specific, not generic)
3. Assess the risk score (0-100) based on: blast radius, rate of degradation, customer impact potential
4. Propose exactly 3 actions with strict tier classification:
   - TIER 1 (type: "auto"): Fully reversible, low blast radius, safe to auto-execute in <60s
   - TIER 2 (type: "approve"): Moderate risk, requires operator approval, medium blast radius
   - TIER 3 (type: "escalate"): High risk or physical intervention required, must page NOC engineer

CRITICAL RULES:
- Never recommend a Tier 1 action that could cause a service outage
- Always include a rollback strategy for Tier 2+ actions
- Risk score must reflect customer impact: 1000 affected users = +20 risk points
- If multiple hypotheses exist, state the primary one but mention alternatives

Respond ONLY with a valid JSON object in this exact schema:
{
  "hypothesis": "string — detailed technical hypothesis explaining the anomaly signals",
  "rootCause": "string — most probable root cause with supporting evidence from the telemetry",
  "riskScore": number (0-100),
  "confidence": number (0-100),
  "affectedCustomersEstimate": number,
  "timeToImpact": "string — estimated time until customer-visible impact if unaddressed",
  "actions": [
    {
      "id": "string",
      "type": "auto|approve|escalate",
      "risk": "low|medium|high|critical",
      "label": "string — concise action title",
      "detail": "string — technical detail of what this action does",
      "rollback": "string — how to reverse this action",
      "eta": "string — estimated time to execute"
    }
  ]
}"""


class NetworkAgent:
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("[Agent] WARNING: ANTHROPIC_API_KEY not set. Reasoning will use fallback mode.")
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else None
        self._action_counter = 0

    async def reason(self, anomaly: dict, current_snapshot: dict, history: list) -> Optional[dict]:
        """
        Core reasoning loop. Feed anomaly + telemetry context to Claude.
        Returns structured incident analysis and action recommendations.
        """
        if not self.client:
            return self._fallback_reasoning(anomaly)

        # Build rich context for Claude
        affected_metrics = {
            node_id: current_snapshot.get(node_id, {})
            for node_id in anomaly["affected"]
        }

        # Extract trend from history for affected nodes
        trends = {}
        for node_id in anomaly["affected"]:
            node_vals = [h.get(node_id, {}) for h in history if node_id in h]
            if node_vals:
                trends[node_id] = {
                    "latency_trend": [round(v.get("latency", 0), 2) for v in node_vals[-5:]],
                    "utilization_trend": [round(v.get("utilization", 0), 1) for v in node_vals[-5:]],
                    "packetLoss_trend": [round(v.get("packetLoss", 0), 3) for v in node_vals[-5:]],
                }

        user_message = f"""ANOMALY DETECTED — Immediate analysis required.

Anomaly Type: {anomaly['name']}
Severity: {anomaly['severity'].upper()}
Affected Nodes: {', '.join(anomaly['affected'])}
Node Types: {', '.join(set(anomaly.get('nodeType', 'unknown') for _ in anomaly['affected']))}

Current Metrics on Affected Nodes:
{json.dumps(affected_metrics, indent=2)}

Recent Telemetry Trends (last 5 samples):
{json.dumps(trends, indent=2)}

Anomaly Indicators:
{json.dumps(anomaly['indicators'], indent=2)}

Full Network State (all nodes):
{json.dumps({k: {m: v for m, v in vals.items() if m != 'status'} for k, vals in current_snapshot.items()}, indent=2)}

Timestamp: {datetime.now().isoformat()}

Analyze this situation and provide your structured reasoning and action recommendations."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1500,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}]
            )

            raw = response.content[0].text.strip()
            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            result = json.loads(raw)

            # Ensure action IDs are unique
            for i, action in enumerate(result.get("actions", [])):
                self._action_counter += 1
                action["id"] = f"ACT-{self._action_counter:04d}"

            return result

        except json.JSONDecodeError as e:
            print(f"[Agent] JSON parse error: {e}")
            return self._fallback_reasoning(anomaly)
        except Exception as e:
            print(f"[Agent] Claude API error: {e}")
            return self._fallback_reasoning(anomaly)

    async def execute_action(self, action: dict, incident_id: str) -> dict:
        """
        Execute an approved action. In production this would call:
        - NETCONF/RESTCONF for config changes
        - gRPC for router telemetry
        - REST APIs for your NMS/orchestration layer
        
        Here we simulate execution with realistic timing.
        """
        import asyncio

        # Simulate execution time based on action type
        delay_map = {"auto": 0.5, "approve": 1.0, "escalate": 2.0}
        await asyncio.sleep(delay_map.get(action.get("type", "auto"), 1.0))

        # Simulate ~95% success rate
        import random
        success = random.random() > 0.05

        result = {
            **action,
            "incidentId": incident_id,
            "executedAt": datetime.now().isoformat(),
            "outcome": "success" if success else "failed",
            "status": "executed" if success else "failed",
            "executionLog": self._simulate_execution_log(action, success),
        }
        return result

    def _simulate_execution_log(self, action: str, success: bool) -> list:
        """Generate realistic CLI-style execution log."""
        label = action.get("label", "action")
        logs = [
            f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] Initiating: {label}",
            f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] Validating pre-conditions...",
            f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] Pre-flight checks passed",
            f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] Applying configuration...",
        ]
        if success:
            logs.append(f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] ✓ Action completed successfully")
            logs.append(f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] Rollback snapshot saved")
        else:
            logs.append(f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] ✗ Execution failed — reverting")
            logs.append(f"[{datetime.now().strftime('%H:%M:%S.%f')[:-3]}] State restored to pre-action snapshot")
        return logs

    def _fallback_reasoning(self, anomaly: dict) -> dict:
        """
        Fallback when Claude API is unavailable.
        Returns a generic but structured response based on anomaly type.
        """
        self._action_counter += 1
        affected = anomaly.get("affected", ["unknown"])
        severity = anomaly.get("severity", "warning")
        risk = 85 if severity == "critical" else 55

        return {
            "hypothesis": f"Anomaly signals detected on {', '.join(affected)}. Multiple metrics are outside normal operating ranges. Pattern analysis suggests degraded service conditions requiring immediate investigation.",
            "rootCause": f"Statistical deviation detected across {len(affected)} node(s). Most likely cause: traffic surge, hardware degradation, or upstream routing instability. Manual investigation recommended to confirm.",
            "riskScore": risk,
            "confidence": 60,
            "affectedCustomersEstimate": 5000 if severity == "critical" else 1000,
            "timeToImpact": "8-15 minutes" if severity == "critical" else "30-60 minutes",
            "actions": [
                {
                    "id": f"ACT-{self._action_counter:04d}",
                    "type": "auto",
                    "risk": "low",
                    "label": f"Increase monitoring frequency on {affected[0]}",
                    "detail": "Reduce telemetry polling interval from 30s to 5s for affected nodes",
                    "rollback": "Restore default polling interval",
                    "eta": "~10s",
                },
                {
                    "id": f"ACT-{self._action_counter+1:04d}",
                    "type": "approve",
                    "risk": "medium",
                    "label": "Pre-position traffic for potential failover",
                    "detail": "Adjust routing metrics to prepare alternate paths without activating failover",
                    "rollback": "Restore original metric values via rollback snapshot",
                    "eta": "~2min",
                },
                {
                    "id": f"ACT-{self._action_counter+2:04d}",
                    "type": "escalate",
                    "risk": "high",
                    "label": "Page on-call NOC engineer for investigation",
                    "detail": f"Escalate to L2 NOC with full telemetry report. Affected: {', '.join(affected)}",
                    "rollback": "N/A — informational escalation",
                    "eta": "~5min response",
                },
            ],
        }