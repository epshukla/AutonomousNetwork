"""
Observer — collects latest telemetry from the simulator API.
"""

from __future__ import annotations

from typing import Any

import structlog

from nocagent.tools.handlers import get_http_client

logger = structlog.get_logger()


class Observer:
    """Fetches current network state from the simulator."""

    async def observe(self) -> dict[str, Any]:
        client = get_http_client()

        try:
            # Fetch overview, devices, links, and BGP in parallel-ish
            overview_resp = await client.get("/api/v1/telemetry/overview")
            devices_resp = await client.get("/api/v1/topology/devices")
            links_resp = await client.get("/api/v1/topology/links")
            bgp_resp = await client.get("/api/v1/topology/bgp-sessions")

            return {
                "overview": overview_resp.json(),
                "devices": devices_resp.json(),
                "links": links_resp.json(),
                "bgp_sessions": bgp_resp.json(),
            }
        except Exception:
            logger.exception("observer_fetch_error")
            return {}


observer = Observer()
