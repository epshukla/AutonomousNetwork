# Architecture Document

## System Overview

The Autonomous Network Operations Center is a microservices system with **7 Docker containers** orchestrated via Docker Compose:

```
                    ┌─────────────────────────────────┐
                    │         USER / BROWSER           │
                    └────┬──────────┬──────────┬───────┘
                         │          │          │
                    :5173│     :5174│     :5175│
                         ▼          ▼          ▼
                  ┌──────────┐┌──────────┐┌──────────┐
                  │ Dashboard ││ Dashboard ││ Dashboard │
                  │ Network  ││  Agent   ││  Chaos   │
                  │ (nginx)  ││ (nginx)  ││ (nginx)  │
                  └────┬─────┘└──┬───┬───┘└──┬───────┘
                       │         │   │       │
              HTTP REST│    HTTP │   │  HTTP │
                       ▼         ▼   │       ▼
                ┌────────────┐   │   │  ┌────────────┐
                │ Simulator  │◄──┘   └──│   Agent    │
                │  :8000     │◄─────────│   :8001    │
                │            │  REST    │            │
                │ • Network  │  API     │ • OODA Loop │
                │ • Telemetry│          │ • Reasoner  │
                │ • Chaos    │          │ • Decisions  │
                │ • Actions  │          │ • Learning   │
                └─────┬──────┘          └─────┬──────┘
                      │                       │
              ┌───────┴───────────────────────┴───────┐
              │                                       │
         ┌────▼─────┐                          ┌──────▼────┐
         │PostgreSQL │                          │   Redis   │
         │TimescaleDB│                          │  Pub/Sub  │
         │  :5432    │                          │   :6379   │
         └──────────┘                          └───────────┘
```

## Container Architecture

| Container | Image | Port | Role |
|---|---|---|---|
| `postgres` | timescale/timescaledb:latest-pg16 | 5432 | Persistent storage: telemetry (hypertables), incidents, decisions |
| `redis` | redis:7-alpine | 6379 | Real-time event pub/sub, WebSocket fan-out |
| `simulator` | Custom Python 3.12 | 8000 | Simulates 10-device ISP network, generates telemetry, runs chaos |
| `agent` | Custom Python 3.12 | 8001 | Autonomous agent: observe, detect, diagnose, decide, learn |
| `dashboard-network` | nginx (static React) | 5173 | Network topology visualization, telemetry charts |
| `dashboard-agent` | nginx (static React) | 5174 | Incident management, approval panel, AI reasoning traces |
| `dashboard-chaos` | nginx (static React) | 5175 | Chaos scenario launcher, impact visualization |

## Data Flow

### Normal Operation (Zero API Cost)

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT LOOP (every 30s)                    │
│                                                             │
│  1. OBSERVE ──► HTTP GET /api/v1/topology/devices           │
│                         /api/v1/topology/links              │
│                         /api/v1/topology/bgp-sessions       │
│                         /api/v1/telemetry/overview           │
│                                                             │
│  2. DETECT  ──► Statistical threshold checks:               │
│                 • CPU > 80% (warning) / > 95% (critical)    │
│                 • Memory > 85% (warning) / > 95% (critical) │
│                 • Link util > 75% (warning) / > 90% (crit)  │
│                 • Packet loss > 0.5% (warning) / > 2% (crit)│
│                 • BGP flaps >= 3                             │
│                 • Device/link DOWN → emergency               │
│                                                             │
│  3. INCIDENT ─► IF critical/emergency anomalies found:      │
│                 • Dedup check (same title + last 5 min)      │
│                 • INSERT INTO incidents (...)                 │
│                                                             │
│  4. DIAGNOSE ─► Claude single-shot API call (see below)     │
│                                                             │
│  5. LEARN   ──► Adjust thresholds ±2-5% per outcome         │
│                 Persist to learning_records table             │
└─────────────────────────────────────────────────────────────┘
```

### Claude Diagnosis Flow (1 API Call)

```
                    ┌──────────────┐
                    │   Incident   │
                    │   Created    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Pre-fetch   │  HTTP to Simulator
                    │  ALL context │  (no Claude yet)
                    │              │
                    │ • Topology   │  GET /api/v1/topology
                    │ • Overview   │  GET /api/v1/telemetry/overview
                    │ • BGP state  │  GET /api/v1/topology/bgp-sessions
                    │ • Device     │  GET /api/v1/telemetry/devices/{id}
                    │   telemetry  │  (summarized: stats + 5 samples)
                    │ • Link       │  GET /api/v1/telemetry/links/{id}
                    │   telemetry  │  (summarized: stats + 5 samples)
                    │ • Past       │  SELECT FROM incidents
                    │   incidents  │  WHERE last 48h
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Build       │  Pack everything into
                    │  prompt      │  one structured message
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Claude API  │  ← ONE API CALL
                    │  messages.   │
                    │  create()    │
                    │              │
                    │ System: NOC  │
                    │  engineer    │
                    │  prompt      │
                    │              │
                    │ User: full   │
                    │  context +   │
                    │  incident    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Parse       │  Extract JSON actions
                    │  response    │  from ```json block
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Create      │  For each action:
                    │  decisions   │  • Determine tier (1-4)
                    │              │  • Tier 1-2: auto-execute
                    │              │  • Tier 3-4: → pending
                    │              │     (Approval Panel)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Save to DB  │  • claude_reasoning
                    │              │  • conversation_history
                    │              │    (for follow-up diagnoses)
                    └──────────────┘
```

