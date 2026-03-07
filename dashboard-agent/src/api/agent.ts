const AGENT_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:8001';
const SIMULATOR_URL = import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:8000';

// ============ Types ============

// Raw shape returned by GET /api/v1/agent/status
interface AgentStatusRaw {
  running: boolean;
  paused: boolean;
  mode: string;
  started_at: string | null;
  uptime_seconds: number;
  loop_count: number;
  anomalies_detected: number;
  incidents_created: number;
  observe_interval: number;
}

export interface AgentStatus {
  state: 'running' | 'paused' | 'stopped' | 'error';
  mode: string;
  uptime_seconds: number;
  loop_count: number;
  anomalies_detected: number;
  incidents_created: number;
  observe_interval: number;
  started_at: string | null;
}

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'detected' | 'analyzing' | 'mitigating' | 'resolved' | 'escalated';
  detected_at: string;
  resolved_at: string | null;
  affected_devices: string[];
  affected_links?: string[];
  root_cause: string | null;
  root_cause_hypothesis?: string | null;
  estimated_customer_impact?: string | null;
  hypotheses?: Hypothesis[];
  actions?: IncidentAction[];
  decisions?: Decision[];
  reasoning_trace?: string;
  timeline?: TimelineEvent[];
}

export interface Hypothesis {
  id: string;
  description: string;
  confidence: number;
  evidence: string[];
  status: 'investigating' | 'confirmed' | 'rejected';
}

export interface IncidentAction {
  id: string;
  type: string;
  action_type?: string;
  tier: number;
  autonomy_tier?: number;
  status: string;
  description: string;
  parameters: Record<string, unknown>;
  reasoning: string;
  confidence: number;
  blast_radius?: string;
  blast_radius_estimate?: string;
  created_at: string;
  executed_at: string | null;
  outcome: string | null;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  type: 'detection' | 'analysis' | 'action' | 'resolution' | 'escalation';
  details: string;
}

export interface PendingApproval {
  id: string;
  incident_id: string;
  incident_title: string;
  action_type: string;
  autonomy_tier: number;
  tier: number;
  description?: string;
  reasoning: string;
  confidence: number;
  blast_radius_estimate: string;
  blast_radius: string;
  parameters: Record<string, unknown>;
  status: string;
  created_at: string;
  executed_at: string | null;
  outcome: string | null;
  outcome_success: boolean | null;
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  expires_at?: string | null;
  related_incident?: Partial<Incident>;
}

export interface Decision {
  id: string;
  incident_id: string;
  incident_title?: string;
  action_type: string;
  autonomy_tier: number;
  confidence: number;
  reasoning: string;
  parameters: Record<string, unknown>;
  status: string;
  created_at: string;
  executed_at: string | null;
  outcome: string | null;
  outcome_success: boolean | null;
  blast_radius_estimate: string | null;
  // Computed compatibility fields used by UI components
  tier: number;
  timestamp: string;
  execution_time_ms: number;
}

export interface LearningRecord {
  id: string;
  timestamp: string;
  incident_type: string;
  lesson: string;
  threshold_before: number;
  threshold_after: number;
  metric: string;
  improvement: number;
}

export interface AgentMetrics {
  mttd_seconds: number;
  mttr_seconds: number;
  mttd_trend: number[];
  mttr_trend: number[];
  decision_success_rate: number;
  total_decisions: number;
  successful_decisions: number;
  failed_decisions: number;
  decisions_by_tier: Record<string, number>;
  threshold_evolution: ThresholdDataPoint[];
  decision_history: DecisionHistoryPoint[];
}

export interface ThresholdDataPoint {
  timestamp: string;
  metric: string;
  value: number;
}

export interface DecisionHistoryPoint {
  timestamp: string;
  success_rate: number;
  total: number;
}

export interface NetworkHealth {
  overall_score: number;
  device_count: number;
  healthy_count: number;
  warning_count: number;
  critical_count: number;
  metrics: {
    cpu_avg: number;
    memory_avg: number;
    bandwidth_utilization: number;
    packet_loss: number;
    latency_avg: number;
  };
}

// ============ API Functions ============

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function mapRawStatus(raw: AgentStatusRaw): AgentStatus {
  let state: AgentStatus['state'] = 'stopped';
  if (raw.running && !raw.paused) state = 'running';
  else if (raw.running && raw.paused) state = 'paused';
  else if (!raw.running) state = 'stopped';

  return {
    state,
    mode: raw.mode,
    uptime_seconds: raw.uptime_seconds,
    loop_count: raw.loop_count,
    anomalies_detected: raw.anomalies_detected,
    incidents_created: raw.incidents_created,
    observe_interval: raw.observe_interval,
    started_at: raw.started_at,
  };
}

// Agent Status
export async function getAgentStatus(): Promise<AgentStatus> {
  try {
    const raw = await fetchJSON<AgentStatusRaw>(`${AGENT_URL}/api/v1/agent/status`);
    return mapRawStatus(raw);
  } catch {
    return {
      state: 'error',
      mode: 'unknown',
      uptime_seconds: 0,
      loop_count: 0,
      anomalies_detected: 0,
      incidents_created: 0,
      observe_interval: 30,
      started_at: null,
    };
  }
}

