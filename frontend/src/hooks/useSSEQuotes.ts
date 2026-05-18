import { useEffect, useRef, useState, useCallback } from "react";
import type { StockQuote } from "@/types";

interface QuoteEvent {
  quotes: StockQuote[];
}

export function useSSEQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (symbols.length === 0) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const symbolParam = symbols.join(",");
    const apiPrefix = import.meta.env.VITE_API_PREFIX || "/api/v1";
    const url = `${apiPrefix}/events/quotes?symbols=${encodeURIComponent(symbolParam)}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const data: QuoteEvent = JSON.parse(event.data);
        if (data.quotes) {
          setQuotes((prev) => {
            const next = new Map(prev);
            for (const q of data.quotes) {
              next.set(q.symbol, q);
            }
            return next;
          });
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("Connection lost");
      es.close();
      // Auto-reconnect after 5s
      setTimeout(() => {
        if (document.visibilityState !== "hidden") {
          connect();
        }
      }, 5000);
    };
  }, [symbols]);

  useEffect(() => {
    connect();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  return { quotes, connected, error };
}
