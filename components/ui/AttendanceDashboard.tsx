"use client";

import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Download, Loader2, Power, PowerOff, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Device = {
  id: string;
  device_name: string;
  device_type: { code: string; name: string };
  status: string;
  last_seen_at: string | null;
  location: string | null;
  firmware_version: string | null;
};

type HealthLog = {
  status: string;
  battery_level: number | null;
  signal_strength: number | null;
  checked_at: string;
};

type AttendanceEvent = {
  id: string;
  event_type: string;
  member: { full_name: string } | null;
  created_at: string;
};

export function AttendanceDeviceGrid({ devices }: { devices: Device[] }) {
  const online = devices.filter((d) => d.status === "active" || d.status === "online");
  const offline = devices.filter((d) => d.status === "offline");
  const error = devices.filter((d) => d.status === "error");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard title="Online" count={online.length} color="green" icon={<Wifi className="size-5" />} />
        <StatusCard title="Offline" count={offline.length} color="red" icon={<WifiOff className="size-5" />} />
        <StatusCard title="Errors" count={error.length} color="amber" icon={<AlertTriangle className="size-5" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {devices.map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
        {devices.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
            <Cpu className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold text-muted-foreground">No devices registered</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ title, count, color, icon }: { title: string; count: number; color: string; icon: React.ReactNode }) {
  const colors: Record<string, string> = {
    green: "border-green-200 bg-green-50 text-green-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] ?? ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider">{title}</p>
          <p className="mt-1 text-3xl font-black">{count}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function DeviceCard({ device }: { device: Device }) {
  const statusColor = device.status === "active" || device.status === "online"
    ? "text-green-600 bg-green-50 border-green-200"
    : device.status === "offline"
    ? "text-red-600 bg-red-50 border-red-200"
    : "text-amber-600 bg-amber-50 border-amber-200";

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold">{device.device_name}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
              {device.status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{device.device_type?.name ?? "Unknown"}</p>
        </div>
        {device.status === "active" || device.status === "online" ? (
          <Power className="size-5 text-green-500" />
        ) : (
          <PowerOff className="size-5 text-red-400" />
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {device.location && (
          <div>
            <span className="text-muted-foreground">Location:</span>
            <span className="ml-1 font-semibold">{device.location}</span>
          </div>
        )}
        {device.firmware_version && (
          <div>
            <span className="text-muted-foreground">Firmware:</span>
            <span className="ml-1 font-semibold">{device.firmware_version}</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Last seen:</span>
          <span className="ml-1 font-semibold">{device.last_seen_at ? new Date(device.last_seen_at).toLocaleDateString() : "Never"}</span>
        </div>
      </div>
    </div>
  );
}

export function RecentAttendanceFeed({ events }: { events: AttendanceEvent[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-black">Recent Attendance</h3>
      </div>
      <div className="divide-y divide-border">
        {events.slice(0, 10).map((event) => (
          <div key={event.id} className="flex items-center gap-3 px-6 py-3">
            <Activity className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{event.member?.full_name ?? "Unknown"}</p>
              <p className="text-xs text-muted-foreground capitalize">{event.event_type.replace(/_/g, " ")}</p>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleTimeString()}</p>
          </div>
        ))}
        {events.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No recent attendance events</p>
        )}
      </div>
    </div>
  );
}

export function AttendanceTrendChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="mb-4 font-black">Attendance Trend (Last 7 Days)</h3>
      <div className="flex items-end gap-2" style={{ height: "120px" }}>
        {data.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground">{d.count}</span>
            <div
              className="w-full rounded-t bg-accent transition-all"
              style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
            />
            <span className="text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
