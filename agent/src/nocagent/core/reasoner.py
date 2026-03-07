"""
Reasoner — uses Claude with tool-use to diagnose network anomalies.

Sends the anomaly context to Claude, which can call tools to investigate
further, then produces a diagnosis with recommended actions.
"""

from __future__ import annotations

import json
from typing import Any

import anthropic
import structlog

from nocagent.config.settings import settings
from nocagent.tools.definitions import AGENT_TOOLS
from nocagent.tools.handlers import handle_tool_call
from nocagent.events import agent_event_bus

logger = structlog.get_logger()

SYSTEM_PROMPT = """You are an expert AI Network Operations Center (NOC) engineer.
You monitor an ISP network with devices in Delhi and Mumbai.

Your job: diagnose network anomalies, determine root causes, and recommend or execute fixes.

Network architecture:
- Core routers: inter-city backbone (core-delhi-1, core-delhi-2, core-mumbai-1, core-mumbai-2)
- Edge routers: connect to customers (edge-delhi-north, edge-delhi-south, edge-mumbai-central, edge-mumbai-harbor)
- Peering routers: connect to external networks (peer-delhi-1 with Google AS15169, peer-mumbai-1 with Cloudflare AS13335)
- Links: fiber backbone (100Gbps inter-city), fiber intra (200Gbps intra-city), fiber metro (40Gbps core-to-edge), peering (40Gbps)

When investigating anomalies:
1. Query relevant device/link metrics to understand the situation
2. Check the network topology for context
3. Look at BGP sessions if routing might be affected
4. Estimate customer impact
5. Check past incidents for similar patterns
6. Recommend the most appropriate action with clear reasoning

Action tiers:
- Tier 1 (auto): Alerts, logging, incident creation
- Tier 2 (auto+audit): Rate limiting, QoS tweaks
- Tier 3 (recommend): Traffic rerouting, config changes — needs human approval
- Tier 4 (escalate): Device restarts, BGP withdrawals — always needs human approval

Be concise, precise, and data-driven. Always explain your reasoning.
When you have enough information, create an incident and recommend/execute appropriate actions."""


class Reasoner:
    def __init__(self):
        self._client = anthropic.AsyncAnthropic(api_key=settings.claude_api_key)

    async def diagnose(
        self, anomalies: list, telemetry_context: dict[str, Any]
    ) -> dict[str, Any]:
        anomaly_descriptions = "\n".join(
            f"- [{a.severity.upper()}] {a.description} "
            f"(type={a.anomaly_type}, source={a.source_id}, "
            f"metric={a.metric}, value={a.current_value}, threshold={a.threshold})"
            for a in anomalies
        )

        overview = telemetry_context.get("overview", {})
        user_message = (
            f"ANOMALIES DETECTED:\n{anomaly_descriptions}\n\n"
            f"NETWORK OVERVIEW:\n"
            f"- Health score: {overview.get('health_score', 'N/A')}/100\n"
            f"- Total throughput: {overview.get('total_throughput_gbps', 'N/A')} Gbps\n"
            f"- Avg latency: {overview.get('avg_latency_ms', 'N/A')} ms\n"
            f"- Device status: {overview.get('device_status', {})}\n"
            f"- Link status: {overview.get('link_status', {})}\n\n"
            f"Investigate these anomalies. Query metrics for affected devices/links, "
            f"determine root cause, estimate customer impact, and take appropriate action."
        )

        messages = [{"role": "user", "content": user_message}]
        full_reasoning = []
        tool_calls_made = []
        max_turns = 10

        await agent_event_bus.publish("reasoning_started", {
            "anomaly_count": len(anomalies),
            "anomaly_types": list({a.anomaly_type for a in anomalies}),
        })

        for turn in range(max_turns):
            response = await self._client.messages.create(
                model=settings.claude_model,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=AGENT_TOOLS,
                messages=messages,
            )

            # Process response content
            assistant_content = response.content
            messages.append({"role": "assistant", "content": assistant_content})

            # Collect text blocks as reasoning
            for block in assistant_content:
                if block.type == "text":
                    full_reasoning.append(block.text)

            # If no tool use, we're done
            if response.stop_reason != "tool_use":
                break

            # Execute tool calls
            tool_results = []
            for block in assistant_content:
                if block.type == "tool_use":
                    tool_name = block.name
                    tool_input = block.input

                    logger.info(
                        "claude_tool_call",
                        tool=tool_name,
                        input=tool_input,
                        turn=turn,
                    )

                    result = await handle_tool_call(tool_name, tool_input)
                    tool_calls_made.append({
                        "tool": tool_name,
                        "input": tool_input,
                        "result_preview": result[:500],
                    })

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

                    await agent_event_bus.publish("tool_executed", {
                        "tool": tool_name,
                        "turn": turn,
                    })

            messages.append({"role": "user", "content": tool_results})

        reasoning_text = "\n\n".join(full_reasoning)

        await agent_event_bus.publish("reasoning_completed", {
            "turns": turn + 1,
            "tool_calls": len(tool_calls_made),
            "reasoning_length": len(reasoning_text),
        })

        return {
            "reasoning": reasoning_text,
            "tool_calls": tool_calls_made,
            "turns": turn + 1,
            "anomalies": [
                {
                    "type": a.anomaly_type,
                    "source_id": a.source_id,
                    "severity": a.severity,
                    "description": a.description,
                }
                for a in anomalies
            ],
        }


reasoner = Reasoner()
