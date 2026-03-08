const BASE_URL = import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ── Interfaces matching actual backend responses ─────────

export interface ActiveChaosInfo {
  scenario: string;
  display_name: string;
  severity: string;
}

export interface DeviceData {
  device_id: string;
  type: string;
  city: string;
  region: string | null;
  peer_as: number | null;
  peer_name: string | null;
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  cpu_utilization: number;
  memory_utilization: number;
  temperature_celsius: number;
  uptime_seconds: number;
  rate_limit_mbps?: number | null;
  active_chaos?: ActiveChaosInfo[];
  vendor?: string | null;
  model?: string | null;
  interfaces?: string[];
  subscribers?: number | null;
  pon_ports?: number | null;
  cpu_cores?: number;
  memory_gb?: number;
  power_status?: string;
  fan_status?: string;
  psu_count?: number;
  psu_active?: number;
  fan_count?: number;
  fan_active?: number;
}

export interface LinkData {
  link_id: string;
  from: string;
  to: string;
  type: string;
  capacity_gbps: number;
  base_latency_ms?: number;
  status: 'up' | 'degraded' | 'down';
  utilization_percent: number;
  throughput_gbps: number;
  latency_ms: number;
  packet_loss_percent: number;
  errors_in?: number;
  errors_out?: number;
  active_chaos?: ActiveChaosInfo[];
  interface_from?: string | null;
  interface_to?: string | null;
}

export interface BgpSession {
  device_id: string;
  peer_as: number;
  peer_name: string;
  status: string;
  prefixes_received: number;
  flap_count: number;
}

export interface TopologyResponse {
  devices: Record<string, DeviceData>;
  links: Record<string, LinkData>;
  bgp_sessions: Record<string, BgpSession>;
  customer_distribution: Record<string, { total: number; enterprise: number; residential: number }>;
  active_chaos?: Array<ActiveChaosInfo & { params: Record<string, unknown> }>;
}

export interface OverviewResponse {
  health_score: number;
  total_throughput_gbps: number;
  avg_latency_ms: number;
  avg_utilization_percent: number;
  device_count: number;
  link_count: number;
  device_status: Record<string, number>;
  link_status: Record<string, number>;
}

export interface TelemetryDataPoint {
  time: string;
  cpu_utilization?: number | null;
  memory_utilization?: number | null;
  temperature_celsius?: number | null;
  utilization_percent?: number | null;
  throughput_gbps?: number | null;
  latency_ms?: number | null;
  packet_loss_percent?: number | null;
  errors_in?: number;
  errors_out?: number;
  status?: string;
}

export interface TelemetryResponse {
  device_id?: string;
  link_id?: string;
  start: string;
  end: string;
  interval: string;
  data: TelemetryDataPoint[];
}

export interface NetworkEvent {
  id?: number;
  event_type: string;
  source: string;
  severity: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  time?: string;
}

// Real-time telemetry from WebSocket
export interface WSTelemetryPayload {
  timestamp: string;
  devices: Record<string, {
    cpu_utilization: number;
    memory_utilization: number;
    temperature_celsius: number;
    status: string;
    uptime_seconds: number;
  }>;
  links: Record<string, {
    utilization_percent: number;
    throughput_gbps: number;
    latency_ms: number;
    packet_loss_percent: number;
    errors_in: number;
    errors_out: number;
    status: string;
  }>;
}

// ── Topology ─────────────────────────────────────────────

export async function getTopology(): Promise<TopologyResponse> {
  return request<TopologyResponse>('/api/v1/topology');
}

export async function getDevices(): Promise<Record<string, DeviceData>> {
  return request<Record<string, DeviceData>>('/api/v1/topology/devices');
}

export async function getDevice(id: string): Promise<DeviceData> {
  return request<DeviceData>(`/api/v1/topology/devices/${id}`);
}

export async function getLinks(): Promise<Record<string, LinkData>> {
  return request<Record<string, LinkData>>('/api/v1/topology/links');
}