### Action Execution Flow

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Decision    │     │   Executor    │     │  Simulator   │
│  (pending)   │     │               │     │  Actions API │
└──────┬───────┘     └───────────────┘     └──────────────┘
       │                     │                     │
       │  User clicks        │                     │
       │  "Approve"          │                     │
       ├────────────────────►│                     │
       │                     │  POST /actions/     │
       │                     │  reroute|rate-limit │
       │                     │  |restart|escalate  │
       │                     ├────────────────────►│
       │                     │                     │
       │                     │  Response           │
       │                     │◄────────────────────┤
       │                     │                     │
       │  UPDATE decisions   │  Network state      │
       │  SET status=        │  modified directly   │
       │  'executed'         │  (in-memory)         │
       │◄────────────────────┤                     │
```

## Backend 1: Network Simulator (`simulator/`)

### Module Structure

```
simulator/src/netsim/
├── app.py                    # FastAPI app factory, lifespan (start telemetry engine)
├── events.py                 # Redis pub/sub event bus (channels: events, chaos)
├── metrics.py                # Prometheus-style metrics tracking
├── config/
│   ├── settings.py           # Pydantic settings (env vars → config)
│   └── topology.py           # Network topology definition (devices, links, BGP)
├── core/
│   ├── network_state.py      # In-memory network state (devices + links + BGP)
│   ├── telemetry_engine.py   # 5s tick: update metrics, add jitter, write to DB
│   ├── traffic_model.py      # Realistic traffic patterns (time-of-day, bursts)
│   └── bgp_simulator.py      # BGP session state, flaps, route announcements
├── chaos/
│   ├── engine.py             # Chaos lifecycle: start/stop/track scenarios
│   ├── scenarios.py          # 8 scenario definitions (metadata, params, effects)
│   └── effects.py            # Effect handlers that modify network_state
├── api/
│   ├── topology.py           # GET /topology, /devices, /links, /bgp-sessions
│   ├── telemetry.py          # GET /telemetry/overview, /devices/{id}, /links/{id}
│   ├── actions.py            # POST /actions/reroute, /rate-limit, /restart, etc.
│   ├── chaos.py              # GET/POST /chaos/scenarios, /active, /history
│   └── websocket.py          # WS /ws/events — real-time network events
├── models/
│   ├── device.py             # SQLAlchemy: device_metrics hypertable
│   ├── link.py               # SQLAlchemy: link_metrics hypertable
│   ├── events.py             # SQLAlchemy: network_events table
│   ├── chaos.py              # SQLAlchemy: chaos_runs table
│   └── enums.py              # DeviceStatus, LinkStatus, BgpSessionStatus, etc.
└── db/
    └── engine.py             # Async engine, session factory, TimescaleDB init
