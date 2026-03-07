import { useState, useEffect, useCallback, useRef } from 'react';
import { getIncidents, Incident } from '../api/agent';
import { useAgentEvents, AgentEvent } from './useAgentEvents';

interface UseIncidentsOptions {
  pollInterval?: number;
}

export function useIncidents(options: UseIncidentsOptions = {}) {
  const { pollInterval = 5000 } = options;
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchIncidents = useCallback(async () => {
    try {
      const data = await getIncidents();
      if (mountedRef.current) {
        setIncidents(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch incidents');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleEvent = useCallback((event: AgentEvent) => {
    if (!mountedRef.current) return;

    switch (event.type) {
      case 'incident_detected':
        setIncidents((prev) => [event.data as unknown as Incident, ...prev]);
        break;
      case 'incident_updated': {
        const updated = event.data as unknown as Incident;
        setIncidents((prev) =>
          prev.map((inc) => (inc.id === updated.id ? { ...inc, ...updated } : inc))
        );
        break;
      }
      case 'incident_resolved': {
        const resolved = event.data as unknown as Incident;
        setIncidents((prev) =>
          prev.map((inc) =>
            inc.id === resolved.id ? { ...inc, status: 'resolved', resolved_at: new Date().toISOString() } : inc
          )
        );
        break;
      }
    }
  }, []);

  useAgentEvents({ onEvent: handleEvent });

  // Polling fallback
  useEffect(() => {
    mountedRef.current = true;
    fetchIncidents();

    const interval = setInterval(fetchIncidents, pollInterval);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchIncidents, pollInterval]);

  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved');

  const severityCounts = {
    critical: incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length,
    high: incidents.filter((i) => i.severity === 'high' && i.status !== 'resolved').length,
    medium: incidents.filter((i) => i.severity === 'medium' && i.status !== 'resolved').length,
    low: incidents.filter((i) => i.severity === 'low' && i.status !== 'resolved').length,
  };

  return {
    incidents,
    activeIncidents,
    resolvedIncidents,
    severityCounts,
    loading,
    error,
    refetch: fetchIncidents,
  };
}
