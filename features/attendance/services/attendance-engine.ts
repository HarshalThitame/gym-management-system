/**
 * Enterprise Attendance Processing Engine
 * Handles all device types: QR, RFID, NFC, Biometric, Face Recognition, Geo-Fencing
 * Supports offline sync, duplicate prevention, session tracking
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AttendanceInput = {
  organizationId: string;
  gymId: string;
  branchId?: string;
  deviceId?: string;
  memberId: string;
  eventType: "check_in" | "check_out" | "manual" | "qr" | "dynamic_qr" | "rfid" | "nfc" | "biometric" | "face" | "geofence" | "api";
  confidenceScore?: number;
  metadata?: Record<string, unknown>;
};

export type AttendanceResult = {
  ok: boolean;
  eventId?: string | undefined;
  sessionId?: string | undefined;
  error?: string | undefined;
  isDuplicate?: boolean | undefined;
  isLateEntry?: boolean | undefined;
};

// ── Session tracking ──────────────────────────────────────────

/**
 * Finds the current active session for a member today.
 * Prevents duplicate check-ins within the same session.
 */
export async function getActiveSession(organizationId: string, memberId: string) {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          eq(k2: string, v2: string): {
            gte(k3: string, v3: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    };
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data } = await s
    .from("attendance_sessions")
    .select("id, check_in_at, check_out_at")
    .eq("organization_id", organizationId)
    .eq("member_id", memberId)
    .gte("check_in_at", today.toISOString());

  const sessions = (data ?? []) as Array<Record<string, unknown>>;
  return sessions.find((s) => !s.check_out_at) ?? null;
}

// ── Duplicate prevention ─────────────────────────────────────

/**
 * Checks for duplicate attendance events within a time window.
 */
export async function checkDuplicate(
  organizationId: string,
  memberId: string,
  deviceId: string | undefined,
  windowMinutes: number = 1,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          eq(k2: string, v2: string): {
            gte(k3: string, v3: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    };
  };

  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  let query = s
    .from("attendance_events")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("member_id", memberId)
    .gte("created_at", since);

  if (deviceId) {
    query = (query as never as {
      eq(k: string, v: string): { eq(k2: string, v2: string): { eq(k3: string, v3: string): Promise<{ data: Array<Record<string, unknown>> | null }> } }
    }).eq("device_id", deviceId) as never;
  }

  const { data } = await query;
  return (data ?? []).length > 0;
}

// ── Core attendance processing ───────────────────────────────

/**
 * Processes an attendance event from any device type.
 * Handles session tracking, duplicate prevention, and offline sync.
 */
