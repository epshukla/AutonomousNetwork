# Autonomous Network Operations Center (NOC) — AI Agent

> An agentic AI system that autonomously monitors, diagnoses, and remediates network incidents across a simulated ISP backbone — powered by Claude, chaos engineering, and a 4-tier human-in-the-loop autonomy framework.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  3 DASHBOARDS (React + TypeScript)                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Network     │  │    Agent     │  │    Chaos     │                  │
│  │  :5173        │  │   :5174      │  │   :5175      │                  │
│  │  Topology Map │  │  Incidents   │  │  Scenarios   │                  │
│  │  Telemetry    │  │  Approvals   │  │  Launch Pad  │                  │
│  │  Live Events  │  │  AI Traces   │  │  Impact View │                  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                 │                  │                           │
│  ───────┴─────────────────┴──────────────────┴──────────                │
│         │                 │                                             │
│  ┌──────▼───────┐  ┌──────▼───────┐                                    │
│  │  Simulator   │  │    Agent     │                                    │
│  │  :8000       │◄─┤   :8001      │                                    │
│  │  Network Sim │  │  NOC Agent   │                                    │
│  │  Chaos Eng.  │  │  Claude AI   │                                    │
│  └──────┬───────┘  └──────┬───────┘                                    │
│         │                 │                                             │
│  ───────┴─────────────────┴─────────                                    │
│         │                 │                                             │
│  ┌──────▼───────┐  ┌──────▼───────┐                                    │
│  │  TimescaleDB │  │    Redis     │                                    │
│  │  PostgreSQL  │  │   Pub/Sub    │                                    │
│  └──────────────┘  └──────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## What This Does

This system simulates a **realistic ISP backbone network** (Delhi ↔ Mumbai, 10 devices, 14 links, 2.7M customers) and runs an **autonomous AI agent** that:

1. **Observes** network telemetry every 30 seconds (CPU, memory, latency, packet loss, BGP state)
2. **Detects** anomalies using statistical thresholds (no AI needed)
3. **Auto-creates incidents** when critical anomalies are found
4. **Diagnoses** each incident with a single Claude API call — pre-fetching all network context into one prompt
5. **Recommends actions** classified by autonomy tier (auto-execute vs. human approval)
6. **Learns** from outcomes — adjusting detection thresholds over time

Meanwhile, **chaos engineering scenarios** (fiber cuts, DDoS, device failures, BGP leaks) can be launched to test the agent's response.

## Quick Start

### Prerequisites

- Docker & Docker Compose
- An Anthropic API key (for Claude)

### Setup

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env and set your CLAUDE_API_KEY

# 2. Launch everything (7 containers)
docker compose up -d

# 3. Open the dashboards
# Network Dashboard:  http://localhost:5173
# Agent Dashboard:    http://localhost:5174
# Chaos Dashboard:    http://localhost:5175
```

### Try It

1. Open the **Chaos Dashboard** (`:5175`) → **Launch Pad**
2. Launch a **Fiber Cut** scenario
3. Switch to the **Agent Dashboard** (`:5174`) → **Incidents**
4. Watch the agent auto-detect the anomaly, create an incident, and diagnose it with Claude
5. Go to **Approval Panel** — approve or reject the AI's recommended actions
6. Observe the network recover on the **Network Dashboard** (`:5173`)

### Make Commands

```bash
make up          # Start all services
make down        # Stop all services
make build       # Rebuild all containers
make logs        # Tail all logs
make restart     # Restart all services
make clean       # Stop + remove volumes (full reset)
make simulator   # Start only simulator + deps
make agent       # Start simulator + agent + deps
make dashboards  # Start only the 3 dashboards
```

### Local Development

```bash
make dev-simulator          # uvicorn with --reload on :8000
make dev-agent              # uvicorn with --reload on :8001
make dev-dashboard-network  # vite dev on :5173
make dev-dashboard-agent    # vite dev on :5174
make dev-dashboard-chaos    # vite dev on :5175
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture document.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **Claude called on-demand, not in a loop** | 1 API call per incident. The observe/detect loop runs for free using statistical thresholds. |
| **Single-shot prompt (no tool_use)** | All context pre-fetched via HTTP, packed into one prompt. No multi-turn conversations. Predictable cost. |
| **4-tier autonomy framework** | Tier 1-2 auto-execute (logging, rate limiting). Tier 3-4 require human approval (rerouting, restarts). |
| **Shared PostgreSQL, separate tables** | Simulator writes telemetry (TimescaleDB hypertables). Agent writes incidents/decisions. No schema conflicts. |
| **In-memory network state** | Simulator keeps live state in Python objects. Telemetry engine snapshots to DB every 5s. Chaos effects modify state directly. |
| **Adaptive thresholds** | Learner adjusts anomaly detection thresholds based on action outcomes. Successful actions → lower thresholds (catch sooner). Failed → raise thresholds (reduce noise). |

