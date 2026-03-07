import { useState, useEffect, useRef, useCallback } from 'react';
import { chaosApi, createTelemetryWebSocket, NetworkMetrics, agentApi, AgentIncident } from '../api/chaos';

interface ImpactState {
  currentMetrics: NetworkMetrics | null;
  metricsHistory: NetworkMetrics[];
  baselineMetrics: NetworkMetrics | null;
  incidents: AgentIncident[];
  loading: boolean;
}

export function useImpact() {
  const [state, setState] = useState<ImpactState>({
    currentMetrics: null,
    metricsHistory: [],
    baselineMetrics: null,
    incidents: [],
    loading: true,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baselineCaptured = useRef(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const [current, incidents] = await Promise.all([
        chaosApi.getMetrics(),
        agentApi.getIncidents(),
      ]);

      setState((prev) => {
        // Capture baseline from first successful fetch
        let baseline = prev.baselineMetrics;
        if (!baselineCaptured.current && current) {
          baseline = { ...current };
          baselineCaptured.current = true;
        }

        // Accumulate metrics history from successive polls
        const newHistory = current
          ? [...prev.metricsHistory, current].slice(-180)
          : prev.metricsHistory;

        return {
          currentMetrics: current,
          metricsHistory: newHistory,
          baselineMetrics: baseline,
          incidents,
          loading: false,
        };
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    // Poll every 2 seconds for real-time feel
    pollRef.current = setInterval(fetchMetrics, 2000);

    // WebSocket for instant telemetry updates
    wsRef.current = createTelemetryWebSocket((data) => {
      setState((prev) => {
        const newHistory = [...prev.metricsHistory, data].slice(-180); // Keep 30 min at 10s intervals
        return {
          ...prev,
          currentMetrics: data,
          metricsHistory: newHistory,
        };
      });
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchMetrics]);

  const getDeviation = useCallback(
    (metric: keyof NetworkMetrics): number | null => {
      if (!state.currentMetrics || !state.baselineMetrics) return null;
      const current = state.currentMetrics[metric] as number;
      const baseline = state.baselineMetrics[metric] as number;
      if (baseline === 0) return current === 0 ? 0 : 100;
      return ((current - baseline) / baseline) * 100;
    },
    [state.currentMetrics, state.baselineMetrics]
  );

  const getMetricStatus = useCallback(
    (metric: keyof NetworkMetrics): 'normal' | 'degraded' | 'critical' => {
      const deviation = getDeviation(metric);
      if (deviation === null) return 'normal';
      const absDeviation = Math.abs(deviation);
      if (metric === 'health_score') {
        // For health score, negative deviation is bad
        if (deviation < -20) return 'critical';
        if (deviation < -10) return 'degraded';
        return 'normal';
      }
      // For other metrics, large positive deviation is bad
      if (absDeviation > 50) return 'critical';
      if (absDeviation > 20) return 'degraded';
      return 'normal';
    },
    [getDeviation]
  );

  return {
    ...state,
    getDeviation,
    getMetricStatus,
    refresh: fetchMetrics,
  };
}
