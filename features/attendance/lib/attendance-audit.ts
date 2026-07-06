import { writeAuditLog } from "@/lib/audit";
import type { Json } from "@/types/database";

export type AttendanceAuditMetadata = Record<string, unknown> & {
  module?: "attendance";
  workflow?: "check_in" | "check_out" | "device" | "geofence" | "reconciliation" | "alert" | "correction" | "membership";
  reasonCode?: string | null;
  decision?: "granted" | "denied" | "warning" | "info";
  source?: string | null;
  branchId?: string | null;
  gymId?: string | null;
  memberId?: string | null;
  membershipId?: string | null;
  sessionId?: string | null;
  deviceId?: string | null;
  qrTokenId?: string | null;
};

export async function writeAttendanceAuditLog(input: {
  actorId: string | null;
  gymId?: string | null;
  branchId?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  workflow: NonNullable<AttendanceAuditMetadata["workflow"]>;
  reasonCode?: string | null;
  source?: string | null;
  decision?: AttendanceAuditMetadata["decision"];
  metadata?: Json;
}) {
  await writeAuditLog({
    actorId: input.actorId,
    gymId: input.gymId ?? null,
    branchId: input.branchId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: {
      module: "attendance",
      workflow: input.workflow,
      reasonCode: input.reasonCode ?? null,
      source: input.source ?? null,
      decision: input.decision ?? "info",
      ...(input.metadata ?? {}),
    } as Json,
  });
}
