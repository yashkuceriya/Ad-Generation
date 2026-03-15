import { useEffect, useRef, useState } from 'react';
import type { SSEEvent } from '../types';

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

export function useSSE(onEvent: (event: SSEEvent) => void) {
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    let disposed = false;

    function open() {
      if (disposed) return;
      es = new EventSource('/api/events/stream');

      es.onopen = () => {
        retries = 0;
        setConnected(true);
      };

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as SSEEvent;
          if (data.type === 'connected' || data.type === 'heartbeat') {
            setConnected(true);
            return;
          }
          onEventRef.current(data);
        } catch {
          // skip parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        if (disposed) return;

        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * 2 ** retries,
          MAX_RECONNECT_DELAY,
        );
        retries += 1;
        timer = setTimeout(open, delay);
      };
    }

    open();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  return { connected };
}