```

### Network State Model

The simulator maintains **in-memory state** for all devices, links, and BGP sessions. The telemetry engine reads this state every 5 seconds, adds realistic jitter, and writes snapshots to TimescaleDB hypertables.

**Device State:**
- `device_id`, `device_type` (core/edge/peering router), `city`, `status`
- `cpu_utilization`, `memory_utilization`, `temperature_celsius`
- `cpu_modifier`, `memory_modifier`, `temp_modifier` (chaos overlays)
- `rate_limit_mbps` (applied by agent actions)

**Link State:**
- `link_id`, `from_device`, `to_device`, `capacity_gbps`, `base_latency_ms`
- `status` (up/down/degraded), `utilization_percent`, `throughput_gbps`
- `latency_ms`, `packet_loss_percent`, `errors_in`, `errors_out`
- `utilization_modifier`, `latency_modifier`, `loss_modifier` (chaos overlays)
- `forced_down` (set by chaos effects)

**Chaos Effect Pattern:**
- Effects modify `*_modifier` fields on device/link state
- Telemetry engine adds modifiers to base values when computing metrics
- On scenario stop, modifiers are reset to 0 (clean recovery)

### Telemetry Engine

Runs on a 5-second tick cycle:
1. For each device: compute effective CPU/memory/temp (base + modifier + jitter)
2. For each link: compute effective utilization/latency/loss (base + traffic model + modifier)
3. Write all metrics to TimescaleDB hypertables (`device_metrics`, `link_metrics`, `bgp_metrics`)
4. Publish events to Redis for real-time WebSocket consumers

### TimescaleDB Hypertables

```sql
-- Automatic time-series partitioning
SELECT create_hypertable('device_metrics', 'time', if_not_exists => TRUE);
SELECT create_hypertable('link_metrics', 'time', if_not_exists => TRUE);
SELECT create_hypertable('bgp_metrics', 'time', if_not_exists => TRUE);
```

Telemetry queries use `time_bucket()` for efficient aggregation:
```sql
SELECT time_bucket('5s', time) AS bucket,
       avg(cpu_utilization), avg(memory_utilization)
FROM device_metrics
WHERE device_id = :id AND time >= :start
GROUP BY bucket ORDER BY bucket
```

## Backend 2: NOC Agent (`agent/`)

### Module Structure

```
agent/src/nocagent/
├── app.py                    # FastAPI app factory, lifespan (start agent loop)
├── events.py                 # Redis pub/sub event bus
├── config/
│   └── settings.py           # Claude model, agent mode, intervals
├── core/
│   ├── agent_loop.py         # Main OODA loop (observe → detect → incident → diagnose → learn)
│   ├── observer.py           # Fetches telemetry from simulator via HTTP
│   ├── anomaly_detector.py   # Statistical threshold-based detection (11 rules)
│   ├── reasoner.py           # Single-shot Claude diagnosis (1 API call)
│   ├── decision_engine.py    # Autonomy tiers, decision creation, approval flow
│   ├── executor.py           # Executes approved actions against simulator
│   ├── learner.py            # Threshold adjustment + MTTD/MTTR tracking
│   └── memory.py             # Agent persistent memory (key-value store)
├── guardrails/
│   ├── safety.py             # Action safety validation
│   ├── blast_radius.py       # Customer impact estimation
│   └── rollback.py           # Action rollback plans
├── tools/
│   ├── definitions.py        # Claude tool definitions (11 tools)
│   └── handlers.py           # Action execution handlers (reroute, rate_limit, restart)
├── api/
│   ├── agent_control.py      # Start/stop/pause/resume/mode endpoints
│   ├── incidents.py          # Incident CRUD + diagnose endpoint
│   ├── decisions.py          # Decision approval/rejection endpoints
│   └── websocket.py          # WS /ws/agent-events — real-time agent events
├── models/
│   ├── incident.py           # Incident ORM model
│   ├── decision.py           # Decision + LearningRecord + AgentMemory models
│   └── enums.py              # Status enums
└── db/
    └── engine.py             # Async engine, session factory
```

### Agent Loop (OODA + Learn)

The agent implements an extended OODA (Observe-Orient-Decide-Act) loop with a Learning phase:

```
         ┌──────────┐
    ┌───►│ OBSERVE  │  Fetch telemetry from simulator
    │    └────┬─────┘  (HTTP GET to /topology/devices, /links, /bgp)
    │         │
    │    ┌────▼─────┐
    │    │  ORIENT  │  Statistical anomaly detection
    │    │ (DETECT) │  (threshold checks, no AI)
    │    └────┬─────┘
    │         │
    │    ┌────▼─────┐
    │    │  DECIDE  │  Auto-create incident if critical
    │    │          │  Auto-diagnose with Claude (1 API call)
    │    │          │  Create decisions with autonomy tiers
    │    └────┬─────┘
    │         │
    │    ┌────▼─────┐
    │    │   ACT    │  Tier 1-2: auto-execute
    │    │          │  Tier 3-4: queue for human approval
    │    └────┬─────┘
    │         │
    │    ┌────▼─────┐
    │    │  LEARN   │  Adjust detection thresholds
    │    │          │  ±2-5% based on action outcomes
    │    └────┬─────┘
    │         │
    │    sleep(30s)
    └─────────┘
