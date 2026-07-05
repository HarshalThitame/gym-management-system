export type DeviceHealthLevel = "healthy" | "watch" | "stale" | "critical" | "decommissioned" | "unknown";

export type DeviceHealthSnapshot = {
  level: DeviceHealthLevel;
  label: string;
  minutesSinceSeen: number | null;
  isStale: boolean;
};

const HEALTH_THRESHOLDS = {
  healthyMinutes: 5,
  watchMinutes: 30,
  staleMinutes: 120,
} as const;

export function getDeviceHealthSnapshot(device: Record<string, unknown>, now = new Date()): DeviceHealthSnapshot {
  const status = String(device.status ?? "offline");
  const lastSeenAt = asDate(device.last_seen_at);

  if (status === "decommissioned") {
    return {
      level: "decommissioned",
      label: "Decommissioned",
      minutesSinceSeen: null,
      isStale: false,
    };
  }

  if (status === "error") {
    return {
      level: "critical",
      label: "Critical",
      minutesSinceSeen: minutesSince(lastSeenAt, now),
      isStale: true,
    };
  }

  if (!lastSeenAt) {
    return {
      level: status === "online" ? "watch" : "unknown",
      label: status === "online" ? "Needs ping" : "Unknown",
      minutesSinceSeen: null,
      isStale: status === "online",
    };
  }

  const minutes = minutesSince(lastSeenAt, now);
  if (minutes <= HEALTH_THRESHOLDS.healthyMinutes) {
    return { level: "healthy", label: "Healthy", minutesSinceSeen: minutes, isStale: false };
  }
  if (minutes <= HEALTH_THRESHOLDS.watchMinutes) {
    return { level: "watch", label: "Watch", minutesSinceSeen: minutes, isStale: false };
  }
  if (minutes <= HEALTH_THRESHOLDS.staleMinutes) {
    return { level: "stale", label: "Stale", minutesSinceSeen: minutes, isStale: true };
  }
  return { level: "critical", label: "Critical", minutesSinceSeen: minutes, isStale: true };
}

export function getDeviceHealthSummary(devices: Record<string, unknown>[], now = new Date()) {
  const snapshots = devices.map((device) => getDeviceHealthSnapshot(device, now));

  return {
    healthy: snapshots.filter((snapshot) => snapshot.level === "healthy").length,
    watch: snapshots.filter((snapshot) => snapshot.level === "watch").length,
    stale: snapshots.filter((snapshot) => snapshot.level === "stale").length,
    critical: snapshots.filter((snapshot) => snapshot.level === "critical").length,
    decommissioned: snapshots.filter((snapshot) => snapshot.level === "decommissioned").length,
    unknown: snapshots.filter((snapshot) => snapshot.level === "unknown").length,
    totalMonitored: snapshots.filter((snapshot) => snapshot.level !== "decommissioned").length,
  };
}

export function formatDeviceFreshness(snapshot: DeviceHealthSnapshot) {
  if (snapshot.minutesSinceSeen === null) {
    return snapshot.label;
  }

  if (snapshot.minutesSinceSeen < 1) {
    return "Seen just now";
  }

  if (snapshot.minutesSinceSeen < 60) {
    return `Seen ${Math.max(1, Math.round(snapshot.minutesSinceSeen))}m ago`;
  }

  const hours = Math.floor(snapshot.minutesSinceSeen / 60);
  if (hours < 24) {
    return `Seen ${hours}h ago`;
  }

  return `Seen ${Math.floor(hours / 24)}d ago`;
}

function asDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minutesSince(from: Date | null, to: Date) {
  if (!from) return Number.POSITIVE_INFINITY;
  return (to.getTime() - from.getTime()) / 60000;
}