## Project Structure

```
AutonomousNetwork/
├── simulator/                  # Backend 1: Network Simulator (port 8000)
│   └── src/netsim/
│       ├── api/                # REST endpoints (topology, telemetry, actions, chaos)
│       ├── chaos/              # Chaos engine + 8 scenario effects
│       ├── config/             # Settings + network topology definition
│       ├── core/               # Network state, telemetry engine, BGP simulator
│       ├── db/                 # SQLAlchemy async engine + TimescaleDB init
│       ├── models/             # ORM models (device_metrics, link_metrics, events)
│       └── events.py           # Redis pub/sub event bus
│
├── agent/                      # Backend 2: NOC Agent (port 8001)
│   └── src/nocagent/
│       ├── api/                # REST endpoints (incidents, decisions, agent control)
│       ├── config/             # Settings (Claude model, intervals, mode)
│       ├── core/               # Agent loop, observer, anomaly detector, reasoner,
│       │                       # decision engine, executor, learner
│       ├── db/                 # SQLAlchemy async engine
│       ├── guardrails/         # Blast radius estimation, safety checks, rollback
│       ├── models/             # ORM models (incidents, decisions, learning_records)
│       ├── tools/              # Action handlers + Claude tool definitions
│       └── events.py           # Redis pub/sub event bus
│
├── dashboard-network/          # Dashboard 1: Network Visualization (port 5173)
│   └── src/
│       ├── components/         # TopologyMap (React Flow), Charts (Recharts)
│       ├── pages/              # Overview, Topology, Telemetry, Events
│       └── api/                # Simulator API client
│
├── dashboard-agent/            # Dashboard 2: Agent Intelligence (port 5174)
│   └── src/
│       ├── components/         # IncidentList, IncidentDetail, ReasoningTrace
│       ├── pages/              # Incidents, ApprovalPanel, AuditLog, CommandCenter
│       └── api/                # Agent API client
│
├── dashboard-chaos/            # Dashboard 3: Chaos Engineering (port 5175)
│   └── src/
│       ├── components/         # ScenarioCard, MetricImpact, AgentResponse
│       ├── pages/              # ScenarioLibrary, LaunchPad, ImpactView, History
│       └── api/                # Chaos API client
│
├── docker-compose.yml          # 7 services: postgres, redis, simulator, agent, 3 dashboards
├── Makefile                    # Build/run shortcuts
└── .env.example                # Environment variable template
```

## API Reference

See [docs/API.md](docs/API.md) for the complete API reference.

