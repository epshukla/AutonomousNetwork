import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  getOverview,
  getTopology,
  getInterfaces,
  getTrafficAnalytics,
  getComplianceStatus,
  getSubscriberLogs,
  getSLAData,
  type OverviewResponse,
  type TopologyResponse,
  type DeviceData,
  type LinkData,
  type WSTelemetryPayload,
  type NetworkEvent,
  type InterfacesResponse,
  type TrafficAnalytics,
  type ComplianceStatus,
  type SubscriberLogsResponse,
  type SLAData,
} from '../api/simulator';

const BASE_URL = import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:8000';
const WS_BASE = BASE_URL.replace(/^http/, 'ws');

// ── Overview Hook (replaces NetworkStats) ─────────────────

export interface UseOverviewReturn {
  overview: OverviewResponse | null;
  overviewHistory: OverviewResponse[];
  loading: boolean;
  error: string | null;
}

export function useOverview(pollInterval = 5000): UseOverviewReturn {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewHistory, setOverviewHistory] = useState<OverviewResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const data = await getOverview();
        if (mounted) {
          setOverview(data);
          setOverviewHistory((prev) => {
            const next = [...prev, data];
            return next.length > 60 ? next.slice(-60) : next;
          });
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch overview');
          setLoading(false);
        }
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pollInterval]);

  return { overview, overviewHistory, loading, error };
}

// ── Topology Hook ─────────────────────────────────────────

export interface UseTopologyReturn {
  topology: TopologyResponse | null;
  devices: DeviceData[];
  links: LinkData[];
  devicesMap: Record<string, DeviceData>;
  linksMap: Record<string, LinkData>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTopology(pollInterval = 5000): UseTopologyReturn {
  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getTopology();
      setTopology(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch topology');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  const devicesMap = topology?.devices || {};
  const linksMap = topology?.links || {};

  return {
    topology,
    devices: Object.values(devicesMap),
    links: Object.values(linksMap),
    devicesMap,
    linksMap,
    loading,
    error,
    refresh,
  };
}

// ── WebSocket Telemetry Hook ──────────────────────────────

export interface UseWSTelemetryReturn {
  latestTelemetry: WSTelemetryPayload | null;
  telemetryHistory: WSTelemetryPayload[];
  isConnected: boolean;
}

export function useWSTelemetry(maxHistory = 60): UseWSTelemetryReturn {
  const [latest, setLatest] = useState<WSTelemetryPayload | null>(null);
  const [history, setHistory] = useState<WSTelemetryPayload[]>([]);

  const { isConnected } = useWebSocket({
    url: `${WS_BASE}/ws/telemetry`,
    onMessage: (data) => {
      const payload = data as WSTelemetryPayload;
      if (payload && payload.timestamp) {
        setLatest(payload);
        setHistory((prev) => {
          const next = [...prev, payload];
          return next.length > maxHistory ? next.slice(-maxHistory) : next;
        });
      }
    },
  });

  return { latestTelemetry: latest, telemetryHistory: history, isConnected };
}

// ── Interfaces Hook ──────────────────────────────────────

export interface UseInterfacesReturn {
  data: InterfacesResponse | null;
  loading: boolean;
  error: string | null;
}

export function useInterfaces(deviceId: string | null, pollInterval = 5000): UseInterfacesReturn {
  const [data, setData] = useState<InterfacesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setData(null);
      setLoading(false);
      return;
    }
    let mounted = true;

    const poll = async () => {
      try {
        const result = await getInterfaces(deviceId);
        if (mounted) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch interfaces');
          setLoading(false);
        }
      }
    };

    setLoading(true);
    poll();
    const interval = setInterval(poll, pollInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [deviceId, pollInterval]);

  return { data, loading, error };
}

// ── Traffic Analytics Hook ───────────────────────────────

export interface UseTrafficAnalyticsReturn {
  analytics: TrafficAnalytics | null;
  loading: boolean;
  error: string | null;
}

export function useTrafficAnalytics(pollInterval = 10000): UseTrafficAnalyticsReturn {
  const [analytics, setAnalytics] = useState<TrafficAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const data = await getTrafficAnalytics();
        if (mounted) {
          setAnalytics(data);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch traffic analytics');
          setLoading(false);
        }
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pollInterval]);

  return { analytics, loading, error };
}

// ── Events Hook ──────────────────────────────────────────

export interface UseEventsReturn {
  events: NetworkEvent[];
  isConnected: boolean;
}

export function useEvents(maxEvents = 200): UseEventsReturn {
  const [events, setEvents] = useState<NetworkEvent[]>([]);

  const { isConnected } = useWebSocket({
    url: `${WS_BASE}/ws/events`,
    onMessage: (data) => {
      const event = data as NetworkEvent;
      if (event && event.event_type) {
        setEvents((prev) => {
          const next = [{ ...event, timestamp: event.timestamp || new Date().toISOString() }, ...prev];
          return next.length > maxEvents ? next.slice(0, maxEvents) : next;
        });
      }
    },
  });

  return { events, isConnected };
}

// ── Compliance Status Hook ──────────────────────────────

export function useComplianceStatus(pollInterval = 10000) {
  const [data, setData] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const result = await getComplianceStatus();
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pollInterval]);

  return { data, loading };
}

// ── Subscriber Logs Hook ────────────────────────────────

export function useSubscriberLogs(
  limit = 50,
  offset = 0,
  subscriberId?: string,
  pollInterval = 15000
) {
  const [data, setData] = useState<SubscriberLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const result = await getSubscriberLogs(limit, offset, subscriberId);
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    setLoading(true);
    poll();
    const interval = setInterval(poll, pollInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [limit, offset, subscriberId, pollInterval]);

  return { data, loading };
}

// ── SLA Data Hook ───────────────────────────────────────

export function useSLAData(pollInterval = 10000) {
  const [data, setData] = useState<SLAData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const result = await getSLAData();
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, pollInterval);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pollInterval]);

  return { data, loading };
}