```

### Anomaly Detection Rules

| Rule | Metric | Warning | Critical | Emergency |
|---|---|---|---|---|
| Device CPU | `cpu_utilization` | >= 80% | >= 95% | — |
| Device Memory | `memory_utilization` | >= 85% | >= 95% | — |
| Device Temp | `temperature_celsius` | >= 70°C | — | — |
| Device Down | `status` | — | — | `status == "down"` |
| Link Utilization | `utilization_percent` | >= 75% | >= 90% | — |
| Link Down | `status` | — | `status == "down"` | — |
| Packet Loss | `packet_loss_percent` | >= 0.5% | >= 2% | — |
| BGP Session Down | `bgp_status` | — | `!= "established"` | — |
| BGP Flapping | `flap_count` | >= 3 | — | — |

**Incident creation triggers:**
- Any critical or emergency anomaly → create incident
- 3+ warning anomalies simultaneously → create incident

### Decision Engine

```
Action Received from Claude
         │
         ▼
┌─────────────────┐
│ Determine Base  │  ACTION_TIER_MAP:
│ Tier from       │  • query/alert = Tier 1
│ action_type     │  • rate_limit  = Tier 2
│                 │  • reroute     = Tier 3
│                 │  • restart     = Tier 4
│                 │  • escalate    = Tier 4
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tier Upgrade    │  Upgrade if:
│ Check           │  • Tier 2 + blast > 100K → Tier 3
│                 │  • Tier 2 + confidence < 0.6 → Tier 3
│                 │  • Tier 3 + blast > 500K → Tier 4
│                 │  • Tier 3 + confidence < 0.5 → Tier 4
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Status          │  autonomous mode:
│ Assignment      │  • Tier 1: "executed" (immediate)
│                 │  • Tier 2: "executed" (auto + audit)
│                 │  • Tier 3: "pending" (needs approval)
│                 │  • Tier 4: "pending" (needs approval)
│                 │
│                 │  observe-only mode:
│                 │  • All tiers: "pending"
└─────────────────┘
```

### Learning System

The learner tracks outcomes and adjusts anomaly detection thresholds:

```
Successful action outcome:
  threshold *= 0.98  (lower threshold → catch anomalies sooner)

Failed action outcome:
  threshold *= 1.05  (raise threshold → reduce false positives)
```

It also tracks operational metrics:
- **MTTD** (Mean Time to Detect): time from chaos start to incident detection
- **MTTR** (Mean Time to Resolve): time from detection to resolution
- **Decision success rate**: % of executed decisions that succeeded

## Database Schema

Both backends share the same PostgreSQL instance but use separate tables:

### Simulator Tables

```sql
-- TimescaleDB hypertable: device metrics (5s granularity)
device_metrics (
    time            TIMESTAMPTZ NOT NULL,
    device_id       VARCHAR NOT NULL,
    cpu_utilization  FLOAT,
    memory_utilization FLOAT,
    temperature_celsius FLOAT,
    status          VARCHAR
)

-- TimescaleDB hypertable: link metrics (5s granularity)
link_metrics (
    time                TIMESTAMPTZ NOT NULL,
    link_id             VARCHAR NOT NULL,
    utilization_percent FLOAT,
    throughput_gbps     FLOAT,
    latency_ms          FLOAT,
    packet_loss_percent FLOAT,
    errors_in           INTEGER,
    errors_out          INTEGER,
    status              VARCHAR
)

-- TimescaleDB hypertable: BGP metrics
bgp_metrics (
    time              TIMESTAMPTZ NOT NULL,
    device_id         VARCHAR NOT NULL,
    peer_as           INTEGER,
    status            VARCHAR,
    prefixes_received INTEGER,
    flap_count        INTEGER
)

-- Network events log
network_events (
    id          SERIAL PRIMARY KEY,
    event_type  VARCHAR NOT NULL,
    source      VARCHAR NOT NULL,
    severity    VARCHAR NOT NULL,
    description TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
)

