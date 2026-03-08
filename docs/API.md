# API Reference

## Simulator API (port 8000)

Base URL: `http://localhost:8000`

---

### Topology

#### `GET /api/v1/topology`

Returns the full network topology snapshot including all devices and links with their current state.

**Response:**
```json
{
  "devices": {
    "core-delhi-1": {
      "device_id": "core-delhi-1",
      "type": "core_router",
      "city": "delhi",
      "status": "healthy",
      "cpu_utilization": 45.2,
      "memory_utilization": 62.1,
      "temperature_celsius": 48.5
    }
  },
  "links": {
    "link-del-mum-primary": {
      "link_id": "link-del-mum-primary",
      "from": "core-delhi-1",
      "to": "core-mumbai-1",
      "type": "fiber_backbone",
      "capacity_gbps": 100,
      "status": "up",
      "utilization_percent": 38.5,
      "throughput_gbps": 38.5,
      "latency_ms": 12.3,
      "packet_loss_percent": 0.01
    }
  }
}
```

#### `GET /api/v1/topology/devices`

Returns all devices with current state.

#### `GET /api/v1/topology/devices/{device_id}`

Returns a single device's full state including rate limit info.

**Path Parameters:**
- `device_id` (string): Device identifier (e.g., `core-delhi-1`)

#### `GET /api/v1/topology/links`

Returns all links with current state.

#### `GET /api/v1/topology/links/{link_id}`

Returns a single link's full state including error counters.

**Path Parameters:**
- `link_id` (string): Link identifier (e.g., `link-del-mum-primary`)

#### `GET /api/v1/topology/bgp-sessions`

Returns all BGP session states.

**Response:**
```json
[
  {
    "device_id": "peer-delhi-1",
    "peer_as": 15169,
    "peer_name": "Google",
    "status": "established",
    "prefixes_received": 800000,
    "flap_count": 0,
    "leaked_prefixes": 0
  }
]
```

---

### Telemetry

#### `GET /api/v1/telemetry/overview`

Returns a network-wide health summary.

**Response:**
```json
{
  "health_score": 93,
  "total_throughput_gbps": 245.8,
  "avg_latency_ms": 8.5,
  "avg_utilization_percent": 42.3,
  "avg_cpu_percent": 38.7,
  "avg_memory_percent": 55.2,
  "avg_packet_loss_percent": 0.02,
  "device_count": 10,
  "link_count": 14,
  "device_status": { "healthy": 9, "degraded": 1 },
  "link_status": { "up": 13, "down": 1 }
}
```

#### `GET /api/v1/telemetry/devices/{device_id}`

Returns time-bucketed device metrics from TimescaleDB.

**Query Parameters:**
- `start` (datetime, optional): Start time (default: 30 min ago)
- `end` (datetime, optional): End time (default: now)
- `interval` (string, optional): Bucket size — `5s`, `1m`, `5m`, `1h` (default: `5s`)

**Response:**
```json
{
  "device_id": "core-delhi-1",
  "start": "2026-03-07T19:30:00Z",
  "end": "2026-03-07T20:00:00Z",
  "interval": "1m",
  "data": [
    {
      "time": "2026-03-07T19:30:00Z",
      "cpu_utilization": 45.2,
      "memory_utilization": 62.1,
      "temperature_celsius": 48.5,
      "status": "healthy"
    }
  ]
}
```

#### `GET /api/v1/telemetry/links/{link_id}`

Returns time-bucketed link metrics from TimescaleDB.

**Query Parameters:** Same as device telemetry.

**Response:**
```json
{
  "link_id": "link-del-mum-primary",
  "data": [
    {
      "time": "2026-03-07T19:30:00Z",
      "utilization_percent": 38.5,
      "throughput_gbps": 38.5,
      "latency_ms": 12.3,
      "packet_loss_percent": 0.01,
      "errors_in": 0,
      "errors_out": 0,
      "status": "up"
    }
  ]
}
```

---

### Actions

Actions modify the live network state in the simulator. They are typically invoked by the agent's executor after a decision is approved.

#### `POST /api/v1/actions/reroute`

Reroute traffic from one link to another.

**Request Body:**
```json
{
  "from_link": "link-del-mum-primary",
  "to_link": "link-del-mum-backup",
  "reason": "Primary link degraded, rerouting to backup"
}
```