export async function processAttendance(input: AttendanceInput): Promise<AttendanceResult> {
  const supabase = await createSupabaseServerClient();

  // 1. Duplicate check
  const isDuplicate = await checkDuplicate(input.organizationId, input.memberId, input.deviceId);
  if (isDuplicate) {
    return { ok: false, error: "Duplicate attendance event detected within 1-minute window.", isDuplicate: true };
  }

  // 2. Check for active session
  const activeSession = await getActiveSession(input.organizationId, input.memberId);

  // 3. Determine event type based on session state
  const eventType = input.eventType;

  // 4. Record attendance event
  const { data: event, error: eventError } = await (supabase as never as {
    from(t: string): {
      insert(r: Record<string, unknown>): {
        select(c: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
      };
    };
  }).from("attendance_events").insert({
    organization_id: input.organizationId,
    gym_id: input.gymId,
    branch_id: input.branchId ?? null,
    device_id: input.deviceId ?? null,
    member_id: input.memberId,
    event_type: eventType,
    verified: true,
    confidence_score: input.confidenceScore ?? null,
    metadata: input.metadata ?? {},
  }).select("id");

  if (eventError || !event?.[0]) {
    return { ok: false, error: eventError?.message ?? "Failed to record attendance" };
  }

  const eventId = event[0].id as string;

  // 5. Manage session
  let sessionId: string | undefined;

  if (eventType === "check_in" || !activeSession) {
    // Create new session or handle check-in
    const { data: session } = await (supabase as never as {
      from(t: string): {
        insert(r: Record<string, unknown>): {
          select(c: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
        };
      };
    }).from("attendance_sessions").insert({
      organization_id: input.organizationId,
      gym_id: input.gymId,
      branch_id: input.branchId ?? null,
      member_id: input.memberId,
      check_in_at: new Date().toISOString(),
      check_in_method: eventType,
      check_in_device_id: input.deviceId ?? null,
    }).select("id");

    sessionId = (session?.[0]?.id as string) ?? undefined;
  }

  if (eventType === "check_out" && activeSession) {
    // Close active session
    const sessionId = (activeSession as Record<string, unknown>).id as string;
    await (supabase as never as {
      from(t: string): {
        update(r: Record<string, unknown>): {
          eq(k: string, v: string): Promise<{ error: { message: string } | null }>;
        };
      };
    }).from("attendance_sessions").update({
      check_out_at: new Date().toISOString(),
      check_out_method: eventType,
    }).eq("id", sessionId);
  }

  return {
    ok: true,
    eventId,
    sessionId,
    isDuplicate: false,
  };
}

// ── QR-specific processing ───────────────────────────────────

/**
 * Validates a QR code attendance attempt.
 * Supports static QR, dynamic QR, and rotating QR codes.
 */
export async function processQRAttendance(
  input: AttendanceInput & { qrCode: string; isDynamic?: boolean },
): Promise<AttendanceResult> {
  const supabase = await createSupabaseServerClient();

  // For dynamic QR, validate the code is still valid
  if (input.isDynamic) {
    const { data: qrRecord } = await (supabase as never as {
      from(t: string): {
        select(c: string): {
          eq(k: string, v: string): {
            eq(k2: string, v2: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    }).from("attendance_sessions").select("id, expires_at").eq("organization_id", input.organizationId).eq("qr_code", input.qrCode);

    const qr = (qrRecord ?? [])[0] as Record<string, unknown> | undefined;
    if (!qr) return { ok: false, error: "Invalid QR code." };

    const expiresAt = qr.expires_at as string | undefined;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      return { ok: false, error: "QR code has expired." };
    }
  }

  return processAttendance(input);
}

// ── RFID/NFC-specific processing ─────────────────────────────

/**
 * Processes RFID/NFC card attendance.
 * Validates card assignment and detects duplicates.
 */
export async function processCardAttendance(
  input: AttendanceInput & { cardId: string; cardType: "rfid" | "nfc" },
): Promise<AttendanceResult> {
  const supabase = await createSupabaseServerClient();

  // Verify card is assigned to the member
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };
  const { data: card } = await s.from("members").select("id, rfid_tag, nfc_tag").eq("id", input.memberId);

  const member = (card ?? [])[0] as Record<string, unknown> | undefined;
  if (!member) return { ok: false, error: "Member not found." };

  const cardField = input.cardType === "rfid" ? "rfid_tag" : "nfc_tag";
  if (member[cardField] !== input.cardId) {
    return { ok: false, error: `Card ${input.cardId} is not assigned to this member.` };
  }

  return processAttendance(input);
}

// ── Offline sync ─────────────────────────────────────────────

/**
 * Processes queued attendance events from offline devices.
 */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  const supabase = await createSupabaseServerClient();
  const s = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(k: string, v: string): {
          limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
      update(r: Record<string, unknown>): {
        eq(k: string, v: string): Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { data: queue } = await s.from("attendance_sync_queue").select("id, payload").eq("status", "pending").limit(50);

  let synced = 0;
  let failed = 0;

  for (const item of (queue ?? [])) {
    try {
      const payload = item.payload as Record<string, unknown>;
      const result = await processAttendance(payload as never as AttendanceInput);

      if (result.ok) {
        await s.from("attendance_sync_queue").update({
          status: "synced",
          synced_at: new Date().toISOString(),
        }).eq("id", item.id as string);
        synced++;
      } else {
        await s.from("attendance_sync_queue").update({
          status: "failed",
          error_message: result.error,
        }).eq("id", item.id as string);
        failed++;
      }
    } catch {
      await s.from("attendance_sync_queue").update({
        status: "failed",
        error_message: "Processing error",
      }).eq("id", item.id as string);
      failed++;
    }
  }

  return { synced, failed };
}