-- Chaos scenario run history
chaos_runs (
    id             SERIAL PRIMARY KEY,
    scenario_name  VARCHAR NOT NULL,
    params         JSONB,
    started_at     TIMESTAMPTZ DEFAULT NOW(),
    ended_at       TIMESTAMPTZ,
    status         VARCHAR DEFAULT 'running'
)
```

### Agent Tables

```sql
-- Incidents detected by the agent
incidents (
    id                      SERIAL PRIMARY KEY,
    title                   TEXT NOT NULL,
    severity                VARCHAR NOT NULL,
    status                  VARCHAR DEFAULT 'open',
    detected_at             TIMESTAMPTZ DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ,
    affected_devices        VARCHAR[],
    affected_links          VARCHAR[],
    root_cause_hypothesis   TEXT,
    final_root_cause        TEXT,
    estimated_customer_impact INTEGER,
    claude_reasoning        TEXT,          -- Claude's full diagnosis text
    metadata                JSONB          -- conversation_history for follow-ups
)

-- Decisions (AI recommendations + approval state)
decisions (
    id                    SERIAL PRIMARY KEY,
    incident_id           INTEGER REFERENCES incidents(id),
    action_type           VARCHAR NOT NULL,
    autonomy_tier         INTEGER NOT NULL,
    confidence            FLOAT NOT NULL,
    reasoning             TEXT NOT NULL,
    parameters            JSONB,
    status                VARCHAR DEFAULT 'pending',  -- pending/approved/rejected/executed
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    executed_at           TIMESTAMPTZ,
    outcome               TEXT,
    outcome_success       BOOLEAN,
    blast_radius_estimate INTEGER
)

-- Threshold adjustment history
learning_records (
    id                 SERIAL PRIMARY KEY,
    incident_id        INTEGER REFERENCES incidents(id),
    decision_id        INTEGER REFERENCES decisions(id),
    original_threshold JSONB,
    updated_threshold  JSONB,
    reason             TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
)

-- Agent persistent memory
agent_memory (
    id           SERIAL PRIMARY KEY,
    memory_type  VARCHAR NOT NULL,
    key          VARCHAR UNIQUE NOT NULL,
    value        JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
)
```

## Real-Time Communication

### Redis Pub/Sub Channels

| Channel | Publisher | Subscribers | Events |
|---|---|---|---|
| `network-events` | Simulator (telemetry, chaos effects) | Dashboard-Network (WebSocket) | link_down, device_degrading, ddos_detected, etc. |
| `chaos-events` | Chaos engine | Dashboard-Chaos (WebSocket) | scenario started/stopped/completed |
| `agent-events` | Agent (loop, reasoner, decisions) | Dashboard-Agent (WebSocket) | anomalies_detected, incident_created, decision_created, etc. |

### WebSocket Endpoints

- `ws://localhost:8000/ws/events` — Network events (simulator)
- `ws://localhost:8001/ws/agent-events` — Agent events (agent)

Both dashboards connect on mount and receive real-time JSON event payloads.

## Dashboard Architecture

All three dashboards share the same tech stack and design system:

### Tech Stack
- React 18 + TypeScript + Vite
- TailwindCSS with custom NOC dark theme
- Framer Motion for animations
- React Flow (topology map in dashboard-network)
- Recharts (telemetry charts)
- nginx for production serving (port 80 inside container)

### NOC Dark Theme

```css
--noc-bg:      #0a0e27    /* Deep navy background */
--noc-surface: #111633    /* Card/panel background */
--noc-border:  #1e2a5e    /* Subtle borders */
--noc-text:    #e0e6ff    /* Primary text */
--noc-muted:   #6b7aad    /* Secondary text */
--noc-cyan:    #00d4ff    /* Primary accent */
--noc-green:   #00ff88    /* Success/healthy */
--noc-red:     #ff4444    /* Error/critical */
--noc-amber:   #ffaa00    /* Warning */
--noc-purple:  #8b5cf6    /* Escalated/special */
```

### Dashboard 1: Network (`dashboard-network`, port 5173)

| Page | Features |
|---|---|
| **Overview** | Health score, total throughput, device/link status counts, metric cards |
| **Topology** | Interactive network graph (React Flow), device nodes colored by status, link edges with utilization |
| **Telemetry** | Real-time charts (Recharts) for CPU, memory, latency, utilization |
| **Events** | Live event feed from Redis pub/sub via WebSocket |

