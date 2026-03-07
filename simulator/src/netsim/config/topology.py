"""
Network topology definition for the ISP simulator.

2 cities, 10 devices, 14 links — compact but realistic.
All generation logic uses this config. To expand, just add entries.
"""

TOPOLOGY = {
    "cities": ["delhi", "mumbai"],
    "devices": {
        # Core routers (inter-city backbone)
        "core-delhi-1": {
            "type": "core_router",
            "city": "delhi",
            "cpu_cores": 8,
            "memory_gb": 32,
        },
        "core-delhi-2": {
            "type": "core_router",
            "city": "delhi",
            "cpu_cores": 8,
            "memory_gb": 32,
        },
        "core-mumbai-1": {
            "type": "core_router",
            "city": "mumbai",
            "cpu_cores": 8,
            "memory_gb": 32,
        },
        "core-mumbai-2": {
            "type": "core_router",
            "city": "mumbai",
            "cpu_cores": 8,
            "memory_gb": 32,
        },
        # Edge routers
        "edge-delhi-north": {
            "type": "edge_router",
            "city": "delhi",
            "region": "north",
            "cpu_cores": 4,
            "memory_gb": 16,
        },
        "edge-delhi-south": {
            "type": "edge_router",
            "city": "delhi",
            "region": "south",
            "cpu_cores": 4,
            "memory_gb": 16,
        },
        "edge-mumbai-central": {
            "type": "edge_router",
            "city": "mumbai",
            "region": "central",
            "cpu_cores": 4,
            "memory_gb": 16,
        },
        "edge-mumbai-harbor": {
            "type": "edge_router",
            "city": "mumbai",
            "region": "harbor",
            "cpu_cores": 4,
            "memory_gb": 16,
        },
        # Peering routers
        "peer-delhi-1": {
            "type": "peering_router",
            "city": "delhi",
            "peer_as": 15169,
            "peer_name": "Google",
        },
        "peer-mumbai-1": {
            "type": "peering_router",
            "city": "mumbai",
            "peer_as": 13335,
            "peer_name": "Cloudflare",
        },
    },
    "links": [
        # Inter-city backbone (primary + backup)
        {
            "id": "link-del-mum-primary",
            "from": "core-delhi-1",
            "to": "core-mumbai-1",
            "capacity_gbps": 100,
            "base_latency_ms": 12,
            "type": "fiber_backbone",
        },
        {
            "id": "link-del-mum-backup",
            "from": "core-delhi-2",
            "to": "core-mumbai-2",
            "capacity_gbps": 100,
            "base_latency_ms": 14,
            "type": "fiber_backbone",
        },
        # Intra-city redundancy
        {
            "id": "link-del-intra",
            "from": "core-delhi-1",
            "to": "core-delhi-2",
            "capacity_gbps": 200,
            "base_latency_ms": 0.5,
            "type": "fiber_intra",
        },
        {
            "id": "link-mum-intra",
            "from": "core-mumbai-1",
            "to": "core-mumbai-2",
            "capacity_gbps": 200,
            "base_latency_ms": 0.5,
            "type": "fiber_intra",
        },
        # Core to Edge — Delhi
        {
            "id": "link-del-c1-en",
            "from": "core-delhi-1",
            "to": "edge-delhi-north",
            "capacity_gbps": 40,
            "base_latency_ms": 1.0,
            "type": "fiber_metro",
        },
        {
            "id": "link-del-c1-es",
            "from": "core-delhi-1",
            "to": "edge-delhi-south",
            "capacity_gbps": 40,
            "base_latency_ms": 1.5,
            "type": "fiber_metro",
        },
        {
            "id": "link-del-c2-en",
            "from": "core-delhi-2",
            "to": "edge-delhi-north",
            "capacity_gbps": 40,
            "base_latency_ms": 1.0,
            "type": "fiber_metro",
        },
        {
            "id": "link-del-c2-es",
            "from": "core-delhi-2",
            "to": "edge-delhi-south",
            "capacity_gbps": 40,
            "base_latency_ms": 1.5,
            "type": "fiber_metro",
        },
        # Core to Edge — Mumbai
        {
            "id": "link-mum-c1-ec",
            "from": "core-mumbai-1",
            "to": "edge-mumbai-central",
            "capacity_gbps": 40,
            "base_latency_ms": 1.0,
            "type": "fiber_metro",
        },
        {
            "id": "link-mum-c1-eh",
            "from": "core-mumbai-1",
            "to": "edge-mumbai-harbor",
            "capacity_gbps": 40,
            "base_latency_ms": 1.2,
            "type": "fiber_metro",
        },
        {
            "id": "link-mum-c2-ec",
            "from": "core-mumbai-2",
            "to": "edge-mumbai-central",
            "capacity_gbps": 40,
            "base_latency_ms": 1.0,
            "type": "fiber_metro",
        },
        {
            "id": "link-mum-c2-eh",
            "from": "core-mumbai-2",
            "to": "edge-mumbai-harbor",
            "capacity_gbps": 40,
            "base_latency_ms": 1.2,
            "type": "fiber_metro",
        },
        # Peering
        {
            "id": "link-del-peer",
            "from": "core-delhi-1",
            "to": "peer-delhi-1",
            "capacity_gbps": 40,
            "base_latency_ms": 0.5,
            "type": "peering",
        },
        {
            "id": "link-mum-peer",
            "from": "core-mumbai-1",
            "to": "peer-mumbai-1",
            "capacity_gbps": 40,
            "base_latency_ms": 0.5,
            "type": "peering",
        },
    ],
    "bgp_sessions": [
        {
            "device": "peer-delhi-1",
            "peer_as": 15169,
            "peer_name": "Google",
            "prefixes_received": 800000,
            "status": "established",
        },
        {
            "device": "peer-mumbai-1",
            "peer_as": 13335,
            "peer_name": "Cloudflare",
            "prefixes_received": 200000,
            "status": "established",
        },
    ],
    "customer_distribution": {
        "delhi": {"total": 1200000, "enterprise": 5000, "residential": 1195000},
        "mumbai": {"total": 1500000, "enterprise": 8000, "residential": 1492000},
    },
}
