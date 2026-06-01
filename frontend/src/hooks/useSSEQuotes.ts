import { useEffect, useState } from "react";
import type { StockQuote } from "@/types";

interface QuoteEvent {
  quotes: StockQuote[];
}

export function useSSEQuotes(symbols: string[]) {
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use a string key so array-reference changes don't trigger reconnects.
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (!symbolsKey) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const symbolParam = symbolsKey;
    const apiPrefix = import.meta.env.VITE_API_PREFIX || "/api/v1";
    // Resolve the backend origin so SSE works when the frontend (Vercel) and the
    // backend (Cloud Run) live on different domains. Falls back to a relative
    // path for local dev where the Vite proxy forwards /api to the backend.
    const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
    const apiUrl = trimTrailingSlash(import.meta.env.VITE_API_URL || "");
    const apiOrigin = apiUrl
      ? trimTrailingSlash(apiUrl.endsWith(apiPrefix) ? apiUrl.slice(0, -apiPrefix.length) : apiUrl)
      : trimTrailingSlash(import.meta.env.VITE_API_ORIGIN || "");
    const url = `${apiOrigin}${apiPrefix}/events/quotes?symbols=${encodeURIComponent(symbolParam)}`;

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (closed) return;

      eventSource?.close();
      clearReconnectTimer();

      const es = new EventSource(url);
      eventSource = es;

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
        if (eventSource === es) eventSource = null;
        reconnectTimer = setTimeout(() => {
          if (document.visibilityState !== "hidden") {
            connect();
          }
        }, 5000);
      };
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    connect();

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      clearReconnectTimer();
      eventSource?.close();
    };
  }, [symbolsKey]);

  return { quotes, connected, error };
}
