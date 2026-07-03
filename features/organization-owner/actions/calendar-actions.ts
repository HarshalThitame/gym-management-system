"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess, hasFeatureAccess } from "@/features/entitlement";
import type { Database } from "@/types/database";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent as deleteGoogleCalendarProviderEvent,
  exchangeGoogleCodeForTokens,
  getGoogleCalendarAuthUrl,
  type CalendarIntegrationRow,
  testGoogleCalendarConnection,
  updateGoogleCalendarEvent,
  upsertGoogleCalendarTokens,
} from "@/features/integrations/services/google-calendar-service";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CalendarIntegration = {
  id: string;
  organization_id: string;
  provider: string;
  connected_by: string | null;
  calendar_id: string | null;
  sync_enabled: boolean;
  sync_classes: boolean;
  sync_pt_sessions: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarSyncLog = {
  id: string;
  organization_id: string;
  integration_id: string | null;
  event_type: "create" | "update" | "delete" | "sync_error";
  class_session_id: string | null;
  external_event_id: string | null;
  status: "success" | "failed" | "pending";
  error_message: string | null;
  created_at: string;
};

export type TrainerCalendarConnection = {
  id: string;
  trainer_id: string;
  organization_id: string;
  provider: string;
  calendar_id: string | null;
  sync_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type CalendarConfigInput = {
  calendarId?: string;
  syncEnabled?: boolean;
  syncClasses?: boolean;
  syncPtSessions?: boolean;
};

type SyncLogFilters = {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

type CalendarDb = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type CalendarIntegrationInsert = Database["public"]["Tables"]["calendar_integrations"]["Insert"];
type CalendarIntegrationUpdate = Database["public"]["Tables"]["calendar_integrations"]["Update"];

async function createCalendarDb(): Promise<CalendarDb> {
  return createSupabaseServerClient();
}

// ─── Integration management ─────────────────────────────────────────────────

export async function getCalendarIntegration(
  organizationId: string,
): Promise<CalendarIntegration | null> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.get_integration",
  });

  const supabase = await createCalendarDb();
  const { data, error } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as CalendarIntegration | null;
}

export async function saveCalendarConfig(
  organizationId: string,
  data: CalendarConfigInput,
): Promise<CalendarIntegration> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.save_config",
  });

  const supabase = await createCalendarDb();
  const { data: existing } = await supabase
    .from("calendar_integrations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (existing) {
    const update: CalendarIntegrationUpdate = { updated_at: new Date().toISOString() };
    if (data.calendarId !== undefined) update.calendar_id = data.calendarId;
    if (data.syncEnabled !== undefined) update.sync_enabled = data.syncEnabled;
    if (data.syncClasses !== undefined) update.sync_classes = data.syncClasses;
    if (data.syncPtSessions !== undefined) update.sync_pt_sessions = data.syncPtSessions;

    const { data: updated, error } = await supabase
      .from("calendar_integrations")
      .update(update)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return updated as CalendarIntegration;
  }

  const insert: CalendarIntegrationInsert = {
    organization_id: organizationId,
    provider: "google",
    sync_enabled: data.syncEnabled ?? false,
    sync_classes: data.syncClasses ?? true,
    sync_pt_sessions: data.syncPtSessions ?? false,
    calendar_id: data.calendarId ?? null,
  };

  const { data: created, error } = await supabase
    .from("calendar_integrations")
    .insert(insert)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return created as CalendarIntegration;
}

export async function disconnectCalendar(organizationId: string): Promise<void> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.disconnect",
  });

  const supabase = await createCalendarDb();
  const { data: existing } = await supabase
    .from("calendar_integrations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (!existing) return;

  await supabase
    .from("calendar_integrations")
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      sync_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
}

// ─── Sync operations ────────────────────────────────────────────────────────

type ClassSessionForSync = {
  id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  classes: { name: string } | { name: string }[];
  primary_trainer_id: string | null;
};

const DEFAULT_CALENDAR_TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE?.trim() || "Asia/Kolkata";

function getClassName(classes: ClassSessionForSync["classes"]) {
  return Array.isArray(classes) ? classes[0]?.name ?? "Class Session" : classes?.name ?? "Class Session";
}

function buildCalendarDateTime(sessionDate: string, time: string) {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return `${sessionDate}T${normalized}`;
}

function buildCalendarEventInput(session: ClassSessionForSync) {
  const className = getClassName(session.classes);
  return {
    summary: className,
    description: session.notes ?? `${className} session synced from gym operations.`,
    location: session.location ?? undefined,
    start: buildCalendarDateTime(session.session_date, session.starts_at),
    end: buildCalendarDateTime(session.session_date, session.ends_at),
    timeZone: DEFAULT_CALENDAR_TIMEZONE,
  };
}

