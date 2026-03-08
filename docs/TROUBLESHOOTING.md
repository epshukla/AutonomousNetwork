# Troubleshooting Guide & Issue History

## Quick Diagnostics

```bash
# Check all containers are running
docker compose ps

# Check backend health
curl http://localhost:8000/health
curl http://localhost:8001/health

# Check agent logs for errors
docker compose logs --tail 50 agent

# Check simulator logs
docker compose logs --tail 50 simulator

# Full reset (wipes all data)
make clean && docker compose up -d --build
```

---

## Known Issues & Solutions

### Issue #1: Dashboard Blank Page on Any Click

**Symptom**: Agent dashboard (port 5174) goes completely blank when clicking any navigation link or button. Browser console shows:
```
TypeError: Cannot read properties of undefined (reading 'replace')
    at Array.map (<anonymous>)
```

**Root Cause** (two problems):

1. **Unguarded string methods on API data**: Several components called `.replace()`, `.toUpperCase()`, `.trim()`, `.split()` on values from API responses without null guards. When the backend returned `null` or `undefined` for a field, these calls threw `TypeError` which crashed the React component tree.

   **Affected files**:
   - `dashboard-agent/src/components/panels/LiveTicker.tsx:59` — `event.type.replace()` on WebSocket events where `type` was undefined
   - `dashboard-agent/src/components/agent/ReasoningTrace.tsx:63,70` — `segment.content.trim()` and `.split()` on parsed text segments
   - `dashboard-network/src/pages/AuditTrail.tsx:117` — `entry.category.toUpperCase()` on audit entries with missing category
   - `dashboard-network/src/components/topology/DeviceNode.tsx:198` — `data.type.replace()` on device nodes

2. **ErrorBoundary never reset on route change**: The `ErrorBoundary` class component caught the crash and showed an error screen, but had no mechanism to reset when the user navigated to a different page. Once any page crashed, ALL pages showed the error screen until the user did a full browser reload.

**Fix Applied**:
- Added `(value || '')` guards before all string method calls on API data
- Added `resetKey` prop to `ErrorBoundary` component that accepts `location.pathname`
- `componentDidUpdate` checks if `resetKey` changed and resets `hasError` state
- Wrapped `LiveTicker` in its own `ErrorBoundary` so a ticker crash doesn't blank the entire app
- "Try Again" button now resets error state without forcing `window.location.reload()`

**Files Modified**:
- `dashboard-agent/src/components/ErrorBoundary.tsx` — added `resetKey` prop + `componentDidUpdate` reset
- `dashboard-agent/src/App.tsx` — pass `resetKey={location.pathname}`, wrap LiveTicker in ErrorBoundary
- `dashboard-agent/src/components/panels/LiveTicker.tsx` — guard `event.type`
- `dashboard-agent/src/components/agent/ReasoningTrace.tsx` — guard `segment.content`
- `dashboard-network/src/components/ErrorBoundary.tsx` — same resetKey fix
- `dashboard-network/src/App.tsx` — pass `resetKey={location.pathname}`
- `dashboard-network/src/pages/AuditTrail.tsx` — guard `entry.category`
- `dashboard-network/src/components/topology/DeviceNode.tsx` — guard `data.type`

**Prevention**: All string method calls on data from API responses or WebSocket events must use null-coalescing: `(value || '').method()` or optional chaining `value?.method()`.

---

### Issue #2: AI Diagnose Returns "Error: Failed to fetch" / 500 Internal Server Error

**Symptom**: Clicking "AI Analyze — Diagnose & Recommend Actions" on the Approval Panel shows "Error: Failed to fetch" under AI Diagnosis. Browser console shows:
```
POST http://localhost:8001/api/v1/incidents/1/diagnose net::ERR_FAILED 500 (Internal Server Error)
```
Also accompanied by a CORS error:
```
Access to fetch at 'http://localhost:8001/api/v1/incidents/1/diagnose' from origin 'http://localhost:5174' has been blocked by CORS policy
```

**Root Cause**: Invalid or expired Anthropic API key (`CLAUDE_API_KEY`) in `.env`. The agent backend returns:
```
anthropic.AuthenticationError: Error code: 401 - {'type': 'error', 'error': {'type': 'authentication_error', 'message': 'invalid x-api-key'}}
```

The CORS error is a **side-effect** — when the backend returns a 500 error, the error response doesn't always include CORS headers, so the browser reports it as both a CORS error and a 500 error.

