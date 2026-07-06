import type { DeviceHealthSnapshot } from "./device-health";

export type DeviceIncidentSeverity = "info" | "warning" | "critical";

export type DeviceIncidentInput = {
  incidentType:
    | "pending_activation"
    | "heartbeat_stale"
    | "heartbeat_critical"
    | "quarantined"
    | "enrollment_expired"
    | "claim_failed"
    | "branch_mismatch"
    | "ping_failure"
    | "manual_action";
  title: string;
  description?: string | null;
  severity: DeviceIncidentSeverity;
  metadata?: Record<string, unknown>;
};

export function deriveDeviceIncident(snapshot: DeviceHealthSnapshot, overrides?: Partial<DeviceIncidentInput>): DeviceIncidentInput | null {
  if (snapshot.level === "pending") {
    return {
      incidentType: "pending_activation",
      title: "Device pending activation",
      description: "The device is registered but still awaiting enrollment claim activation.",
      severity: "warning",
      ...overrides,
    };
  }

  if (snapshot.level === "quarantined") {
    return {
      incidentType: "quarantined",
      title: "Device quarantined",
      description: "The device was quarantined by an operator and should not accept attendance traffic.",
      severity: "critical",
      ...overrides,
    };
  }

  if (snapshot.level === "stale") {
    return {
      incidentType: "heartbeat_stale",
      title: "Device heartbeat is stale",
      description: "The device has not pinged recently and may be offline or disconnected.",
      severity: "warning",
      ...overrides,
    };
  }

  if (snapshot.level === "critical") {
    return {
      incidentType: "heartbeat_critical",
      title: "Device heartbeat is critical",
      description: "The device has been offline long enough to require operational follow-up.",
      severity: "critical",
      ...overrides,
    };
  }

  return null;
}

export function incidentStatusForSnapshot(snapshot: DeviceHealthSnapshot) {
  if (snapshot.level === "healthy" || snapshot.level === "watch") return "resolved" as const;
  if (snapshot.level === "pending" || snapshot.level === "quarantined" || snapshot.level === "stale" || snapshot.level === "critical") {
    return "open" as const;
  }
  return "resolved" as const;
}
