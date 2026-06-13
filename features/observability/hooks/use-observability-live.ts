"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LiveData = {
  serviceHealth: Array<{ service_name: string; status: string }>;
  activeIncidents: Array<{ id: string; title: string; severity: string; status: string }>;
  infraSnapshot: Array<{ host_name: string; cpu_usage_pct: number; memory_usage_pct: number; disk_usage_pct: number }>;
  queueStatus: Array<{ queue_name: string; current_depth: number; status: string }>;
  liveMetrics: Array<{ metric_name: string; metric_value: number; tags: Record<string, string> }>;
  lastHeartbeat: string | null;
};

export function useObservabilityLive() {
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState<LiveData>({
    serviceHealth: [], activeIncidents: [], infraSnapshot: [],
    queueStatus: [], liveMetrics: [], lastHeartbeat: null
  });
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) return;
    try {
      const es = new EventSource("/api/observability/live");
      esRef.current = es;
      es.onopen = () => setConnected(true);

      es.addEventListener("service_health", (e) => {
        setData((prev) => ({ ...prev, serviceHealth: JSON.parse(e.data) }));
      });
      es.addEventListener("active_incidents", (e) => {
        setData((prev) => ({ ...prev, activeIncidents: JSON.parse(e.data) }));
      });
      es.addEventListener("infra_snapshot", (e) => {
        setData((prev) => ({ ...prev, infraSnapshot: JSON.parse(e.data) }));
      });
      es.addEventListener("queue_status", (e) => {
        setData((prev) => ({ ...prev, queueStatus: JSON.parse(e.data) }));
      });
      es.addEventListener("live_metrics", (e) => {
        setData((prev) => ({ ...prev, liveMetrics: JSON.parse(e.data) }));
      });
      es.addEventListener("heartbeat", (e) => {
        setData((prev) => ({ ...prev, lastHeartbeat: JSON.parse(e.data).timestamp }));
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        setTimeout(connect, 5000);
      };
    } catch { setConnected(false); }
  }, []);

  const disconnect = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; setConnected(false); }
  }, []);

  useEffect(() => () => { if (esRef.current) esRef.current.close(); }, []);

  return { connected, data, connect, disconnect };
}
