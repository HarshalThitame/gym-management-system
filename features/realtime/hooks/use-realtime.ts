"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel, RealtimeEventType, RealtimeEvent } from "../services/realtime-service";

type UseRealtimeOptions = {
  channel: RealtimeChannel;
  eventType?: RealtimeEventType;
  enabled?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
};

type UseRealtimeReturn = {
  events: RealtimeEvent[];
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
};

/**
 * Hook for consuming real-time events via Server-Sent Events (SSE)
 */
export function useRealtime(options: UseRealtimeOptions): UseRealtimeReturn {
  const { channel, eventType, enabled = true, onEvent } = options;
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);

  // Keep onEvent ref up to date
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build SSE URL
    const params = new URLSearchParams({
      channel,
      ...(eventType && { event_type: eventType }),
    });

    const eventSource = new EventSource(`/api/realtime/stream?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeEvent;
        setEvents((prev) => [data, ...prev].slice(0, 100)); // Keep last 100 events
        onEventRef.current?.(data);
      } catch (err) {
        console.error("[Realtime] Failed to parse event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[Realtime] SSE error:", err);
      setIsConnected(false);
      setError(new Error("Connection lost"));
      eventSource.close();

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [channel, eventType, enabled]);

  const reconnect = useCallback(() => {
    setEvents([]);
    setError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return {
    events,
    isConnected,
    error,
    reconnect,
  };
}

/**
 * Hook for listening to attendance events
 */
export function useAttendanceRealtime(onCheckIn?: (event: RealtimeEvent) => void) {
  return useRealtime({
    channel: "attendance",
    onEvent: onCheckIn,
  });
}

/**
 * Hook for listening to payment events
 */
export function usePaymentRealtime(onPayment?: (event: RealtimeEvent) => void) {
  return useRealtime({
    channel: "payments",
    onEvent: onPayment,
  });
}

/**
 * Hook for listening to notification events
 */
export function useNotificationRealtime(onNotification?: (event: RealtimeEvent) => void) {
  return useRealtime({
    channel: "notifications",
    onEvent: onNotification,
  });
}

/**
 * Hook for listening to lead events
 */
export function useLeadRealtime(onLeadChange?: (event: RealtimeEvent) => void) {
  return useRealtime({
    channel: "leads",
    onEvent: onLeadChange,
  });
}
