"""
Blast radius estimation — estimates how many customers are affected.
"""

from __future__ import annotations

CUSTOMER_DISTRIBUTION = {
    "delhi": {"total": 1200000, "enterprise": 5000, "residential": 1195000},
    "mumbai": {"total": 1500000, "enterprise": 8000, "residential": 1492000},
}

DEVICE_IMPACT_FRACTION = {
    "core_router": 0.5,
    "edge_router": 0.25,
    "peering_router": 0.15,
}


def estimate_blast_radius(
    device_id: str | None = None,
    device_type: str | None = None,
    city: str | None = None,
) -> int:
    if not city:
        city = "delhi" if device_id and "delhi" in device_id else "mumbai"

    total = CUSTOMER_DISTRIBUTION.get(city, {}).get("total", 0)

    if not device_type:
        if device_id:
            if "core" in device_id:
                device_type = "core_router"
            elif "edge" in device_id:
                device_type = "edge_router"
            elif "peer" in device_id:
                device_type = "peering_router"

    fraction = DEVICE_IMPACT_FRACTION.get(device_type or "", 0.1)
    return int(total * fraction)