### Dashboard 2: Agent (`dashboard-agent`, port 5174)

| Page | Features |
|---|---|
| **Command Center** | Agent status, loop count, anomalies detected, incidents created |
| **Incidents** | Incident list + detail panel, "Diagnose with AI" button, severity/status badges |
| **Approval Panel** | Pending Tier 3-4 decisions, approve/reject buttons, confidence bars |
| **Agent Intelligence** | Current thresholds, MTTD/MTTR metrics, learning effectiveness |
| **Audit Log** | Full decision history with outcomes |

### Dashboard 3: Chaos (`dashboard-chaos`, port 5175)

| Page | Features |
|---|---|
| **Scenario Library** | 8 scenario cards with severity, description, expected effects |
| **Launch Pad** | Start/stop scenarios, parameter overrides, active scenario tracker |
| **Impact View** | Real-time metric impact during active chaos, agent response timeline |
| **History** | Past chaos runs with timestamps and outcomes |

## Kill Switch & Cost Model

### Kill Switch Architecture

The kill switch is independent of the chaos engine — it allows operators to manually kill devices or links and observe the network's response.

**Backend**: `simulator/src/netsim/api/killswitch.py`
- Module-level `_kill_state` dict (same pattern as chaos engine)
- 3 endpoints: POST /kill, POST /restore, GET /status
- Kill sets `device.status = DOWN` + `forced_down = True` on connected links
- Restore calls `restart_device()` but respects active chaos (won't restore chaos-affected links)
- `BACKUP_PATHS` hardcoded map of 10 redundant link pairs from topology

**Backup Path Rerouting**:
When a link is killed, if it has a backup path, the backup link's utilization increases by +25% and is marked as active. The topology visualization shows killed links with dashed red strokes and backup links with cyan glow.

**Routing Analysis** (`_analyze_routing()`):
- Counts 24 total links
- For each down link: checks `BACKUP_PATHS` for backup → "rerouted" if backup is up, "broken" if not
- `efficiency = healthy / total * 100`

### Indian ISP Cost Calculator

**Backend**: `simulator/src/netsim/api/cost_calculator.py`

Uses TRAI/industry figures to calculate real-time outage costs:

```
COST_MODEL = {
    subscriber_arpu_monthly:  ₹183      (TRAI residential data)
    enterprise_arpu_monthly:  ₹45,000   (enterprise segment)
    sla_penalty_per_hour:     ₹50,000   (SLA breach penalty, kicks in after 1 hour)
    noc_staff_per_hour:       ₹2,500    (NOC engineer cost)
    power_per_device_hour:    ₹150      (per affected device)
}
```

**Subscriber Impact Calculation**:
- OLT kills: directly count subscribers on that OLT
- Core/aggregation/edge kills: trace downstream to find cut-off OLTs
- Uses `customer_distribution` from topology for enterprise/residential split

**Frontend**: `dashboard-network/src/components/topology/CostTicker.tsx`
- `requestAnimationFrame` loop interpolates between 2-second poll updates
- `displayedCost = serverCost + cost_per_second * elapsed`
- Indian number format via `formatINR()`: ₹1,23,456.78 (groups of 2 after last 3)
- Compact format: ₹1.23 Cr / ₹4.56 L

---

## Security Considerations

- Claude API key is passed via environment variable, never hardcoded
- No authentication on internal APIs (designed for local/demo use)
- CORS configured for cross-origin dashboard → backend requests
- SQL injection prevented via parameterized queries (SQLAlchemy `text()` with `:param`)
- No sensitive data in telemetry (simulated metrics only)
- Redis and PostgreSQL not exposed externally in production (only via Docker network)

## Performance Characteristics

| Metric | Value |
|---|---|
| Telemetry write rate | 10 devices + 14 links = 24 rows/5s = ~288 rows/min |
| Agent loop interval | 30 seconds |
| Claude API calls | 1 per new incident (not per loop) |
| Context window usage | ~2,000-4,000 tokens per diagnosis (summarized telemetry) |
| WebSocket latency | < 100ms (Redis pub/sub → WebSocket fan-out) |
| Dashboard refresh | Polling every 5-10s + WebSocket push for critical events |
| Database size | ~5MB/hour of telemetry data (TimescaleDB compresses well) |
