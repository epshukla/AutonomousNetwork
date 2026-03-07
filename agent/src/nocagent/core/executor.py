"""
Executor — executes approved actions against the simulator API.
"""

from __future__ import annotations

import structlog

from nocagent.tools.handlers import handle_tool_call
from nocagent.core.decision_engine import decision_engine
from nocagent.events import agent_event_bus

logger = structlog.get_logger()


class Executor:
    async def execute_decision(self, decision: dict) -> dict:
        action_type = decision["action_type"]
        parameters = decision.get("parameters", {})
        decision_id = decision["id"]

        logger.info(
            "executing_decision",
            decision_id=decision_id,
            action=action_type,
        )

        await agent_event_bus.publish("action_executing", {
            "decision_id": decision_id,
            "action_type": action_type,
        })

        try:
            result = await handle_tool_call(action_type, parameters)

            import json
            result_data = json.loads(result)
            success = "error" not in result_data

            await decision_engine.mark_executed(
                decision_id,
                outcome=result,
                success=success,
            )

            await agent_event_bus.publish("action_completed", {
                "decision_id": decision_id,
                "action_type": action_type,
                "success": success,
            })

            logger.info(
                "decision_executed",
                decision_id=decision_id,
                success=success,
            )

            return {"decision_id": decision_id, "success": success, "result": result_data}

        except Exception as e:
            await decision_engine.mark_executed(
                decision_id,
                outcome=str(e),
                success=False,
            )
            logger.exception("decision_execution_failed", decision_id=decision_id)
            return {"decision_id": decision_id, "success": False, "error": str(e)}


executor = Executor()