**Effect:** Reduces utilization on `from_link` by 70%, increases `to_link` utilization by 80% of that amount.

#### `POST /api/v1/actions/rate-limit`

Apply a rate limit to a device or link.

**Request Body:**
```json
{
  "target": "edge-delhi-north",
  "limit_mbps": 5000,
  "duration_minutes": 30,
  "reason": "DDoS mitigation"
}
```

**Effect:** Sets rate limit on device (reduces CPU load by ~10%) or caps link utilization.

#### `POST /api/v1/actions/device/restart`

Restart a device and restore its connected links.

**Request Body:**
```json
{
  "device_id": "core-delhi-1",
  "reason": "Unresponsive after OOM",
  "graceful": true
}
```

**Effect:** Restores device to healthy state. Clears `forced_down` on all connected links and resets modifiers.

#### `POST /api/v1/actions/bgp/withdraw`

Withdraw BGP routes from a peer.

**Request Body:**
```json
{
  "device_id": "peer-delhi-1",
  "peer_as": 15169
}
```

#### `POST /api/v1/actions/bgp/announce`

Announce BGP routes to a peer.

#### `POST /api/v1/actions/config/rollback`

Reset all modifiers on a device and its connected links to baseline.

**Request Body:**
```json
{
  "device_id": "core-delhi-1",
  "reason": "Rolling back to stable config"
}
```

---

### Chaos Engineering

#### `GET /api/v1/chaos/scenarios`

List all available chaos scenarios with metadata.

**Response:**
```json
[
  {
    "name": "fiber_cut",
    "display_name": "Fiber Cut",
    "description": "Complete link failure simulating a physical fiber optic cable cut...",
    "severity": "critical",
    "default_params": {
      "link_id": "link-del-mum-primary",
      "duration_seconds": 300
    },
    "expected_effects": [
      "Link goes DOWN immediately",
      "Traffic reroutes to backup path"
    ],
    "affected_components": ["links", "bgp", "traffic"],
    "is_active": false
  }
]
```

#### `POST /api/v1/chaos/scenarios/{name}/start`

Start a chaos scenario. Optionally override default parameters.

**Path Parameters:**
- `name` (string): Scenario name (`fiber_cut`, `ddos_attack`, `device_failure`, etc.)

**Request Body (optional):**
```json
{
  "params": {
    "link_id": "link-del-mum-backup",
    "duration_seconds": 120
  }
}
```

**Response:**
```json
{
  "status": "started",
  "scenario": "fiber_cut",
  "params": { "link_id": "link-del-mum-backup", "duration_seconds": 120 },
  "run_id": 5
}
```

#### `POST /api/v1/chaos/scenarios/{name}/stop`

Stop a running chaos scenario. Effects are reversed (links restored, modifiers reset).

#### `GET /api/v1/chaos/active`

List currently active chaos scenarios.

#### `GET /api/v1/chaos/history`

Get history of past chaos runs.

**Query Parameters:**
- `limit` (int, optional): Max results (default: 50)

---

### Kill Switch

Manual device/link kill and restore, independent of the chaos engine.

#### `POST /api/v1/killswitch/kill`

Kill a device or link manually. Triggers backup path rerouting where available.

**Request Body:**
```json
{
  "target_type": "device",
  "target_id": "core-delhi-1"
}
```

**Response:**
```json
{
  "success": true,
  "target": { "target_type": "device", "target_id": "core-delhi-1" },
  "affected_links": ["link-del-mum-primary", "link-del-intra", "link-del-c1-en", "link-del-c1-es", "link-del-peer", "link-del-c1-agg"],
  "backup_paths": [
    {
      "original_link": "link-del-mum-primary",
      "backup_link": "link-del-mum-backup",
      "description": "Backup backbone via core-delhi-2 ↔ core-mumbai-2",
      "status": "active",
      "hop_increase": 1,
      "latency_increase_ms": 3.5
    }
  ],
  "routing_analysis": {
    "efficiency_percent": 75.0,
    "total_paths": 24,
    "healthy_paths": 18,
    "rerouted_paths": 3,
    "broken_paths": 3,
    "avg_latency_increase_ms": 4.2
  }
}
```

#### `POST /api/v1/killswitch/restore`