### Simulator API (`:8000`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/topology` | Full network topology snapshot |
| `GET` | `/api/v1/topology/devices` | All device states |
| `GET` | `/api/v1/topology/devices/{id}` | Single device detail |
| `GET` | `/api/v1/topology/links` | All link states |
| `GET` | `/api/v1/topology/links/{id}` | Single link detail |
| `GET` | `/api/v1/topology/bgp-sessions` | BGP session states |
| `GET` | `/api/v1/telemetry/overview` | Network health overview |
| `GET` | `/api/v1/telemetry/devices/{id}` | Device metrics timeseries |
| `GET` | `/api/v1/telemetry/links/{id}` | Link metrics timeseries |
| `POST` | `/api/v1/actions/reroute` | Reroute traffic between links |
| `POST` | `/api/v1/actions/rate-limit` | Apply rate limit to device/link |
| `POST` | `/api/v1/actions/device/restart` | Restart a device |
| `POST` | `/api/v1/actions/bgp/withdraw` | Withdraw BGP route |
| `POST` | `/api/v1/actions/bgp/announce` | Announce BGP route |
| `POST` | `/api/v1/actions/config/rollback` | Rollback device config |
| `GET` | `/api/v1/chaos/scenarios` | List all chaos scenarios |
| `POST` | `/api/v1/chaos/scenarios/{name}/start` | Start a chaos scenario |
| `POST` | `/api/v1/chaos/scenarios/{name}/stop` | Stop a chaos scenario |
| `GET` | `/api/v1/chaos/active` | List active scenarios |
| `GET` | `/api/v1/chaos/history` | Chaos run history |
| `WS` | `/ws/events` | Real-time network events |

### Agent API (`:8001`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/agent/status` | Agent loop status + stats |
| `POST` | `/api/v1/agent/start` | Start the agent loop |
| `POST` | `/api/v1/agent/stop` | Stop the agent loop |
| `POST` | `/api/v1/agent/pause` | Pause detection |
| `POST` | `/api/v1/agent/resume` | Resume detection |
| `PUT` | `/api/v1/agent/mode` | Change mode (autonomous/supervised/observe-only) |
| `GET` | `/api/v1/incidents` | List all incidents |
| `GET` | `/api/v1/incidents/{id}` | Get incident detail |
| `POST` | `/api/v1/incidents/{id}/diagnose` | Trigger Claude AI diagnosis (1 API call) |
| `GET` | `/api/v1/decisions/pending` | Pending decisions for approval |
| `GET` | `/api/v1/decisions` | All decisions with history |
| `POST` | `/api/v1/decisions/{id}/approve` | Approve a decision |
| `POST` | `/api/v1/decisions/{id}/reject` | Reject a decision |
| `GET` | `/api/v1/learning/thresholds` | Current anomaly thresholds |
| `GET` | `/api/v1/learning/effectiveness` | MTTD, MTTR, success rate |
| `WS` | `/ws/agent-events` | Real-time agent events |

## Chaos Scenarios

| Scenario | Severity | What it Does |
|---|---|---|
| **Fiber Cut** | Critical | Instantly kills a link. Traffic reroutes to backup. BGP reconverges. |
| **Gradual Degradation** | Warning | Slowly increases latency + packet loss over minutes. |
| **DDoS Attack** | Critical | Floods an edge router. CPU spikes, connected links saturate. |
| **Device Failure** | Emergency | CPU/memory ramp to 100%, then device crashes. All connected links go down. |
| **BGP Route Leak** | Critical | Peer announces bad routes. Traffic blackholed or misrouted. |
| **Congestion Cascade** | Emergency | One link fails → neighbors overload → their neighbors overload. |
| **Memory Leak** | Warning | Slow memory fill. Eventually OOM crash. |
| **Flapping Link** | Warning | Link toggles UP/DOWN rapidly. BGP flap counters spike. |

## How the AI Agent Works

### The Loop (Zero API Cost)

```
Every 30 seconds:
  1. OBSERVE  → Fetch telemetry from simulator via HTTP
  2. DETECT   → Check thresholds (CPU, memory, latency, packet loss, BGP)
  3. INCIDENT → Auto-create if critical anomalies found (deduplication check)
  4. DIAGNOSE → Call Claude ONCE with full network context (1 API call)
  5. LEARN    → Adjust thresholds based on outcomes
```

