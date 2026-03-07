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
