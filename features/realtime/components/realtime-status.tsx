"use client";

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RealtimeStatusProps = {
  isConnected: boolean;
  isConnecting?: boolean;
  className?: string;
};

/**
 * Visual indicator for real-time connection status
 */
export function RealtimeStatus({ isConnected, isConnecting = false, className }: RealtimeStatusProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        isConnected
          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          : isConnecting
          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
        className
      )}
    >
      {isConnecting ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isConnected ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      <span>
        {isConnecting ? "Connecting..." : isConnected ? "Live" : "Disconnected"}
      </span>
    </div>
  );
}