export async function getLink(id: string): Promise<LinkData> {
  return request<LinkData>(`/api/v1/topology/links/${id}`);
}

export async function getBgpSessions(): Promise<BgpSession[]> {
  return request<BgpSession[]>('/api/v1/topology/bgp-sessions');
}

// ── Telemetry ────────────────────────────────────────────

export async function getOverview(): Promise<OverviewResponse> {
  return request<OverviewResponse>('/api/v1/telemetry/overview');
}

export async function getDeviceTelemetry(
  deviceId: string,
  interval = '5s'
): Promise<TelemetryResponse> {
  return request<TelemetryResponse>(
    `/api/v1/telemetry/devices/${deviceId}?interval=${interval}`
  );
}

export async function getLinkTelemetry(
  linkId: string,
  interval = '5s'
): Promise<TelemetryResponse> {
  return request<TelemetryResponse>(
    `/api/v1/telemetry/links/${linkId}?interval=${interval}`
  );
}

// ── Interfaces ────────────────────────────────────────────

export interface InterfaceStats {
  interface: string;
  status: string;
  admin_status: string;
  speed_gbps: number;
  utilization_percent: number;
  in_bps: number;
  out_bps: number;
  in_errors: number;
  out_errors: number;
  connected_to: string | null;
  link_id: string | null;
  link_type: string | null;
}

export interface InterfacesResponse {
  device_id: string;
  vendor: string | null;
  model: string | null;
  interface_count: number;
  interfaces: InterfaceStats[];
}

export async function getInterfaces(deviceId: string): Promise<InterfacesResponse> {
  return request<InterfacesResponse>(`/api/v1/interfaces/${deviceId}`);
}

// ── Traffic Analytics ─────────────────────────────────────

export interface TrafficAnalytics {
  timestamp: string;
  total_traffic_gbps: number;
  protocol_breakdown_gbps: Record<string, number>;
  destination_breakdown_gbps: Record<string, number>;
  link_traffic: Array<{
    link_id: string;
    type: string;
    throughput_gbps: number;
    utilization_percent: number;
  }>;
}

export async function getTrafficAnalytics(): Promise<TrafficAnalytics> {
  return request<TrafficAnalytics>('/api/v1/telemetry/traffic-analytics');
}

// ── Compliance ────────────────────────────────────────────

export interface ComplianceCheck {
  name: string;
  status: string;
  detail: string;
}

export interface RegulatoryBody {
  name: string;
  status: string;
  last_audit: string;
  next_audit: string;
  checks: ComplianceCheck[];
}

export interface ComplianceStatus {
  bodies: RegulatoryBody[];
  ntp_synced: boolean;
  ntp_source: string;
  overall_status: string;
  checked_at?: string;
}

export interface SubscriberLog {
  session_id: string;
  subscriber_id: string;
  ip_address: string;
  mac_address: string;
  olt_device: string;
  pon_port: string;
  start_time: string;
  duration_minutes: number;
  bytes_up: number;
  bytes_down: number;
  protocol: string;
  status: string;
  nat_ip: string;
  nat_port_range: string;
}

export interface SubscriberLogsResponse {
  logs: SubscriberLog[];
  total: number;
}

export interface AuditEntry {
  timestamp: string;
  category: string;
  user: string;
  action: string;
  detail: string;
  source_ip: string;
  result: string;
}

export interface SLAData {
  overall_uptime_percent: number;
  backbone_uptime_percent: number;
  mttr_minutes: number;
  sla_target: number;
  current_month_downtime_minutes: number;
  incidents_this_month: number;
  tiers: Record<string, { uptime: number; devices: number }>;
}

export interface CertInReport {
  organization: string;
  sector: string;
  incident_classification: string;
  incident_type: string;
  severity: string;
  timeline: { event: string; time: string }[];
  affected_systems: string[];
  remediation_steps: string[];
  reporting_compliance: {
    within_6_hours: boolean;
    reported_at: string;
    deadline: string;
    regulation: string;
  };
  contact: {
    name: string;
    designation: string;
    phone: string;
    email: string;
  };
  generated_at: string;
}

