import { useEffect, useRef, useState, useCallback } from 'react';

export interface AgentEvent {
  id: string;
  type: 'incident_detected' | 'incident_updated' | 'incident_resolved' | 'decision_made' | 'action_executed' | 'approval_required' | 'agent_status' | 'learning_update';
  timestamp: string;
  data: Record<string, unknown>;
}

interface UseAgentEventsOptions {
  onEvent?: (event: AgentEvent) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export function useAgentEvents(options: UseAgentEventsOptions = {}) {
  const { onEvent, autoReconnect = true, reconnectDelay = 3000 } = options;
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<AgentEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const wsUrl = import.meta.env.VITE_AGENT_WS_URL || 'ws://localhost:8001/ws/agent-events';

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          setConnected(true);
          console.log('[AgentEvents] WebSocket connected');
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const agentEvent: AgentEvent = JSON.parse(event.data);
          setLastEvent(agentEvent);
          setEvents((prev) => [agentEvent, ...prev].slice(0, 100));
          onEvent?.(agentEvent);
        } catch (err) {
          console.warn('[AgentEvents] Failed to parse event:', err);
        }
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setConnected(false);
          console.log('[AgentEvents] WebSocket disconnected');
          if (autoReconnect) {
            reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
          }
        }
      };

      ws.onerror = (err) => {
        console.warn('[AgentEvents] WebSocket error:', err);
        ws.close();
      };
    } catch (err) {
      console.warn('[AgentEvents] Failed to create WebSocket:', err);
      if (autoReconnect && mountedRef.current) {
        reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
      }
    }
  }, [autoReconnect, reconnectDelay, onEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  return { connected, events, lastEvent, clearEvents };
}
