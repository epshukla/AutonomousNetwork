"""
Reasoner — single-shot Claude diagnosis (no tool_use, no loop).

Inspired by C26/AgenticAi_Claude pattern: pre-fetch ALL context,
pack into ONE prompt, get ONE response. Max 1-2 API calls per incident.
"""

from __future__ import annotations

import json
import re
from typing import Any

import anthropic
import structlog
from sqlalchemy import text

from nocagent.config.settings import settings
from nocagent.db.engine import async_session
from nocagent.core.decision_engine import decision_engine
from nocagent.core.observer import observer
from nocagent.tools.handlers import (
    _summarize_timeseries,
    get_http_client,
)
from nocagent.events import agent_event_bus

logger = structlog.get_logger()

SYSTEM_PROMPT = """You are an expert AI Network Operations Center (NOC) engineer.
You monitor an ISP backbone network with devices in Delhi and Mumbai.

Network architecture:
- Core routers (100Gbps inter-city backbone): core-delhi-1, core-delhi-2, core-mumbai-1, core-mumbai-2
- Edge routers (40Gbps metro, customer-facing): edge-delhi-north, edge-delhi-south, edge-mumbai-central, edge-mumbai-harbor
- Peering routers (40Gbps external): peer-delhi-1 (Google AS15169), peer-mumbai-1 (Cloudflare AS13335)
- Links: fiber backbone (100Gbps), fiber intra (200Gbps), fiber metro (40Gbps), peering (40Gbps)

Autonomy tiers:
- Tier 1 (auto): Alerts, logging — no approval needed
- Tier 2 (auto+audit): Rate limiting, QoS — auto-approved with audit trail
- Tier 3 (recommend): Traffic rerouting — needs human approval
- Tier 4 (escalate): Device restarts, BGP changes — always needs human approval

Your task: Analyze the provided network data, diagnose the root cause, and recommend specific actions.

IMPORTANT: Return your response in this EXACT format:

## ROOT CAUSE ANALYSIS
<your detailed diagnosis here>

## CUSTOMER IMPACT
<estimated impact on customers>

## RECOMMENDED ACTIONS
```json
[
  {
    "action_type": "apply_rate_limit|execute_reroute|restart_device|escalate_to_engineer",
    "parameters": { <action-specific params> },
    "reasoning": "<why this action>",
    "confidence": <0.0-1.0>,
    "blast_radius": <estimated affected customers as integer>
  }
]
```

Parameter schemas:
- apply_rate_limit: {"target": "<device/link id>", "limit_mbps": <number>, "duration_minutes": <number>, "reason": "<text>"}
- execute_reroute: {"from_link": "<link_id>", "to_link": "<link_id>", "reason": "<text>"}
- restart_device: {"device_id": "<id>", "reason": "<text>", "graceful": true}
- escalate_to_engineer: {"urgency": "low|medium|high|critical", "context": "<text>", "recommended_action": "<text>"}

Be concise, precise, and data-driven."""


