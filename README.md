# Neurotech NOC — Autonomous Network Operations Agent
## Full Stack Setup Guide

---

## Architecture

```
Frontend (React/Vite)          Backend (FastAPI/Python)
┌─────────────────────┐        ┌──────────────────────────────┐
│  App.jsx            │        │  main.py         (API server) │
│  ├─ Topology Map    │◄──WS──►│  telemetry.py    (simulator)  │
│  ├─ Agent Reasoning │        │  anomaly.py      (detection)  │
│  ├─ Action Queue    │◄─REST─►│  agent.py        (Claude AI)  │
│  ├─ Telemetry Log   │        │  models.py       (schemas)    │
│  └─ Scenario Panel  │        └──────────────────────────────┘
└─────────────────────┘                     │
                                            ▼
                                   Anthropic Claude API
                                   (claude-sonnet-4-...)
```

**Data Flow:**
1. `telemetry.py` generates realistic ISP network data every 2s
2. `anomaly.py` runs Z-score + threshold + rate-of-change detection
3. `agent.py` calls Claude with full telemetry context → structured JSON reasoning
4. `main.py` broadcasts incidents + actions via WebSocket to the frontend
5. Operator approves/rejects Tier 2 actions via REST API
6. All actions logged with rollback capability

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- An Anthropic API key — get one at https://console.anthropic.com

---

## Backend Setup

```bash
# 1. Navigate to the backend folder
cd neurotech-backend

# 2. Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Mac/Linux
# OR
venv\Scripts\activate           # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set your API key
cp .env.example .env
# Open .env and set: ANTHROPIC_API_KEY=your_key_here

# 5. Start the server
python main.py
# Server starts at http://localhost:8000
# WebSocket at  ws://localhost:8000/ws
```

**Verify backend is running:**
- Open http://localhost:8000 — should return `{"status": "ok"}`
- Open http://localhost:8000/docs — interactive API docs (Swagger UI)

---

## Frontend Setup

```bash
# 1. Create a new Vite React project
npm create vite@latest neurotech-frontend -- --template react
cd neurotech-frontend
npm install

# 2. Replace src/App.jsx with the App.jsx from this folder

# 3. Start the dev server
npm run dev
# Opens at http://localhost:5173
```

---

## REST API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/telemetry/current` | GET | Live snapshot of all 10 nodes |
| `/telemetry/history?limit=100` | GET | Rolling telemetry history |
| `/incidents` | GET | All detected incidents |
| `/incidents/{id}` | GET | Single incident detail |
| `/actions/history` | GET | All executed actions |
| `/actions/approve` | POST | Operator approves a Tier 2 action |
| `/actions/reject` | POST | Operator rejects a proposed action |
| `/actions/rollback/{id}` | POST | Roll back an executed action |
| `/simulate/scenario/{id}` | POST | Inject a failure scenario |
| `/agent/stats` | GET | Agent performance metrics |
| `/ws` | WebSocket | Real-time event stream |

**Scenario IDs for `/simulate/scenario/`:**
- `congestion-atl` — Atlanta congestion cascade
- `bgp-flap` — NYC BGP route instability
- `fiber-cut` — ATL core fiber degradation
- `ddos` — Multi-node DDoS absorption

---

## WebSocket Event Types

The WebSocket at `ws://localhost:8000/ws` streams these events:

```json
// Telemetry update (every 2s)
{"type": "telemetry", "tick": 42, "data": {...}, "anomalies": [...]}

// New incident detected
{"type": "incident", "incident": {"id": "INC-...", "riskScore": 88, ...}}

// Agent state change
{"type": "agent_state", "state": "reasoning|acting|observing"}

// Action executed (auto or approved)
{"type": "action_executed", "action": {...}}

// Action rejected by operator
{"type": "action_rejected", "action": {...}}

// Action rolled back
{"type": "action_rolled_back", "action": {...}}
```

---

## How Claude AI Reasoning Works

When `anomaly.py` detects an anomaly, `agent.py`:

1. Builds a rich context including:
   - Current metrics on all affected nodes
   - Last 5 telemetry samples (trend data)
   - Anomaly type and indicators
   - Full network state

2. Calls `claude-sonnet-4-20250514` with a network engineer system prompt

3. Claude returns structured JSON:
   ```json
   {
     "hypothesis": "...",
     "rootCause": "...",
     "riskScore": 88,
     "confidence": 91,
     "affectedCustomersEstimate": 12000,
     "timeToImpact": "8-12 minutes",
     "actions": [
       {"type": "auto",     "label": "...", "detail": "...", "rollback": "..."},
       {"type": "approve",  "label": "...", "detail": "...", "rollback": "..."},
       {"type": "escalate", "label": "...", "detail": "...", "rollback": "..."}
     ]
   }
   ```

4. Tier 1 (`auto`) actions execute immediately
5. Tier 2 (`approve`) actions appear in the frontend queue for operator review
6. Tier 3 (`escalate`) actions page the NOC team

---

## Safety Constraints

- **Blast radius scoring**: Claude is instructed never to recommend Tier 1 actions that could cause outages
- **Cooldown timers**: Anomaly detector suppresses duplicate alerts (6-tick cooldown per node)
- **Rollback on every action**: Every action logs a rollback snapshot before execution
- **Operator veto**: Tier 2 actions require explicit approval; rejection is permanent
- **95% success simulation**: 5% of actions "fail" and auto-revert to test rollback logic
- **Immutable audit log**: All actions appended to history, never deleted

---

## Production Hardening (Next Steps)

Replace simulated components with real integrations:

- **Telemetry**: Replace `telemetry.py` with SNMP polling, gNMI/gRPC streaming, or sFlow collection
- **Actions**: Replace `execute_action()` with NETCONF/RESTCONF calls to your routers
- **Memory**: Add PostgreSQL for persistent incident/action history
- **Auth**: Add JWT auth to the REST API and WebSocket
- **Alerting**: Add PagerDuty/Slack webhook calls for Tier 3 escalations
- **ML**: Train an LSTM or Transformer on your historical telemetry for better anomaly detection