**Fix**:
1. Get a valid API key from https://console.anthropic.com/settings/keys
2. Update `CLAUDE_API_KEY=sk-ant-api03-...` in `.env`
3. Restart the agent: `docker compose up -d agent`

**Diagnosis**: Check agent logs for the actual error:
```bash
docker compose logs --tail 30 agent | grep -i "error\|401\|authentication"
```

---

### Issue #3: CORS Errors on Agent Dashboard API Calls

**Symptom**: Browser console shows CORS policy errors when the agent dashboard tries to call the agent backend API.

**Root Cause**: The original CORS config used `allow_origins=["*"]` with `allow_credentials=True`. Some browsers block wildcard origins when credentials mode is enabled (per the CORS spec).

**Fix Applied**: Changed `allow_credentials=True` to `allow_credentials=False` in `agent/src/nocagent/app.py` since the dashboards don't send credentials (cookies/auth headers).

**Note**: Most CORS errors in this project are actually a side-effect of backend 500 errors. Always check backend logs first.

---

### Issue #4: Topology Nodes Too Cramped / Edges Not Visible

**Symptom**: On the Network Dashboard topology page, device nodes are too close together (200px horizontal spacing with 180px wide cards), making link edges invisible.

**Fix Applied**: Spread out `DEVICE_POSITIONS` in `Topology.tsx`:
- Horizontal spacing: 200px → 320px
- Vertical spacing between tiers: 160px → 220px
- Zone widths: 420px → 640px
- Zone heights: 780px → 1050px

---

### Issue #5: Docker Build Changes Not Reflected in Browser

**Symptom**: Source code changes are not reflected in the running dashboard even after saving files. The browser still shows old behavior.

**Root Cause**: All 3 dashboards run as **nginx containers serving pre-built static bundles**. Source code edits are NOT hot-reloaded — you must rebuild the Docker image.

**Fix**:
```bash
# Rebuild specific dashboard
docker compose build dashboard-agent && docker compose up -d dashboard-agent

# Or rebuild all
docker compose build && docker compose up -d

# Then hard-refresh browser: Ctrl+Shift+R
```

**Alternative for development**: Run dashboards locally with Vite dev server for hot-reload:
```bash
cd dashboard-agent && npm install && npm run dev -- --port 5174
```

---

### Issue #6: Build-Time Errors (Historical)

These were fixed during initial development and should not recur:

| Error | Root Cause | Fix |
|---|---|---|
| `pip install -e .` fails in Docker | Editable installs require source before install | Changed to `pip install .` (non-editable) |
| `structlog.get_level_from_name()` not found | API doesn't exist in structlog | Replaced with `logging.DEBUG/INFO/etc` |
| `:param::jsonb` PostgreSQL cast fails | asyncpg conflicts with `::` cast syntax | Changed to `CAST(:param AS jsonb)` |
| `import.meta.env` TypeScript error | Missing Vite type declarations | Added `vite-env.d.ts` to each dashboard |
| `NodeJS.Timeout` type error | Not available in all TS configs | Changed to `ReturnType<typeof setInterval>` |

---

### Issue #7: Frontend-Backend Field Mismatches (Historical)

The backend returns raw field names that differ from what the frontend TypeScript interfaces expect. All resolved via normalization functions in `api/agent.ts`.

| Backend Field | Frontend Field | Where |
|---|---|---|
| `running` / `paused` | `state` | Agent status |
| `health_score` | `overall_score` | Telemetry overview |
| `decisions_total` | `total_decisions` | Learning effectiveness |
| `id` (integer) | `id` (string) | Incidents |
| `"open"` / `"action_pending"` | `"detected"` / `"mitigating"` | Incident status |
| `device_status.healthy` | `healthy_count` | Overview |

---

## Environment Checklist

If something isn't working, verify these in order:

1. **Docker containers running**: `docker compose ps` — all 7 should be running/healthy
2. **API key valid**: `docker compose logs agent | grep -i auth` — no 401 errors
3. **Databases healthy**: `docker compose logs postgres | tail -5` — no errors
4. **Redis connected**: `docker compose logs redis | tail -5` — ready to accept connections
5. **Backend APIs responding**: `curl localhost:8000/health && curl localhost:8001/health`
6. **WebSocket connected**: Browser console should show `[AgentEvents] WebSocket connected`
7. **Browser cache**: Hard-refresh with `Ctrl+Shift+R` after any Docker rebuild
