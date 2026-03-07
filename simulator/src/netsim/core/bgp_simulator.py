"""
BGP session simulation — manages BGP peering state,
route announcements, and supports chaos-induced failures.
"""

from __future__ import annotations

import structlog

from netsim.core.network_state import network_state, BgpSessionState
from netsim.models.enums import BgpSessionStatus

logger = structlog.get_logger()


class BgpSimulator:
    """Manages BGP session lifecycle and route state."""

    async def get_sessions(
        self, device_id: str | None = None
    ) -> list[dict]:
        sessions = await network_state.get_all_bgp_sessions()
        result = []
        for key, session in sessions.items():
            if device_id and session.device_id != device_id:
                continue
            result.append(self._session_to_dict(session))
        return result

    async def withdraw_route(self, device_id: str, peer_as: int) -> bool:
        key = f"{device_id}-AS{peer_as}"
        sessions = await network_state.get_all_bgp_sessions()
        session = sessions.get(key)
        if not session:
            return False
        session.status = BgpSessionStatus.DOWN
        session.prefixes_received = 0
        logger.info(
            "bgp_route_withdrawn",
            device_id=device_id,
            peer_as=peer_as,
        )
        return True

    async def announce_route(self, device_id: str, peer_as: int) -> bool:
        key = f"{device_id}-AS{peer_as}"
        sessions = await network_state.get_all_bgp_sessions()
        session = sessions.get(key)
        if not session:
            return False
        session.status = BgpSessionStatus.ESTABLISHED
        # Restore original prefix count from topology
        from netsim.config.topology import TOPOLOGY

        for bgp_config in TOPOLOGY["bgp_sessions"]:
            if bgp_config["device"] == device_id and bgp_config["peer_as"] == peer_as:
                session.prefixes_received = bgp_config["prefixes_received"]
                break
        session.leaked_prefixes = 0
        logger.info(
            "bgp_route_announced",
            device_id=device_id,
            peer_as=peer_as,
        )
        return True

    def _session_to_dict(self, session: BgpSessionState) -> dict:
        return {
            "device_id": session.device_id,
            "peer_as": session.peer_as,
            "peer_name": session.peer_name,
            "status": session.status.value,
            "prefixes_received": session.prefixes_received
            + session.leaked_prefixes,
            "flap_count": session.flap_count,
        }


# Singleton
bgp_simulator = BgpSimulator()