class Reasoner:
    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.claude_api_key)

    async def diagnose_incident(self, incident_id: int) -> dict[str, Any]:
        """
        Single-shot diagnosis: pre-fetch all context, ONE Claude API call.
        Like C26's process_task_two_step() — gather context, then ask Claude.
        """

        # 1. Load the incident from DB
        incident = await self._load_incident(incident_id)
        if not incident:
            return {"error": f"Incident {incident_id} not found"}

        # 2. Load previous conversation history for this incident (for follow-ups)
        conversation_history = incident.get("conversation_history") or []

        # 3. Pre-fetch ALL network context (no Claude API calls — just HTTP to simulator)
        context = await self._gather_context(incident)

        # 4. Build the user message with full context
        user_message = self._build_prompt(incident, context)

        # 5. Append to conversation history
        conversation_history.append({"role": "user", "content": user_message})

        await agent_event_bus.publish("reasoning_started", {
            "incident_id": incident_id,
        })

        # 6. ONE Claude API call
        response = await self._client.messages.create(
            model=settings.claude_model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=conversation_history,
        )

        assistant_message = response.content[0].text

        # 7. Append response to history
        conversation_history.append({"role": "assistant", "content": assistant_message})

        # 8. Parse response and create decision records
        actions = self._parse_actions(assistant_message)
        decision_ids = []
        for action in actions:
            decision = await decision_engine.create_decision(
                incident_id=incident_id,
                action_type=action["action_type"],
                reasoning=action.get("reasoning", ""),
                parameters=action.get("parameters", {}),
                confidence=action.get("confidence", 0.7),
                blast_radius=action.get("blast_radius", 0),
            )
            decision_ids.append(decision["id"])

        # 9. Save AI suggestion + conversation history to incident
        await self._save_diagnosis(
            incident_id, assistant_message, conversation_history
        )

        await agent_event_bus.publish("reasoning_completed", {
            "incident_id": incident_id,
            "actions_proposed": len(actions),
            "decision_ids": decision_ids,
        })

        logger.info(
            "diagnosis_complete",
            incident_id=incident_id,
            actions=len(actions),
            decisions=decision_ids,
        )

        return {
            "incident_id": incident_id,
            "diagnosis": assistant_message,
            "actions_proposed": len(actions),
            "decision_ids": decision_ids,
        }

    async def _load_incident(self, incident_id: int) -> dict | None:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT * FROM incidents WHERE id = :id"),
                {"id": incident_id},
            )
            row = result.fetchone()
            if not row:
                return None
            return {
                "id": row.id,
                "title": row.title,
                "severity": row.severity,
                "status": row.status,
                "detected_at": row.detected_at.isoformat() if row.detected_at else None,
                "affected_devices": row.affected_devices or [],
                "affected_links": row.affected_links or [],
                "root_cause_hypothesis": row.root_cause_hypothesis,
                "conversation_history": row.metadata.get("conversation_history", []) if row.metadata else [],
            }

    async def _gather_context(self, incident: dict) -> dict:
        """Pre-fetch all relevant network data. No Claude calls — just HTTP."""
        client = get_http_client()
        context = {}

        try:
            # Network overview
            resp = await client.get("/api/v1/telemetry/overview")
            context["overview"] = resp.json()
        except Exception:
            context["overview"] = {}

        try:
            # Topology
            resp = await client.get("/api/v1/topology")
            context["topology"] = resp.json()
        except Exception:
            context["topology"] = {}

        try:
            # BGP sessions
            resp = await client.get("/api/v1/topology/bgp-sessions")
            context["bgp_sessions"] = resp.json()
        except Exception:
            context["bgp_sessions"] = []

        # Device telemetry for affected devices
        from datetime import datetime, timezone, timedelta
        end = datetime.now(timezone.utc)
        start = end - timedelta(minutes=30)

        context["device_metrics"] = {}
        for device_id in incident.get("affected_devices", []):
            try:
                resp = await client.get(
                    f"/api/v1/telemetry/devices/{device_id}",
                    params={"start": start.isoformat(), "end": end.isoformat()},
                )
                data = resp.json().get("data", [])
                context["device_metrics"][device_id] = _summarize_timeseries(
                    data, ["cpu_utilization", "memory_utilization", "temperature_celsius"]
                )
            except Exception:
                pass

        # Link telemetry for affected links
        context["link_metrics"] = {}
        for link_id in incident.get("affected_links", []):
            try:
                resp = await client.get(
                    f"/api/v1/telemetry/links/{link_id}",
                    params={"start": start.isoformat(), "end": end.isoformat()},
                )
                data = resp.json().get("data", [])
                context["link_metrics"][link_id] = _summarize_timeseries(
                    data, ["utilization_percent", "throughput_gbps", "latency_ms", "packet_loss_percent"]
                )
            except Exception:
                pass

        # Past similar incidents
        context["past_incidents"] = []
        try:
            async with async_session() as session:
                result = await session.execute(
                    text(
                        "SELECT id, title, severity, status, detected_at, "
                        "root_cause_hypothesis, final_root_cause "
                        "FROM incidents "
                        "WHERE id != :id AND detected_at > NOW() - INTERVAL '48 hours' "
                        "ORDER BY detected_at DESC LIMIT 5"
                    ),
                    {"id": incident["id"]},
                )
                context["past_incidents"] = [
                    {
                        "id": r.id,
                        "title": r.title,
                        "severity": r.severity,
                        "status": r.status,
                        "root_cause": r.final_root_cause or r.root_cause_hypothesis,
                    }
                    for r in result.fetchall()
                ]
        except Exception:
            pass

        return context

    def _build_prompt(self, incident: dict, context: dict) -> str:
        """Pack all context into a single user message."""
        overview = context.get("overview", {})
        topo = context.get("topology", {})

        # Device summary
        devices_section = ""
        for dev_id, metrics in context.get("device_metrics", {}).items():
            summary = metrics.get("summary", {})
            devices_section += f"\n  {dev_id}:"
            for metric, stats in summary.items():
                devices_section += f"\n    {metric}: avg={stats['avg']}, max={stats['max']}, latest={stats['latest']}"

        # Link summary
        links_section = ""
        for link_id, metrics in context.get("link_metrics", {}).items():
            summary = metrics.get("summary", {})
            links_section += f"\n  {link_id}:"
            for metric, stats in summary.items():
                links_section += f"\n    {metric}: avg={stats['avg']}, max={stats['max']}, latest={stats['latest']}"

        # BGP summary
        bgp_section = ""
        for session in context.get("bgp_sessions", []):
            bgp_section += f"\n  {session.get('device_id', '?')} → AS{session.get('peer_as', '?')}: {session.get('status', '?')}, flaps={session.get('flap_count', 0)}"

        # Past incidents
        past_section = ""
        for inc in context.get("past_incidents", []):
            past_section += f"\n  [{inc['severity']}] {inc['title']} — {inc.get('root_cause', 'Unknown')}"

        # Device/link status from topology
        device_status = {}
        for dev_id, dev in topo.get("devices", {}).items():
            device_status[dev_id] = dev.get("status", "unknown")
        link_status = {}
        for link_id, link in topo.get("links", {}).items():
            link_status[link_id] = link.get("status", "unknown")

        prompt = f"""INCIDENT #{incident['id']}: {incident['title']}
Severity: {incident['severity']}
Detected: {incident.get('detected_at', 'Unknown')}
Affected Devices: {', '.join(incident.get('affected_devices', [])) or 'None identified'}
Affected Links: {', '.join(incident.get('affected_links', [])) or 'None identified'}
Initial Hypothesis: {incident.get('root_cause_hypothesis', 'None')}

NETWORK OVERVIEW:
  Health Score: {overview.get('health_score', 'N/A')}/100
  Devices: {overview.get('device_count', 'N/A')} total — {overview.get('device_status', {})}
  Links: {overview.get('link_count', 'N/A')} total — {overview.get('link_status', {})}
  Avg CPU: {overview.get('avg_cpu_percent', 'N/A')}%
  Avg Memory: {overview.get('avg_memory_percent', 'N/A')}%
  Avg Latency: {overview.get('avg_latency_ms', 'N/A')} ms
  Avg Packet Loss: {overview.get('avg_packet_loss_percent', 'N/A')}%

DEVICE STATUS: {json.dumps(device_status, indent=2) if device_status else 'N/A'}

LINK STATUS: {json.dumps(link_status, indent=2) if link_status else 'N/A'}

AFFECTED DEVICE TELEMETRY (last 30 min):{devices_section or ' No data'}

AFFECTED LINK TELEMETRY (last 30 min):{links_section or ' No data'}

BGP SESSIONS:{bgp_section or ' No sessions'}

RECENT INCIDENTS (last 48h):{past_section or ' None'}

Analyze this incident. Identify the root cause, estimate customer impact, and recommend specific actions to resolve it."""

        return prompt

    def _parse_actions(self, response_text: str) -> list[dict]:
        """Parse recommended actions JSON from Claude's response."""
        try:
            # Find JSON array in the response
            json_match = re.search(r'```json\s*(\[.*?\])\s*```', response_text, re.DOTALL)
            if json_match:
                actions = json.loads(json_match.group(1))
                return [a for a in actions if isinstance(a, dict) and "action_type" in a]

            # Fallback: try to find any JSON array
            json_match = re.search(r'\[\s*\{.*?\}\s*\]', response_text, re.DOTALL)
            if json_match:
                actions = json.loads(json_match.group())
                return [a for a in actions if isinstance(a, dict) and "action_type" in a]
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning("failed_to_parse_actions", error=str(e))

        return []

    async def _save_diagnosis(
        self, incident_id: int, diagnosis: str, conversation_history: list
    ):
        """Save Claude's diagnosis and conversation history to the incident."""
        async with async_session() as session:
            async with session.begin():
                await session.execute(
                    text(
                        "UPDATE incidents SET "
                        "claude_reasoning = :diagnosis, "
                        "status = CASE WHEN status = 'open' THEN 'analyzing' ELSE status END, "
                        "metadata = CAST(:metadata AS jsonb) "
                        "WHERE id = :id"
                    ),
                    {
                        "id": incident_id,
                        "diagnosis": diagnosis,
                        "metadata": json.dumps({
                            "conversation_history": conversation_history,
                        }),
                    },
                )


reasoner = Reasoner()
