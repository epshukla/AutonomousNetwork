"""
Realistic diurnal traffic model.

Uses sine wave (peak 8 PM, trough 4 AM IST) + Gaussian noise +
city-specific multipliers to generate believable traffic patterns.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta

import numpy as np

# IST offset
IST = timezone(timedelta(hours=5, minutes=30))

# City multipliers (Mumbai has more traffic due to larger customer base)
CITY_MULTIPLIERS = {
    "delhi": 0.85,
    "mumbai": 1.0,
}

# Device type base utilization ranges
DEVICE_BASE_UTILIZATION = {
    "core_router": (25.0, 60.0),           # Cores are moderately loaded
    "edge_router": (30.0, 70.0),           # Edges see more variable traffic
    "peering_router": (20.0, 55.0),        # Peering varies with external demand
    "aggregation_router": (28.0, 65.0),    # Between core and edge
    "olt": (15.0, 45.0),                   # Lower CPU than routers
}

# Link type base utilization ranges
LINK_BASE_UTILIZATION = {
    "fiber_backbone": (20.0, 55.0),
    "fiber_intra": (15.0, 45.0),
    "fiber_metro": (25.0, 65.0),
    "peering": (20.0, 50.0),
    "fiber_access": (30.0, 70.0),   # Access links run hotter
}


def diurnal_factor(now: datetime | None = None) -> float:
    """
    Returns a value 0.0–1.0 representing traffic intensity.
    Peak at 20:00 IST (0.95–1.0), trough at 04:00 IST (0.15–0.25).
    """
    if now is None:
        now = datetime.now(IST)
    else:
        now = now.astimezone(IST)

    hour = now.hour + now.minute / 60.0

    # Sine wave: peak at hour 20, trough at hour 8
    # sin peaks at pi/2, so we shift: (hour - 20) maps peak to 0
    # Then scale: 2*pi / 24 for full day cycle
    angle = 2 * math.pi * (hour - 14) / 24  # Peak at 20:00
    raw = (math.sin(angle) + 1) / 2  # Normalize to 0-1

    # Flatten the trough (minimum ~0.2) and boost peak (~0.95)
    return 0.2 + 0.75 * raw


def device_cpu_utilization(
    device_type: str,
    city: str,
    noise_std: float = 3.0,
    now: datetime | None = None,
) -> float:
    base_min, base_max = DEVICE_BASE_UTILIZATION.get(device_type, (20, 50))
    factor = diurnal_factor(now) * CITY_MULTIPLIERS.get(city, 1.0)
    base = base_min + (base_max - base_min) * factor
    noise = np.random.normal(0, noise_std)
    return float(np.clip(base + noise, 1.0, 100.0))


def device_memory_utilization(
    device_type: str,
    city: str,
    noise_std: float = 2.0,
    now: datetime | None = None,
) -> float:
    # Memory is more stable than CPU, follows traffic loosely
    factor = diurnal_factor(now) * CITY_MULTIPLIERS.get(city, 1.0)
    base = 30.0 + 25.0 * factor
    noise = np.random.normal(0, noise_std)
    return float(np.clip(base + noise, 10.0, 100.0))


def device_temperature(
    cpu_util: float, noise_std: float = 1.0
) -> float:
    # Temperature correlates with CPU load: 30°C idle, up to 75°C under load
    base = 30.0 + (cpu_util / 100.0) * 40.0
    noise = np.random.normal(0, noise_std)
    return float(np.clip(base + noise, 25.0, 95.0))


def link_utilization(
    link_type: str,
    from_city: str,
    to_city: str,
    noise_std: float = 4.0,
    now: datetime | None = None,
) -> float:
    base_min, base_max = LINK_BASE_UTILIZATION.get(link_type, (20, 50))
    # Use average of both cities for inter-city links
    cities = {from_city, to_city}
    multiplier = sum(CITY_MULTIPLIERS.get(c, 1.0) for c in cities) / len(cities)
    factor = diurnal_factor(now) * multiplier
    base = base_min + (base_max - base_min) * factor
    noise = np.random.normal(0, noise_std)
    return float(np.clip(base + noise, 0.5, 100.0))


def link_latency(
    base_latency_ms: float,
    utilization_percent: float,
    noise_std: float = 0.3,
) -> float:
    # Latency increases exponentially as utilization approaches 100%
    congestion_factor = 1.0
    if utilization_percent > 70:
        congestion_factor = 1.0 + ((utilization_percent - 70) / 30) ** 2 * 3.0
    elif utilization_percent > 50:
        congestion_factor = 1.0 + (utilization_percent - 50) / 50 * 0.3

    latency = base_latency_ms * congestion_factor
    noise = np.random.normal(0, noise_std)
    return float(max(latency + noise, base_latency_ms * 0.8))


def link_packet_loss(
    utilization_percent: float,
    noise_std: float = 0.05,
) -> float:
    # Packet loss: near-zero normally, spikes above 85% utilization
    if utilization_percent < 70:
        base = 0.01
    elif utilization_percent < 85:
        base = 0.01 + (utilization_percent - 70) / 15 * 0.1
    else:
        base = 0.1 + (utilization_percent - 85) / 15 * 2.0

    noise = abs(np.random.normal(0, noise_std))
    return float(np.clip(base + noise, 0.0, 100.0))


def link_throughput(
    capacity_gbps: float,
    utilization_percent: float,
) -> float:
    return round(capacity_gbps * utilization_percent / 100.0, 3)


def link_errors(utilization_percent: float) -> tuple[int, int]:
    # Errors correlate with high utilization
    if utilization_percent < 60:
        rate = 0.1
    elif utilization_percent < 80:
        rate = 1.0
    else:
        rate = 5.0 + (utilization_percent - 80) / 20 * 20
    errors_in = int(np.random.poisson(rate))
    errors_out = int(np.random.poisson(rate * 0.7))
    return errors_in, errors_out
