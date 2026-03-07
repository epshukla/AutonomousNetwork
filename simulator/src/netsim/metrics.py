from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi import APIRouter, Response

router = APIRouter()

# Counters
telemetry_ticks_total = Counter(
    "netsim_telemetry_ticks_total",
    "Total telemetry generation ticks",
)
chaos_scenarios_started = Counter(
    "netsim_chaos_scenarios_started_total",
    "Total chaos scenarios started",
    ["scenario"],
)
network_events_total = Counter(
    "netsim_network_events_total",
    "Total network events emitted",
    ["event_type", "severity"],
)

# Gauges
active_websocket_connections = Gauge(
    "netsim_active_ws_connections",
    "Active WebSocket connections",
    ["channel"],
)
active_chaos_scenarios = Gauge(
    "netsim_active_chaos_scenarios",
    "Currently active chaos scenarios",
)
network_health_score = Gauge(
    "netsim_network_health_score",
    "Overall network health score (0-100)",
)

# Histograms
telemetry_tick_duration = Histogram(
    "netsim_telemetry_tick_duration_seconds",
    "Time to generate one telemetry tick",
)


@router.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
