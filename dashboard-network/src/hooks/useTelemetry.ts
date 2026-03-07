import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  getOverview,
  getTopology,
  type OverviewResponse,
  type TopologyResponse,
  type DeviceData,
  type LinkData,
  type WSTelemetryPayload,
  type NetworkEvent,
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
