"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LiveEvent = {
  type: "revenue" | "attendance" | "active_subscriptions" | "heartbeat" | "error";
  data: Record<string, unknown>;
};

export function useAnalyticsLive() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [latest, setLatest] = useState<Record<string, unknown>>({
    revenue: 0,
    attendance: 0,
    activeSubscriptions: 0,
    lastUpdate: null as string | null
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    try {
      const es = new EventSource("/api/analytics/live");
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);

      es.addEventListener("revenue", (e) => {
        const data = JSON.parse(e.data);
        setLatest((prev) => ({ ...prev, revenue: data.amount, lastUpdate: data.timestamp }));
        setEvents((prev) => [...prev.slice(-49), { type: "revenue", data }]);
      });

      es.addEventListener("attendance", (e) => {
        const data = JSON.parse(e.data);
        setLatest((prev) => ({ ...prev, attendance: data.count, lastUpdate: data.timestamp }));
      });

      es.addEventListener("active_subscriptions", (e) => {
        const data = JSON.parse(e.data);
        setLatest((prev) => ({ ...prev, activeSubscriptions: data.count, lastUpdate: data.timestamp }));
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;
        // Reconnect after 5s
        setTimeout(connect, 5000);
      };
    } catch {
      setConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  return { connected, events, latest, connect, disconnect };
}
