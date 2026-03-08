const SIMULATOR_URL = import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:8000';
const AGENT_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:8001';

// ---- Types ----

export interface ScenarioDefaults {
  [key: string]: string | number | boolean;
}

export interface ScenarioMeta {
  // Fields from backend
  name: string;
  display_name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'emergency';
  default_params: ScenarioDefaults;
  expected_effects: string[];
  affected_components: string[];
  is_active: boolean;
  // Local UI-only enrichment fields
  icon: string;
  category: string;
}

export interface StartScenarioResponse {
  status: string;
  scenario: string;
  params: ScenarioDefaults;
  run_id: number;
}

export interface ActiveScenario {
  id: number;
  scenario_name: string;
  params: ScenarioDefaults;
  started_at: string;
  ended_at: string | null;
  status: 'running' | 'completed' | 'stopped' | 'failed';
}

export interface HistoryEntry {
  id: number;
  scenario_name: string;
  params: ScenarioDefaults;
  started_at: string;
  ended_at: string | null;
  status: 'running' | 'completed' | 'stopped' | 'failed';
}

export interface AgentAction {
  timestamp: string;
  action: string;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface AgentIncident {
  id: string;
  type: string;
  severity: string;
  detected_at: string;
  resolved_at: string | null;
  description: string;
  root_cause: string | null;
  actions_taken: AgentAction[];
  status: 'detected' | 'investigating' | 'mitigating' | 'resolved';
}

export interface AgentStatus {
  status: 'idle' | 'monitoring' | 'responding' | 'remediating';
  active_incidents: number;
  health_score: number;
  last_action: string | null;
  uptime_seconds: number;
}

export interface NetworkMetrics {
  timestamp?: string;
  health_score: number;
  total_throughput_gbps: number;
  avg_latency_ms: number;
  avg_utilization_percent: number;
  device_count: number;
  link_count: number;
  device_status: Record<string, number>;
  link_status: Record<string, number>;
}

// ---- Scenario definitions ----

export const SCENARIOS: ScenarioMeta[] = [
  {
    name: 'fiber_cut',
    display_name: 'Fiber Cut',
    description: 'Simulates a complete fiber optic cable cut on a primary link, causing immediate traffic rerouting and potential service degradation.',
    severity: 'critical',
    icon: 'Scissors',
    expected_effects: ['Complete link failure', 'Traffic rerouting via backup paths', 'Increased latency on alternate routes', 'Possible packet loss during convergence'],
    affected_components: ['Primary link', 'Connected routers', 'Dependent services'],
    default_params: { link_id: 'link-del-mum-primary' },
    is_active: false,
    category: 'link',
  },
  {
    name: 'gradual_degradation',
    display_name: 'Gradual Degradation',
    description: 'Slowly degrades a link with increasing latency and packet loss, simulating cable damage or environmental interference.',
    severity: 'medium',
    icon: 'TrendingDown',
    expected_effects: ['Steadily rising latency', 'Increasing packet loss', 'Quality of service degradation', 'Threshold alarms triggering sequentially'],
    affected_components: ['Target link', 'End-to-end path quality', 'SLA metrics'],
    default_params: { link_id: 'link-del-mum-primary', latency_increase_ms: 50, loss_increase_percent: 3.0, ramp_seconds: 180 },
    is_active: false,
    category: 'link',
  },
  {
    name: 'ddos_attack',
    display_name: 'DDoS Attack',
    description: 'Floods a target device with massive traffic volumes, overwhelming interfaces and causing service disruption.',
    severity: 'emergency',
    icon: 'Zap',
    expected_effects: ['Interface saturation', 'CPU/memory spike on target', 'Collateral congestion on upstream links', 'Service unavailability'],
    affected_components: ['Target device', 'Upstream links', 'Connected customers'],
    default_params: { target_device: 'edge-delhi-north', traffic_multiplier: 5.0 },
    is_active: false,
    category: 'security',
  },
  {
    name: 'device_failure',
    display_name: 'Device Failure',
    description: 'Simulates a complete device failure with graceful shutdown, causing all connected links to go down.',
    severity: 'critical',
    icon: 'ServerCrash',
    expected_effects: ['All device ports go down', 'Connected links fail', 'Routing reconvergence', 'Traffic black-holing during failover'],
    affected_components: ['Target device', 'All connected links', 'Routing domain'],
    default_params: { device_id: 'core-delhi-1', ramp_seconds: 30 },
    is_active: false,
    category: 'device',
  },
  {
    name: 'bgp_route_leak',
    display_name: 'BGP Route Leak',
    description: 'Injects unauthorized prefix advertisements into the BGP routing table, simulating a route leak from a peering partner.',
    severity: 'emergency',
    icon: 'Route',
    expected_effects: ['Route table pollution', 'Traffic misdirection', 'Potential loops', 'Widespread reachability issues'],
    affected_components: ['BGP peering router', 'Global routing table', 'Internet-facing services'],
    default_params: { device_id: 'peer-delhi-1', leaked_prefixes: 50000 },
    is_active: false,
    category: 'routing',
  },
  {
    name: 'congestion_cascade',
    display_name: 'Congestion Cascade',
    description: 'Triggers a cascading congestion event starting from one link and spreading to adjacent links as traffic redistributes.',
    severity: 'high',
    icon: 'Network',
    expected_effects: ['Initial link congestion', 'Cascading overload on neighbors', 'Progressive quality degradation', 'Network-wide impact'],
    affected_components: ['Initial link', 'Adjacent links', 'Regional network segment'],
    default_params: { initial_link: 'link-del-c1-en', cascade_delay_seconds: 15 },
    is_active: false,
    category: 'link',
  },
  {
    name: 'memory_leak',
    display_name: 'Memory Leak',
    description: 'Simulates a software bug causing steadily increasing memory consumption until the device crashes at threshold.',
    severity: 'high',
    icon: 'MemoryStick',
    expected_effects: ['Gradual memory increase', 'Performance degradation', 'Process restarts', 'Eventual device crash at threshold'],
    affected_components: ['Target device', 'Device processes', 'Connected services'],
    default_params: { device_id: 'core-mumbai-1', leak_rate_percent_per_minute: 5.0, crash_threshold: 98.0 },
    is_active: false,
    category: 'device',
  },
  {
    name: 'flapping_link',
    display_name: 'Flapping Link',
    description: 'Rapidly toggles a link up and down at regular intervals, causing routing instability and excessive control plane load.',
    severity: 'medium',
    icon: 'Activity',
    expected_effects: ['Rapid link state changes', 'Routing table instability', 'Control plane CPU spikes', 'Dampening mechanism activation'],
    affected_components: ['Flapping link', 'Connected routers', 'Routing protocol stability'],
    default_params: { link_id: 'link-del-mum-primary', flap_interval_seconds: 10 },
    is_active: false,
    category: 'link',
  },
];

// ---- API Functions ----

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${res.status}: ${errorBody}`);
    }
    return res.json();
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      throw new Error(`Connection refused: ${url}`);
    }
    throw err;
  }
}

// Simulator endpoints
export const chaosApi = {
  // Get list of available scenarios
  getScenarios: () =>
    fetchJSON<ScenarioMeta[]>(`${SIMULATOR_URL}/api/v1/chaos/scenarios`).catch(() => SCENARIOS),

  // Start a chaos scenario
  startScenario: (scenarioName: string, parameters: ScenarioDefaults) =>
    fetchJSON<StartScenarioResponse>(`${SIMULATOR_URL}/api/v1/chaos/scenarios/${scenarioName}/start`, {
      method: 'POST',
      body: JSON.stringify({ params: parameters }),
    }),

  // Stop a running scenario
  stopScenario: async (scenarioName: string): Promise<void> => {
    try {
      const res = await fetch(`${SIMULATOR_URL}/api/v1/chaos/scenarios/${scenarioName}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${res.status}: ${errorBody}`);
      }
      // Backend may return empty body — don't parse JSON
    } catch (err) {
      if (err instanceof TypeError && (err as TypeError).message.includes('fetch')) {
        throw new Error(`Connection refused: ${SIMULATOR_URL}/api/v1/chaos/scenarios/${scenarioName}/stop`);
      }
      throw err;
    }
  },

  // Get active scenarios (normalize backend field names)
  getActive: async (): Promise<ActiveScenario[]> => {
    const raw = await fetchJSON<any[]>(`${SIMULATOR_URL}/api/v1/chaos/active`).catch(() => []);
    return raw.map((r) => ({
      id: r.run_id ?? r.id,
      scenario_name: r.scenario ?? r.scenario_name,
      params: r.params ?? {},
      started_at: r.started_at,
      ended_at: r.ended_at ?? null,
      status: 'running' as const,
    }));
  },

  // Get chaos history
  getHistory: () =>
    fetchJSON<HistoryEntry[]>(`${SIMULATOR_URL}/api/v1/chaos/history`).catch(() => []),

  // Get network telemetry overview
  getMetrics: () =>
    fetchJSON<NetworkMetrics>(`${SIMULATOR_URL}/api/v1/telemetry/overview`).catch(() => null),
};

// Agent endpoints
export const agentApi = {
  // Get agent status — map raw backend response to expected shape
  getStatus: async (): Promise<AgentStatus> => {
    try {
      const raw = await fetchJSON<any>(`${AGENT_URL}/api/v1/agent/status`);
      let status: AgentStatus['status'] = 'idle';
      if (raw.running && !raw.paused) status = 'monitoring';
      else if (raw.running && raw.paused) status = 'idle';
      if (raw.incidents_created > 0) status = 'responding';
      return {
        status,
        active_incidents: raw.incidents_created ?? 0,
        health_score: 100,
        last_action: null,
        uptime_seconds: raw.uptime_seconds ?? 0,
      };
    } catch {
      return {
        status: 'idle',
        active_incidents: 0,
        health_score: 100,
        last_action: null,
        uptime_seconds: 0,
      };
    }
  },

  // Get active incidents
  getIncidents: () =>
    fetchJSON<AgentIncident[]>(`${AGENT_URL}/api/v1/incidents`).catch(() => []),

  // Get incident history
  getIncidentHistory: () =>
    fetchJSON<AgentIncident[]>(`${AGENT_URL}/api/v1/incidents`).catch(() => []),
};

// WebSocket connection for real-time events
export function createEventsWebSocket(onMessage: (data: any) => void): WebSocket | null {
  const wsUrl = SIMULATOR_URL.replace(/^http/, 'ws');
  try {
    const ws = new WebSocket(`${wsUrl}/ws/events`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // ignore non-JSON messages
      }
    };
    ws.onerror = () => {
      console.warn('Events WebSocket connection error');
    };
    return ws;
  } catch {
    console.warn('Failed to create WebSocket connection');
    return null;
  }
}

// WebSocket connection for real-time telemetry
export function createTelemetryWebSocket(onMessage: (data: NetworkMetrics) => void): WebSocket | null {
  const wsUrl = SIMULATOR_URL.replace(/^http/, 'ws');
  try {
    const ws = new WebSocket(`${wsUrl}/ws/telemetry`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // ignore non-JSON messages
      }
    };
    ws.onerror = () => {
      console.warn('Telemetry WebSocket connection error');
    };
    return ws;
  } catch {
    console.warn('Failed to create telemetry WebSocket');
    return null;
  }
}