export async function getComplianceStatus(): Promise<ComplianceStatus> {
  return request<ComplianceStatus>('/api/v1/compliance/status');
}

export async function getSubscriberLogs(
  limit = 50,
  offset = 0,
  subscriberId?: string
): Promise<SubscriberLogsResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (subscriberId) params.set('subscriber_id', subscriberId);
  return request<SubscriberLogsResponse>(`/api/v1/compliance/subscriber-logs?${params}`);
}

export async function getAuditTrail(
  limit = 100,
  category?: string
): Promise<AuditEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (category) params.set('category', category);
  return request<AuditEntry[]>(`/api/v1/compliance/audit-trail?${params}`);
}

export async function getSLAData(): Promise<SLAData> {
  return request<SLAData>('/api/v1/compliance/sla');
}

export async function getCertInReport(incidentType = 'network_intrusion'): Promise<CertInReport> {
  return request<CertInReport>(`/api/v1/compliance/certin-report?incident_type=${incidentType}`);
}

// ── Kill Switch ──────────────────────────────────────────

export interface KillTarget {
  target_type: 'device' | 'link';
  target_id: string;
}

export interface BackupPath {
  original_link: string;
  backup_link: string;
  description: string;
  status: string;
  hop_increase: number;
  latency_increase_ms: number;
}

export interface RoutingAnalysis {
  efficiency_percent: number;
  total_paths: number;
  healthy_paths: number;
  rerouted_paths: number;
  broken_paths: number;
  avg_latency_increase_ms: number;
}

export interface CostImpact {
  total_cost: number;
  revenue_loss: number;
  sla_penalty: number;
  operational_cost: number;
  affected_subscribers: number;
  cost_per_second: number;
  duration_seconds: number;
}

export interface KillResponse {
  success: boolean;
  target: KillTarget;
  affected_links: string[];
  backup_paths: BackupPath[];
  routing_analysis: RoutingAnalysis;
}

export interface RestoreResponse {
  success: boolean;
  target: KillTarget;
  restored_links: string[];
}

export interface KillSwitchStatus {
  killed_devices: string[];
  killed_links: string[];
  kill_details: Record<string, { killed_at: string; affected_links?: string[] }>;
  routing_efficiency: RoutingAnalysis;
  cost_impact: CostImpact;
  backup_paths: BackupPath[];
}

export async function killTarget(target: KillTarget): Promise<KillResponse> {
  return request<KillResponse>('/api/v1/killswitch/kill', {
    method: 'POST',
    body: JSON.stringify(target),
  });
}

export async function restoreTarget(target: KillTarget): Promise<RestoreResponse> {
  return request<RestoreResponse>('/api/v1/killswitch/restore', {
    method: 'POST',
    body: JSON.stringify(target),
  });
}

export async function getKillSwitchStatus(): Promise<KillSwitchStatus> {
  return request<KillSwitchStatus>('/api/v1/killswitch/status');
}

// ── Events ───────────────────────────────────────────────
// Events come from WebSocket only; no REST list endpoint currently.

// ── Chaos ────────────────────────────────────────────────

export interface ChaosScenario {
  name: string;
  display_name: string;
  description: string;
  severity: string;
  default_params: Record<string, unknown>;
  expected_effects: string[];
  affected_components: string[];
  is_active: boolean;
}

export async function getChaosScenarios(): Promise<ChaosScenario[]> {
  return request<ChaosScenario[]>('/api/v1/chaos/scenarios');
}

export async function getActiveChaos(): Promise<unknown[]> {
  return request<unknown[]>('/api/v1/chaos/active');
}

// ── Health ───────────────────────────────────────────────

export async function getHealth(): Promise<{ status: string; service: string; devices: number; links: number }> {
  return request('/health');
}
