import { useState, useEffect, useCallback, useRef } from 'react';
import {
  chaosApi,
  agentApi,
  createEventsWebSocket,
  ActiveScenario,
  HistoryEntry,
  AgentStatus,
  AgentIncident,
  ScenarioDefaults,
} from '../api/chaos';

interface ChaosState {
  activeScenarios: ActiveScenario[];
  history: HistoryEntry[];
  agentStatus: AgentStatus;
  incidents: AgentIncident[];
  loading: boolean;
  error: string | null;
}

export function useChaos() {
  const [state, setState] = useState<ChaosState>({
    activeScenarios: [],
    history: [],
    agentStatus: {
      status: 'idle',
      active_incidents: 0,
      health_score: 100,
      last_action: null,
      uptime_seconds: 0,
    },
    incidents: [],
    loading: true,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [active, history, agentStatus, incidents] = await Promise.all([
        chaosApi.getActive(),
        chaosApi.getHistory(),
        agentApi.getStatus(),
        agentApi.getIncidents(),
      ]);

      setState((prev) => ({
        ...prev,
        activeScenarios: active,
        history,
        agentStatus,
        incidents,
        loading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch data',
      }));
    }
  }, []);

  const startScenario = useCallback(async (scenarioName: string, parameters: ScenarioDefaults) => {
    try {
      const result = await chaosApi.startScenario(scenarioName, parameters);
      await fetchAll();
      return result;
    } catch (err) {
      // Re-fetch to sync state even on error
      await fetchAll().catch(() => {});
      throw err;
    }
  }, [fetchAll]);

  const stopScenario = useCallback(async (scenarioName: string) => {
    try {
      await chaosApi.stopScenario(scenarioName);
      await fetchAll();
    } catch (err) {
      await fetchAll().catch(() => {});
      throw err;
    }
  }, [fetchAll]);

  useEffect(() => {
    fetchAll();

    // Set up polling every 3 seconds
    pollRef.current = setInterval(fetchAll, 3000);

    // Set up WebSocket for real-time events
    wsRef.current = createEventsWebSocket((data) => {
      if (data.type === 'scenario_update') {
        fetchAll();
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchAll]);

  return {
    ...state,
    startScenario,
    stopScenario,
    refresh: fetchAll,
  };
}
