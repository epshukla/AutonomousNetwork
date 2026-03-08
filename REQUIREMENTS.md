# Requirements & Setup Guide

## System Requirements

| Requirement | Minimum Version | Notes |
|---|---|---|
| **Docker** | 24.0+ | Docker Engine with BuildKit support |
| **Docker Compose** | v2.20+ | Compose V2 (the `docker compose` plugin, not standalone `docker-compose`) |
| **RAM** | 4 GB free | 7 containers run simultaneously (Postgres, Redis, 2 backends, 3 dashboards) |
| **Disk** | 3 GB free | Docker images (~2 GB) + PostgreSQL data volume |
| **Ports** | 5173, 5174, 5175, 8000, 8001, 5432, 6379 | Must be free. See [Port Map](#port-map) |
| **Internet** | Required | To pull Docker images and call Claude API |

### Anthropic API Key (Required)

The AI agent uses **Claude** (claude-sonnet-4-20250514) for incident diagnosis. You need an active Anthropic API key with credits.

Get one at: https://console.anthropic.com/settings/keys

---

## Quick Start (Docker — Recommended)

No local Python or Node.js installation needed. Everything runs inside Docker containers.

```bash
# 1. Clone the project
git clone <repo-url> AutonomousNetwork
cd AutonomousNetwork

# 2. Configure environment
cp .env.example .env
# Edit .env and set your CLAUDE_API_KEY:
#   CLAUDE_API_KEY=sk-ant-api03-...

# 3. Build and start all 7 containers
docker compose up -d --build

# 4. Wait ~60 seconds for all services to become healthy, then open:
#    Network Dashboard:  http://localhost:5173
#    Agent Dashboard:    http://localhost:5174
#    Chaos Dashboard:    http://localhost:5175
```

### Verify Everything Is Running

```bash
docker compose ps
```

All 7 services should show `running (healthy)`:

```
autonomousnetwork-postgres-1           running (healthy)
autonomousnetwork-redis-1              running (healthy)
autonomousnetwork-simulator-1          running (healthy)
autonomousnetwork-agent-1              running (healthy)
autonomousnetwork-dashboard-network-1  running
autonomousnetwork-dashboard-agent-1    running
autonomousnetwork-dashboard-chaos-1    running
```

### Make Shortcuts

```bash
make up          # Start all services
make down        # Stop all services
make build       # Rebuild all containers
make logs        # Tail all logs (Ctrl+C to stop)
make restart     # Restart all services
make clean       # Full reset: stop + remove all data volumes
```

---

## Port Map

| Port | Service | Description |
|---|---|---|
| **5173** | dashboard-network | Network topology map, telemetry charts, live events |
| **5174** | dashboard-agent | Incidents, AI approval panel, audit log |
| **5175** | dashboard-chaos | Chaos scenario library, launch pad, impact view |
| **8000** | simulator | Network simulator REST API + WebSocket events |
| **8001** | agent | NOC agent REST API + WebSocket events |
| **5432** | postgres | PostgreSQL 16 + TimescaleDB |
| **6379** | redis | Redis 7 (pub/sub + cache) |

If any port is in use, stop the conflicting service or change the mapping in `docker-compose.yml` (e.g., `"5174:80"` → `"5274:80"`).

---

## Local Development (Optional)

For developing without Docker, you need these tools installed locally.

### Prerequisites for Local Dev

| Tool | Version | Install |
|---|---|---|
| **Python** | 3.12+ | https://www.python.org/downloads/ |
| **Node.js** | 20+ | https://nodejs.org/ |
| **npm** | 10+ | Included with Node.js |
| **PostgreSQL** | 16 + TimescaleDB | Docker recommended: `docker compose up -d postgres` |
| **Redis** | 7+ | Docker recommended: `docker compose up -d redis` |

### Backend Setup (Python)

```bash
# Start only the databases via Docker
docker compose up -d postgres redis

# Simulator (port 8000)
cd simulator
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
make dev-simulator               # or: uvicorn netsim.app:create_app --factory --reload --port 8000

# Agent (port 8001) — in a separate terminal
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
export CLAUDE_API_KEY=sk-ant-...
export SIMULATOR_URL=http://localhost:8000
make dev-agent                   # or: uvicorn nocagent.app:create_app --factory --reload --port 8001
```

### Dashboard Setup (Node.js)

Each dashboard is an independent Vite + React + TypeScript app:

```bash
# Dashboard 1: Network (port 5173)
cd dashboard-network
npm install
npm run dev

# Dashboard 2: Agent (port 5174)
cd dashboard-agent
npm install
npm run dev -- --port 5174

# Dashboard 3: Chaos (port 5175)
cd dashboard-chaos
npm install
npm run dev -- --port 5175
```

---

## Dependency Summary

### Python — Simulator (`simulator/pyproject.toml`)

| Package | Version | Purpose |
|---|---|---|
| fastapi | >=0.115.0 | REST API framework |
| uvicorn[standard] | >=0.32.0 | ASGI server |
| sqlalchemy[asyncio] | >=2.0.35 | Async ORM + database |
| asyncpg | >=0.30.0 | PostgreSQL async driver |
| alembic | >=1.14.0 | Database migrations |
| redis[hiredis] | >=5.2.0 | Pub/sub + caching |
| pydantic | >=2.10.0 | Data validation |
| pydantic-settings | >=2.6.0 | Settings from env vars |
| structlog | >=24.4.0 | Structured logging |
| prometheus-client | >=0.21.0 | Metrics |
| httpx | >=0.28.0 | HTTP client |
| numpy | >=2.1.0 | Statistical calculations |

### Python — Agent (`agent/pyproject.toml`)

Same as simulator, plus:

| Package | Version | Purpose |
|---|---|---|
| anthropic | >=0.40.0 | Claude API SDK |

(No numpy, no alembic — agent reads DB but doesn't own migrations.)

### Node.js — All 3 Dashboards (`package.json`)

| Package | Version | Purpose |
|---|---|---|
| react | ^18.2.0 | UI framework |
| react-dom | ^18.2.0 | React DOM renderer |
| react-router-dom | ^6.22.0 | Client-side routing |
| framer-motion | ^11.0.0 | Animations |
| lucide-react | ^0.344.0 | Icons |
| recharts | ^2.12.0 | Charts and graphs |
| reactflow | ^11.10.0 | Network topology map (dashboard-network only) |

Dev dependencies: TypeScript 5.3, Vite 5.1, TailwindCSS 3.4, PostCSS, autoprefixer.

### Infrastructure (Docker Images)

| Image | Purpose |
|---|---|
| `timescale/timescaledb:latest-pg16` | PostgreSQL 16 + TimescaleDB extension |
| `redis:7-alpine` | Redis 7 for pub/sub and caching |
| `python:3.12-slim` | Base for simulator and agent containers |
| `node:20-alpine` | Build stage for dashboard containers |
| `nginx:alpine` | Serves built dashboard static files |

---

## Environment Variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `CLAUDE_API_KEY` | **Yes** | — | Anthropic API key for Claude |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-20250514` | Claude model ID |
| `POSTGRES_USER` | No | `netops` | PostgreSQL username |
| `POSTGRES_PASSWORD` | No | `netops` | PostgreSQL password |
| `POSTGRES_DB` | No | `netops` | PostgreSQL database name |
| `DATABASE_URL` | No | `postgresql+asyncpg://netops:netops@postgres:5432/netops` | Full connection string |
| `REDIS_URL` | No | `redis://redis:6379/0` | Redis connection string |
| `AGENT_MODE` | No | `autonomous` | `autonomous` / `supervised` / `observe-only` |
| `OBSERVE_INTERVAL_SECONDS` | No | `5` | Agent detection loop interval (seconds) |
| `TELEMETRY_INTERVAL_SECONDS` | No | `5` | Simulator telemetry snapshot interval |
| `LOG_LEVEL` | No | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |

---

## Troubleshooting

### Containers won't start

```bash
# Check logs
docker compose logs agent      # or: simulator, postgres, redis
docker compose logs --tail 50

# Full reset (wipes all data)
make clean
docker compose up -d --build
```

### Port already in use

```bash
# Find what's using the port
sudo lsof -i :8001

# Change port mapping in docker-compose.yml
# e.g., "8001:8001" → "9001:8001"
```

### Agent not detecting incidents

- Check the agent is running: `curl http://localhost:8001/api/v1/agent/status`
- Make sure `CLAUDE_API_KEY` is set in `.env`
- Launch a chaos scenario from the Chaos Dashboard (`:5175`)
- Check agent logs: `docker compose logs -f agent`

### Dashboards show blank page

- Open browser console (F12) for JavaScript errors
- Verify backends are healthy: `curl http://localhost:8000/health` and `curl http://localhost:8001/health`
- Rebuild dashboards: `docker compose build dashboard-agent && docker compose up -d dashboard-agent`

### Database errors after code changes

```bash
# Reset database (destroys all data)
make clean
docker compose up -d
```
