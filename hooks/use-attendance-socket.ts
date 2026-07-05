"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UseAttendanceSocketOptions = {
  organizationId?: string;
  branchId?: string;
  enabled?: boolean;
  onCheckIn?: (data: Record<string, unknown>) => void;
  onCheckOut?: (data: Record<string, unknown>) => void;
  onOccupancyUpdate?: (data: Record<string, unknown>) => void;
  onAlert?: (data: Record<string, unknown>) => void;
};

type UseAttendanceSocketReturn = {
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
  joinOrganization: (orgId: string) => void;
  joinBranch: (branchId: string) => void;
};

export function useAttendanceSocket(
  options: UseAttendanceSocketOptions = {}
): UseAttendanceSocketReturn {
  const {
    organizationId,
    branchId,
    enabled = true,
    onCheckIn,
    onCheckOut,
    onOccupancyUpdate,
    onAlert,
  } = options;

  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const sessionFetchedRef = useRef(false);

  useEffect(() => {
    if (sessionFetchedRef.current) return;
    sessionFetchedRef.current = true;

    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ? { access_token: s.access_token } : null);
      setIsLoading(false);
    });
  }, []);

  const onCheckInRef = useRef(onCheckIn);
  const onCheckOutRef = useRef(onCheckOut);
  const onOccupancyUpdateRef = useRef(onOccupancyUpdate);
  const onAlertRef = useRef(onAlert);

  useEffect(() => { onCheckInRef.current = onCheckIn; }, [onCheckIn]);
  useEffect(() => { onCheckOutRef.current = onCheckOut; }, [onCheckOut]);
  useEffect(() => { onOccupancyUpdateRef.current = onOccupancyUpdate; }, [onOccupancyUpdate]);
  useEffect(() => { onAlertRef.current = onAlert; }, [onAlert]);

  const connect = useCallback(() => {
    if (!enabled || isLoading) return;

    const accessToken = session?.access_token;
    if (!accessToken) return;

    if (socketRef.current?.connected) return;

    socketRef.current?.close();

    const socket = io({
      path: "/api/socket.io",
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setError(null);

      if (organizationId) socket.emit("join:organization", organizationId);
      if (branchId) socket.emit("join:branch", branchId);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      if (reason === "io server disconnect") {
        setTimeout(() => connect(), 5000);
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
      setError(new Error(err.message));
      setIsConnected(false);
    });

    socket.on("attendance:check_in", (data: Record<string, unknown>) => {
      onCheckInRef.current?.(data);
    });

    socket.on("attendance:check_out", (data: Record<string, unknown>) => {
      onCheckOutRef.current?.(data);
    });

    socket.on("attendance:occupancy_update", (data: Record<string, unknown>) => {
      onOccupancyUpdateRef.current?.(data);
    });

    socket.on("attendance:alert", (data: Record<string, unknown>) => {
      onAlertRef.current?.(data);
    });
  }, [enabled, isLoading, session, organizationId, branchId]);

  const reconnect = useCallback(() => {
    setError(null);
    if (socketRef.current) {
      socketRef.current.close();
    }
    connect();
  }, [connect]);

  const joinOrganization = useCallback((orgId: string) => {
    socketRef.current?.emit("join:organization", orgId);
  }, []);

  const joinBranch = useCallback((branchId: string) => {
    socketRef.current?.emit("join:branch", branchId);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  return {
    isConnected,
    error,
    reconnect,
    joinOrganization,
    joinBranch,
  };
}