### Single-Shot Claude Pattern

The agent does NOT use Claude in a loop or with tool_use. Instead:

1. **Pre-fetch** all context via HTTP (topology, telemetry, BGP, past incidents)
2. **Summarize** large timeseries data into stats (min/max/avg/latest + 5 recent samples)
3. **Pack** everything into a single user message with structured sections
4. **One API call** → Claude returns root cause analysis + recommended actions as JSON
5. **Parse** the JSON actions and create decision records in the database

This keeps costs predictable: **1 Claude API call per incident**.

### Autonomy Tiers

| Tier | Label | Actions | Approval |
|---|---|---|---|
| 1 | Auto-execute | Alerts, logging, metric queries | None needed |
| 2 | Auto + audit | Rate limiting, QoS changes | Auto-approved, audit trail |
| 3 | Recommend | Traffic rerouting | Human approval required |
| 4 | Escalate | Device restarts, BGP changes | Always needs human approval |

Tier upgrades happen automatically when:
- Blast radius > 100K customers (Tier 2 → 3)
- Confidence < 60% (Tier 2 → 3)
- Blast radius > 500K customers (Tier 3 → 4)
- Confidence < 50% (Tier 3 → 4)

## Network Topology

```
Delhi                                              Mumbai
┌─────────────────────────────┐    ┌─────────────────────────────┐
│                             │    │                             │
│  edge-delhi-north           │    │         edge-mumbai-central │
│        │           ╲        │    │        ╱           │        │
│        │            ╲       │    │       ╱            │        │
│  core-delhi-1 ─── core-delhi-2  │    │  core-mumbai-1 ─── core-mumbai-2 │
│        │            ╱       │    │       ╲            │        │
│        │           ╱        │    │        ╲           │        │
│  edge-delhi-south           │    │         edge-mumbai-harbor  │
│        │                    │    │                    │        │
│  peer-delhi-1 (Google)      │    │   peer-mumbai-1 (Cloudflare)│
│                             │    │                             │
└─────────────┬───────────────┘    └───────────────┬─────────────┘
              │                                    │
              │    100 Gbps Primary Backbone        │
              ├────────────────────────────────────┤
              │    100 Gbps Backup Backbone         │
              └────────────────────────────────────┘

10 devices  •  14 links  •  2 BGP peering sessions
Delhi: 1.2M customers  •  Mumbai: 1.5M customers
```

## Tech Stack

| Layer | Technology |
|---|---|
| **AI** | Claude claude-sonnet-4-20250514 via Anthropic Python SDK |
| **Backends** | Python 3.12, FastAPI, uvicorn, SQLAlchemy 2.0 (async), httpx |
| **Database** | PostgreSQL 16 + TimescaleDB (hypertables for time-series) |
| **Cache/PubSub** | Redis 7 (pub/sub for real-time events, LRU cache) |
| **Dashboards** | React 18, TypeScript, Vite, TailwindCSS, Framer Motion |
| **Visualization** | React Flow (topology), Recharts (charts) |
| **Infrastructure** | Docker Compose (7 containers), nginx (dashboard serving) |
| **Logging** | structlog (structured JSON logging) |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CLAUDE_API_KEY` | — | **Required.** Anthropic API key |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Claude model to use |
| `DATABASE_URL` | `postgresql+asyncpg://netops:netops@postgres:5432/netops` | PostgreSQL connection |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection |
| `AGENT_MODE` | `autonomous` | `autonomous` / `supervised` / `observe-only` |
| `OBSERVE_INTERVAL_SECONDS` | `30` | Agent loop interval |
| `TELEMETRY_INTERVAL_SECONDS` | `5` | Simulator telemetry tick |
| `LOG_LEVEL` | `INFO` | Log verbosity |

## License

MIT
