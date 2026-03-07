from enum import StrEnum


class DeviceStatus(StrEnum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    DOWN = "down"


class LinkStatus(StrEnum):
    UP = "up"
    DEGRADED = "degraded"
    DOWN = "down"


class BgpSessionStatus(StrEnum):
    ESTABLISHED = "established"
    IDLE = "idle"
    ACTIVE = "active"
    CONNECT = "connect"
    DOWN = "down"


class DeviceType(StrEnum):
    CORE_ROUTER = "core_router"
    EDGE_ROUTER = "edge_router"
    PEERING_ROUTER = "peering_router"


class LinkType(StrEnum):
    FIBER_BACKBONE = "fiber_backbone"
    FIBER_INTRA = "fiber_intra"
    FIBER_METRO = "fiber_metro"
    PEERING = "peering"


class EventSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class ChaosScenarioName(StrEnum):
    FIBER_CUT = "fiber_cut"
    GRADUAL_DEGRADATION = "gradual_degradation"
    DDOS_ATTACK = "ddos_attack"
    DEVICE_FAILURE = "device_failure"
    BGP_ROUTE_LEAK = "bgp_route_leak"
    CONGESTION_CASCADE = "congestion_cascade"
    MEMORY_LEAK = "memory_leak"
    FLAPPING_LINK = "flapping_link"