Restore a killed device or link. Respects active chaos — won't restore links still affected by chaos scenarios.

**Request Body:**
```json
{
  "target_type": "device",
  "target_id": "core-delhi-1"
}
```

**Response:**
```json
{
  "success": true,
  "target": { "target_type": "device", "target_id": "core-delhi-1" },
  "restored_links": ["link-del-mum-primary", "link-del-intra", "link-del-c1-en"]
}
```

#### `GET /api/v1/killswitch/status`

Returns current kill switch state including routing efficiency and outage cost.

**Response:**
```json
{
  "killed_devices": ["core-delhi-1"],
  "killed_links": ["link-del-mum-primary"],
  "kill_details": {
    "core-delhi-1": { "killed_at": "2026-03-08T15:00:00Z", "affected_links": ["link-del-mum-primary"] }
  },
  "routing_efficiency": {
    "efficiency_percent": 75.0,
    "total_paths": 24,
    "healthy_paths": 18,
    "rerouted_paths": 3,
    "broken_paths": 3,
    "avg_latency_increase_ms": 4.2
  },
  "cost_impact": {
    "total_cost": 125430.50,
    "revenue_loss": 98000.00,
    "sla_penalty": 0,
    "operational_cost": 27430.50,
    "affected_subscribers": 450000,
    "cost_per_second": 12.85,
    "duration_seconds": 300
  },
  "backup_paths": [
    {
      "original_link": "link-del-mum-primary",
      "backup_link": "link-del-mum-backup",
      "description": "Backup backbone",
      "status": "active",
      "hop_increase": 1,
      "latency_increase_ms": 3.5
    }
  ]
}
```

**Cost Model** (Indian ISP, TRAI figures):
- Subscriber ARPU: ₹183/month
- Enterprise ARPU: ₹45,000/month
- SLA penalty: ₹50,000/hour (kicks in after 1 hour)
- NOC staff: ₹2,500/hour per killed device
- Power: ₹150/hour per affected device

---

### Compliance

#### `GET /api/v1/compliance/status`

Returns DOT/TRAI compliance status.

**Response:**
```json
{
  "ntp_synced": true,
  "compliance_score": 95.5,
  "sla_status": { ... },
  "dot_compliance": { ... }
}
```

---

### WebSocket

#### `WS /ws/events`

Real-time network event stream. Events are published by the telemetry engine, chaos effects, and action handlers.

**Event Format:**
```json
{
  "event_type": "link_down",
  "source": "link-del-mum-primary",
  "severity": "critical",
  "description": "Fiber cut on link-del-mum-primary — link DOWN",
  "metadata": { "scenario": "fiber_cut" }
}
```

---

## Agent API (port 8001)

Base URL: `http://localhost:8001`

---

### Agent Control

#### `GET /api/v1/agent/status`

Returns agent operational status.

**Response:**
```json
{
  "running": true,
  "paused": false,
  "mode": "autonomous",
  "started_at": "2026-03-07T20:00:00Z",
  "uptime_seconds": 3600,
  "loop_count": 120,
  "anomalies_detected": 45,
  "incidents_created": 3,
  "observe_interval": 30
}
```

#### `POST /api/v1/agent/start`

Start the agent loop.

#### `POST /api/v1/agent/stop`

Stop the agent loop.

#### `POST /api/v1/agent/pause`

Pause anomaly detection (loop still runs but skips detection).

#### `POST /api/v1/agent/resume`

Resume anomaly detection.

#### `PUT /api/v1/agent/mode`

Change the agent's operating mode.

**Request Body:**
```json
{
  "mode": "autonomous"
}
```

**Valid modes:**
- `autonomous` — Tier 1-2 auto-execute, Tier 3-4 need approval
- `supervised` — All tiers need approval
- `observe-only` — Detect only, no actions

---

### Incidents

#### `GET /api/v1/incidents`

List all incidents.

**Query Parameters:**
- `status` (string, optional): Filter by status (`open`, `analyzing`, `resolved`)
- `limit` (int, optional): Max results (default: 50)