// AI Diagnosis — triggers single Claude API call for an incident
export interface DiagnosisResult {
  incident_id: number;
  diagnosis: string;
  actions_proposed: number;
  decision_ids: number[];
}

export async function diagnoseIncident(incidentId: string): Promise<DiagnosisResult> {
  return fetchJSON<DiagnosisResult>(`${AGENT_URL}/api/v1/incidents/${incidentId}/diagnose`, {
    method: 'POST',
  });
}

// Agent control actions
export async function pauseAgent(): Promise<void> {
  await fetchJSON(`${AGENT_URL}/api/v1/agent/pause`, { method: 'POST' });
}

export async function resumeAgent(): Promise<void> {
  await fetchJSON(`${AGENT_URL}/api/v1/agent/resume`, { method: 'POST' });
}

export async function setAgentMode(mode: string): Promise<void> {
  await fetchJSON(`${AGENT_URL}/api/v1/agent/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

// Incidents — normalize backend response (id may be number, arrays may be null)
export async function getIncidents(): Promise<Incident[]> {
  try {
    const raw = await fetchJSON<any[]>(`${AGENT_URL}/api/v1/incidents`);
    return raw.map(normalizeIncident);
  } catch {
    return [];
  }
}

function normalizeIncident(r: any): Incident {
  return {
    id: String(r.id),
    title: r.title || '',
    description: r.description || r.root_cause_hypothesis || '',
    severity: r.severity || 'medium',
    status: r.status === 'open' ? 'detected'
      : r.status === 'action_pending' ? 'mitigating'
      : r.status === 'investigating' ? 'analyzing'
      : r.status || 'detected',
    detected_at: r.detected_at || new Date().toISOString(),
    resolved_at: r.resolved_at || null,
    affected_devices: r.affected_devices || [],
    affected_links: r.affected_links || [],
    root_cause: r.final_root_cause || r.root_cause || null,
    root_cause_hypothesis: r.root_cause_hypothesis || null,
    estimated_customer_impact: r.estimated_customer_impact || null,
    hypotheses: r.hypotheses || [],
    actions: r.actions || [],
    decisions: (r.decisions || []).map(normalizeDecision),
    reasoning_trace: r.claude_reasoning || r.reasoning_trace || undefined,
    timeline: r.timeline || [],
  };
}

export async function getIncident(id: string): Promise<Incident> {
  try {
    const raw = await fetchJSON<any>(`${AGENT_URL}/api/v1/incidents/${id}`);
    return normalizeIncident(raw);
  } catch {
    throw new Error(`Incident ${id} not found or backend unavailable`);
  }
}

// Pending Approvals (decisions with status=pending)
export async function getPendingApprovals(): Promise<PendingApproval[]> {
  try {
    const raw = await fetchJSON<any[]>(`${AGENT_URL}/api/v1/decisions/pending`);
    return raw.map(normalizeDecisionToPendingApproval);
  } catch {
    return [];
  }
}

function normalizeDecisionToPendingApproval(d: any): PendingApproval {
  const tier = d.autonomy_tier ?? d.tier ?? 1;
  return {
    id: String(d.id ?? ''),
    incident_id: String(d.incident_id ?? ''),
    incident_title: d.incident_title || '',
    action_type: d.action_type || 'unknown',
    autonomy_tier: tier,
    tier,
    description: d.description || d.reasoning || '',
    reasoning: d.reasoning || '',
    confidence: d.confidence ?? 0,
    blast_radius_estimate: d.blast_radius_estimate || '',
    blast_radius: d.blast_radius_estimate || d.blast_radius || '',
    parameters: d.parameters || {},
    status: d.status || 'pending',
    created_at: d.created_at || new Date().toISOString(),
    executed_at: d.executed_at || null,
    outcome: d.outcome || null,
    outcome_success: d.outcome_success ?? null,
    urgency: d.urgency || (tier >= 4 ? 'critical' : tier >= 3 ? 'high' : 'medium'),
    expires_at: d.expires_at || null,
    related_incident: d.related_incident || undefined,
  };
}

export async function approveAction(incidentId: string): Promise<void> {
  try {
    await fetchJSON(`${AGENT_URL}/api/v1/incidents/${incidentId}/approve`, { method: 'POST' });
  } catch {
    console.error(`Failed to approve action for incident ${incidentId}`);
  }
}

export async function rejectAction(incidentId: string, reason?: string): Promise<void> {
  try {
    await fetchJSON(`${AGENT_URL}/api/v1/incidents/${incidentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  } catch {
    console.error(`Failed to reject action for incident ${incidentId}`);
  }
}

function normalizeDecision(d: any): Decision {
  // Map backend field names to what the UI expects
  const tier = d.autonomy_tier ?? d.tier ?? 1;
  const timestamp = d.created_at ?? d.timestamp ?? new Date().toISOString();
  // Map status to an outcome string the UI understands
  let uiOutcome: string = d.outcome ?? d.status ?? 'pending';
  if (d.outcome_success === true) uiOutcome = 'success';
  else if (d.outcome_success === false) uiOutcome = 'failure';
  else if (d.status === 'pending' || d.status === 'pending_approval') uiOutcome = 'pending';
  else if (d.status === 'rejected') uiOutcome = 'rejected';
  else if (d.status === 'executed' && d.outcome_success === null) uiOutcome = 'success';

  return {
    id: String(d.id ?? ''),
    incident_id: String(d.incident_id ?? ''),
    incident_title: d.incident_title || '',
    action_type: d.action_type || 'unknown',
    autonomy_tier: tier,
    confidence: d.confidence ?? 0,
    reasoning: d.reasoning || '',
    parameters: d.parameters || {},
    status: d.status || 'pending',
    created_at: d.created_at || new Date().toISOString(),
    executed_at: d.executed_at || null,
    outcome: uiOutcome,
    outcome_success: d.outcome_success ?? null,
    blast_radius_estimate: d.blast_radius_estimate || null,
    // Compatibility fields for UI
    tier,
    timestamp,
    execution_time_ms: d.execution_time_ms ?? (d.executed_at && d.created_at
      ? new Date(d.executed_at).getTime() - new Date(d.created_at).getTime()
      : 0),
  };
}

// Decisions / Audit
export async function getDecisions(limit = 100): Promise<Decision[]> {
  try {
    const raw = await fetchJSON<any[]>(`${AGENT_URL}/api/v1/decisions?limit=${limit}`);
    return raw.map(normalizeDecision);
  } catch {
    return [];
  }
}

// Agent Metrics (from learning/effectiveness endpoint) — map raw fields to UI shape
export async function getAgentMetrics(): Promise<AgentMetrics> {
  const defaults: AgentMetrics = {
    mttd_seconds: 0,
    mttr_seconds: 0,
    mttd_trend: [],
    mttr_trend: [],
    decision_success_rate: 0,
    total_decisions: 0,
    successful_decisions: 0,
    failed_decisions: 0,
    decisions_by_tier: {},
    threshold_evolution: [],
    decision_history: [],
  };
  try {
    const raw = await fetchJSON<any>(`${AGENT_URL}/api/v1/learning/effectiveness`);
    return {
      mttd_seconds: raw.mttd_seconds ?? 0,
      mttr_seconds: raw.mttr_seconds ?? 0,
      mttd_trend: raw.mttd_trend ?? [],
      mttr_trend: raw.mttr_trend ?? [],
      decision_success_rate: raw.decision_success_rate ?? raw.success_rate ?? 0,
      total_decisions: raw.total_decisions ?? raw.decisions_total ?? 0,
      successful_decisions: raw.successful_decisions ?? raw.decisions_successful ?? 0,
      failed_decisions: raw.failed_decisions ?? raw.decisions_failed ?? 0,
      decisions_by_tier: raw.decisions_by_tier ?? {},
      threshold_evolution: raw.threshold_evolution ?? [],
      decision_history: raw.decision_history ?? [],
    };
  } catch {
    return defaults;
  }
}

// Learning Records (thresholds endpoint returns a dict, not an array — transform to display format)
export async function getLearningRecords(): Promise<LearningRecord[]> {
  try {
    const raw = await fetchJSON<any>(`${AGENT_URL}/api/v1/learning/thresholds`);
    // Backend returns a flat dict of current thresholds, not an array of records
    if (Array.isArray(raw)) return raw;
    // Transform thresholds dict into display records
    return Object.entries(raw).map(([metric, value], i) => ({
      id: String(i),
      timestamp: new Date().toISOString(),
      incident_type: 'threshold_tuning',
      lesson: `Current threshold for ${metric.replace(/_/g, ' ')}`,
      threshold_before: 0,
      threshold_after: value as number,
      metric,
      improvement: 0,
    }));
  } catch {
    return [];
  }
}

// Network Health (from simulator) — maps overview response to NetworkHealth shape
export async function getNetworkHealth(): Promise<NetworkHealth> {
  try {
    const raw = await fetchJSON<any>(`${SIMULATOR_URL}/api/v1/telemetry/overview`);
    const ds = raw.device_status || {};
    return {
      overall_score: raw.health_score ?? 0,
      device_count: raw.device_count ?? 0,
      healthy_count: ds.healthy ?? 0,
      warning_count: (ds.degraded ?? 0),
      critical_count: (ds.critical ?? 0) + (ds.down ?? 0),
      metrics: {
        cpu_avg: raw.avg_cpu_percent ?? 0,
        memory_avg: raw.avg_memory_percent ?? 0,
        bandwidth_utilization: raw.avg_utilization_percent ?? 0,
        packet_loss: raw.avg_packet_loss_percent ?? 0,
        latency_avg: raw.avg_latency_ms ?? 0,
      },
    };
  } catch {
    return {
      overall_score: 0,
      device_count: 0,
      healthy_count: 0,
      warning_count: 0,
      critical_count: 0,
      metrics: {
        cpu_avg: 0,
        memory_avg: 0,
        bandwidth_utilization: 0,
        packet_loss: 0,
        latency_avg: 0,
      },
    };
  }
}

