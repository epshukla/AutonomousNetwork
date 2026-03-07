"""
Rollback mechanisms — undo actions if they make things worse.
"""

from __future__ import annotations

import structlog

from nocagent.tools.handlers import handle_tool_call

logger = structlog.get_logger()


async def rollback_action(action_type: str, parameters: dict) -> dict:
    if action_type == "execute_reroute":
        # Reverse the reroute
        return await _rollback_reroute(parameters)
    elif action_type == "apply_rate_limit":
        # Remove rate limit by setting very high limit
        return await _rollback_rate_limit(parameters)
    else:
        logger.warning("no_rollback_available", action_type=action_type)
        return {"status": "no_rollback", "action_type": action_type}


async def _rollback_reroute(params: dict) -> dict:
    result = await handle_tool_call("execute_reroute", {
        "from_link": params["to_link"],
        "to_link": params["from_link"],
        "reason": f"Rollback of reroute: {params.get('reason', '')}",
    })
    logger.info("reroute_rolled_back", params=params)
    return {"status": "rolled_back", "action": "reroute"}


async def _rollback_rate_limit(params: dict) -> dict:
    result = await handle_tool_call("apply_rate_limit", {
        "target": params["target"],
        "limit_mbps": 100000,
        "reason": f"Rollback of rate limit: {params.get('reason', '')}",
    })
    logger.info("rate_limit_rolled_back", params=params)
    return {"status": "rolled_back", "action": "rate_limit"}