**Response:**
```json
[
  {
    "id": 1,
    "title": "CRITICAL: Link Down, Packet Loss — link-del-mum-primary",
    "severity": "critical",
    "status": "analyzing",
    "detected_at": "2026-03-07T20:02:03Z",
    "resolved_at": null,
    "affected_devices": ["core-delhi-1", "core-mumbai-1"],
    "affected_links": ["link-del-mum-primary"],
    "root_cause_hypothesis": "Link link-del-mum-primary is DOWN; Link link-del-c2-en packet loss at 3.05%"
  }
]
```

#### `GET /api/v1/incidents/{incident_id}`

Get full incident detail including Claude reasoning and decisions.

#### `POST /api/v1/incidents/{incident_id}/diagnose`

Trigger Claude AI diagnosis for an incident. This is the **only endpoint that calls the Claude API**.

**What happens:**
1. Loads incident from DB
2. Pre-fetches all network context (topology, telemetry, BGP, past incidents)
3. Makes ONE Claude API call with everything in a single prompt
4. Parses recommended actions from Claude's response
5. Creates decision records (Tier 1-2 auto-execute, Tier 3-4 pending)
6. Saves diagnosis text and conversation history

**Response:**
```json
{
  "incident_id": 1,
  "diagnosis": "## ROOT CAUSE ANALYSIS\n\nThe primary backbone link...",
  "actions_proposed": 3,
  "decision_ids": [1, 2, 3]
}
```

---

### Decisions

#### `GET /api/v1/decisions/pending`

Get all pending decisions awaiting human approval (Tier 3-4).

**Response:**
```json
[
  {
    "id": 3,
    "incident_id": 1,
    "incident_title": "CRITICAL: Link Down — link-del-mum-primary",
    "incident_severity": "critical",
    "action_type": "execute_reroute",
    "autonomy_tier": 3,
    "confidence": 0.85,
    "reasoning": "Primary backbone link down, reroute traffic via backup",
    "parameters": {
      "from_link": "link-del-mum-primary",
      "to_link": "link-del-mum-backup",
      "reason": "Emergency load balancing"
    },
    "status": "pending",
    "created_at": "2026-03-07T20:02:15Z",
    "blast_radius_estimate": 12000
  }
]
```

#### `GET /api/v1/decisions`

Get all decisions (pending, approved, rejected, executed).

**Query Parameters:**
- `limit` (int, optional): Max results (default: 100)

#### `POST /api/v1/decisions/{decision_id}/approve`

Approve a pending decision. The executor will execute the action against the simulator.

**Response:**
```json
{
  "decision_id": 3,
  "status": "approved"
}
```

#### `POST /api/v1/decisions/{decision_id}/reject`

Reject a pending decision.

---

### Learning

#### `GET /api/v1/learning/thresholds`

Get current anomaly detection thresholds (may differ from defaults if learning has adjusted them).

**Response:**
```json
{
  "link_utilization_warning": 75.0,
  "link_utilization_critical": 90.0,
  "latency_spike_factor": 2.0,
  "packet_loss_warning": 0.49,
  "packet_loss_critical": 2.0,
  "device_cpu_warning": 80.0,
  "device_cpu_critical": 95.0,
  "device_memory_warning": 85.0,
  "device_memory_critical": 95.0,
  "device_temp_warning": 70.0,
  "bgp_flap_threshold": 3
}
```

#### `GET /api/v1/learning/effectiveness`

Get agent effectiveness metrics.

**Response:**
```json
{
  "mttd_seconds": 12.5,
  "mttr_seconds": 180.0,
  "decisions_total": 15,
  "decisions_successful": 12,
  "decisions_failed": 3,
  "success_rate": 80.0,
  "learning_records_24h": 8,
  "current_thresholds": { ... }
}
```

---

### WebSocket

#### `WS /ws/agent-events`

Real-time agent event stream.

**Event types:**
- `agent_started` / `agent_paused` / `agent_resumed`
- `anomalies_detected` — count, critical count, types
- `incident_created` — incident_id, title, severity
- `reasoning_started` / `reasoning_completed` — incident_id, actions proposed
- `decision_created` — decision_id, action, tier, status
- `action_executing` / `action_completed` — decision_id, success
- `threshold_updated` — key, original, updated, direction

---

### Health Check

#### `GET /health`

Available on both simulator (`:8000`) and agent (`:8001`).

**Response:**
```json
{
  "status": "healthy",
  "service": "noc-agent",
  "timestamp": "2026-03-07T20:00:00Z"
}
```
