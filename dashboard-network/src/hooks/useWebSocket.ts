import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: unknown) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  lastMessage: unknown | null;
  isConnected: boolean;
  reconnectCount: number;
  send: (data: unknown) => void;
}

export function useWebSocket({
  url,
  onMessage,
  reconnectInterval = 3000,
  maxReconnectAttempts = 20,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<unknown | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const mountedRef = useRef(true);

  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setReconnectCount(0);
        console.log(`[WS] Connected to ${url}`);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          onMessageRef.current?.(data);
        } catch {
          setLastMessage(event.data);
          onMessageRef.current?.(event.data);
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        console.log(`[WS] Disconnected from ${url} (code: ${event.code})`);

        setReconnectCount((prev) => {
          if (prev < maxReconnectAttempts) {
            const delay = Math.min(
              reconnectInterval * Math.pow(1.5, prev),
              30000
            );
            console.log(`[WS] Reconnecting in ${delay}ms (attempt ${prev + 1})`);
            reconnectTimerRef.current = setTimeout(connect, delay);
            return prev + 1;
          }
          console.log('[WS] Max reconnect attempts reached');
          return prev;
        });
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (error) {
      console.error('[WS] Connection failed:', error);
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  return { lastMessage, isConnected, reconnectCount, send };
}
