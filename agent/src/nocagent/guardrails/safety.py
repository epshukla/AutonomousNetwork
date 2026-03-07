"""
Pre-action safety checks — validates that an action is safe before execution.
"""

from __future__ import annotations

import structlog

logger = structlog.get_logger()

MAX_CONCURRENT_RESTARTS = 1
MAX_RATE_LIMIT_MBPS = 100000
MIN_CONFIDENCE_FOR_ACTION = 0.3


def validate_action(action_type: str, parameters: dict, confidence: float) -> tuple[bool, str]:
    if confidence < MIN_CONFIDENCE_FOR_ACTION:
        return False, f"Confidence {confidence} below minimum {MIN_CONFIDENCE_FOR_ACTION}"

    if action_type == "restart_device":
        device_id = parameters.get("device_id", "")
        if "core" in device_id:
            return False, "Cannot auto-restart core routers — requires manual approval"

    if action_type == "apply_rate_limit":
        limit = parameters.get("limit_mbps", 0)
        if limit > MAX_RATE_LIMIT_MBPS:
            return False, f"Rate limit {limit}Mbps exceeds maximum {MAX_RATE_LIMIT_MBPS}Mbps"
        if limit <= 0:
            return False, "Rate limit must be positive"

    if action_type == "execute_reroute":
        from_link = parameters.get("from_link", "")
        to_link = parameters.get("to_link", "")
        if from_link == to_link:
            return False, "Cannot reroute to the same link"

    return True, "OK"