async function getLatestExternalEventId(
  supabase: CalendarDb,
  classSessionId: string,
) {
  const { data, error } = await supabase
    .from("calendar_sync_logs")
    .select("external_event_id")
    .eq("class_session_id", classSessionId)
    .in("event_type", ["create", "update"])
    .eq("status", "success")
    .not("external_event_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.external_event_id as string | null | undefined) ?? null;
}

export async function syncClassSessionToCalendar(
  organizationId: string,
  classSessionId: string,
): Promise<{ synced: boolean; externalEventId?: string }> {
  const hasAccess = await hasFeatureAccess(organizationId, "google_calendar_sync");
  if (!hasAccess) return { synced: false };

  const supabase = await createCalendarDb();

  const [integrationRes, sessionRes] = await Promise.all([
    supabase
      .from("calendar_integrations")
      .select("id, calendar_id, sync_enabled, sync_classes")
      .eq("organization_id", organizationId)
      .eq("provider", "google")
      .maybeSingle(),
    supabase
      .from("class_sessions")
      .select("id, session_date, starts_at, ends_at, location, notes, classes!inner(name), primary_trainer_id")
      .eq("id", classSessionId)
      .single(),
  ]);

  const integration = integrationRes.data as { id: string; calendar_id: string | null; sync_enabled: boolean; sync_classes: boolean } | null;

  if (!integration || !integration.sync_enabled || !integration.sync_classes) {
    return { synced: false };
  }

  const session = sessionRes.data as ClassSessionForSync | null;
  if (!session || sessionRes.error) {
    return { synced: false };
  }

  try {
    const existingEventId = await getLatestExternalEventId(supabase, classSessionId);
    const eventInput = buildCalendarEventInput(session);
    const event = existingEventId
      ? await updateGoogleCalendarEvent(integration as CalendarIntegrationRow, existingEventId, eventInput)
      : await createGoogleCalendarEvent(integration as CalendarIntegrationRow, eventInput);

    await supabase.from("calendar_sync_logs").insert({
      organization_id: organizationId,
      integration_id: integration.id,
      event_type: existingEventId ? "update" : "create",
      class_session_id: classSessionId,
      external_event_id: event.id,
      status: "success",
    });

    // Update last_synced_at
    await supabase
      .from("calendar_integrations")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", integration.id);

    return { synced: true, externalEventId: event.id };
  } catch (err) {
    await supabase.from("calendar_sync_logs").insert({
      organization_id: organizationId,
      integration_id: integration.id,
      event_type: "sync_error",
      class_session_id: classSessionId,
      status: "failed",
      error_message: err instanceof Error ? err.message : "Calendar sync failed",
    });
    return { synced: false };
  }
}

export async function deleteCalendarEvent(
  organizationId: string,
  classSessionId: string,
): Promise<{ deleted: boolean }> {
  const hasAccess = await hasFeatureAccess(organizationId, "google_calendar_sync");
  if (!hasAccess) return { deleted: false };

  const supabase = await createCalendarDb();

  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("id, sync_enabled")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (!integration?.sync_enabled) return { deleted: false };

  const integrationRow = integration as { id: string; sync_enabled: boolean };

  try {
    const fullIntegration = await getCalendarIntegration(organizationId);
    const externalEventId = await getLatestExternalEventId(supabase, classSessionId);
    if (!fullIntegration || !externalEventId) {
      return { deleted: false };
    }

    await deleteGoogleCalendarProviderEvent(fullIntegration as unknown as CalendarIntegrationRow, externalEventId);

    await supabase.from("calendar_sync_logs").insert({
      organization_id: organizationId,
      integration_id: integrationRow.id,
      event_type: "delete",
      class_session_id: classSessionId,
      external_event_id: externalEventId,
      status: "success",
    });

    return { deleted: true };
  } catch (err) {
    await supabase.from("calendar_sync_logs").insert({
      organization_id: organizationId,
      integration_id: integrationRow.id,
      event_type: "sync_error",
      class_session_id: classSessionId,
      status: "failed",
      error_message: err instanceof Error ? err.message : "Calendar delete failed",
    });
    return { deleted: false };
  }
}

export async function syncAllUpcomingClasses(
  organizationId: string,
): Promise<{ synced: number; failed: number; errors: string[] }> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.sync_all",
  });

  const supabase = await createCalendarDb();

  const [integrationRes, sessionsRes] = await Promise.all([
    supabase
      .from("calendar_integrations")
      .select("id, calendar_id, sync_enabled, sync_classes")
      .eq("organization_id", organizationId)
      .eq("provider", "google")
      .maybeSingle(),
    supabase
      .from("class_sessions")
      .select("id, session_date, starts_at, ends_at, location, notes, classes!inner(name), primary_trainer_id")
      .gte("session_date", new Date().toISOString().split("T")[0])
      .in("status", ["scheduled"])
      .order("session_date", { ascending: true }),
  ]);

  const integration = integrationRes.data as { id: string; calendar_id: string | null; sync_enabled: boolean; sync_classes: boolean } | null;

  if (!integration || !integration.sync_enabled || !integration.sync_classes) {
    return { synced: 0, failed: 0, errors: ["Integration not active"] };
  }

  const sessions = (sessionsRes.data ?? []) as ClassSessionForSync[];
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const session of sessions) {
    try {
      const existingEventId = await getLatestExternalEventId(supabase, session.id);
      const eventInput = buildCalendarEventInput(session);
      const event = existingEventId
        ? await updateGoogleCalendarEvent(integration as CalendarIntegrationRow, existingEventId, eventInput)
        : await createGoogleCalendarEvent(integration as CalendarIntegrationRow, eventInput);

      await supabase.from("calendar_sync_logs").insert({
        organization_id: organizationId,
        integration_id: integration.id,
        event_type: existingEventId ? "update" : "create",
        class_session_id: session.id,
        external_event_id: event.id,
        status: "success",
      });
      synced++;
    } catch (err) {
      failed++;
      errors.push(
        `Session ${session.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }

  await supabase
    .from("calendar_integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", integration.id);

  return { synced, failed, errors };
}

// ─── Sync logs ──────────────────────────────────────────────────────────────

export async function getSyncLogs(
  organizationId: string,
  filters?: SyncLogFilters,
): Promise<{ logs: CalendarSyncLog[]; total: number }> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.get_logs",
  });

  const supabase = await createCalendarDb();
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters?.pageSize ?? 20));

  let query = supabase
    .from("calendar_sync_logs")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return { logs: (data ?? []) as CalendarSyncLog[], total: count ?? 0 };
}

// ─── OAuth helpers (stubbed for when Google credentials are available) ──────

export async function getGoogleAuthUrl(
  organizationId: string,
): Promise<string> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.get_auth_url",
  });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be signed in to connect Google Calendar.");
  }

  return getGoogleCalendarAuthUrl({ organizationId, userId: user.id });
}

export async function handleGoogleCallback(
  organizationId: string,
  code: string,
): Promise<CalendarIntegration> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.handle_callback",
  });

  const existing = await getCalendarIntegration(organizationId);
  const authSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  const tokens = await exchangeGoogleCodeForTokens(code);
  const record = await upsertGoogleCalendarTokens({
    organizationId,
    userId: user?.id ?? existing?.connected_by ?? "organization-owner",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresInSeconds: tokens.expires_in,
  });

  const verified = record as CalendarIntegrationRow;
  await testGoogleCalendarConnection(verified);
  return record as unknown as CalendarIntegration;
}

// ─── Trainer calendar connections ───────────────────────────────────────────

export async function getTrainerCalendarConnections(
  organizationId: string,
): Promise<TrainerCalendarConnection[]> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.get_trainer_connections",
  });

  const supabase = await createCalendarDb();
  const { data, error } = await supabase
    .from("trainer_calendar_connections")
    .select("*")
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
  return (data ?? []) as TrainerCalendarConnection[];
}

export async function connectTrainerCalendar(
  organizationId: string,
  trainerId: string,
): Promise<TrainerCalendarConnection> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.connect_trainer",
  });

  const supabase = await createCalendarDb();
  const { data: existing } = await supabase
    .from("trainer_calendar_connections")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("provider", "google")
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("trainer_calendar_connections")
      .update({
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return updated as TrainerCalendarConnection;
  }

  const { data: created, error } = await supabase
    .from("trainer_calendar_connections")
    .insert({
      trainer_id: trainerId,
      organization_id: organizationId,
      provider: "google",
      sync_enabled: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return created as TrainerCalendarConnection;
}

export async function disconnectTrainerCalendar(
  organizationId: string,
  trainerId: string,
): Promise<void> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.disconnect_trainer",
  });

  const supabase = await createCalendarDb();
  await supabase
    .from("trainer_calendar_connections")
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      sync_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("trainer_id", trainerId)
    .eq("organization_id", organizationId);
}
