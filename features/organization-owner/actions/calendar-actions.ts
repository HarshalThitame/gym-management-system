"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess, hasFeatureAccess } from "@/features/entitlement";

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

// ─── Integration management ─────────────────────────────────────────────────

export async function getCalendarIntegration(
  organizationId: string,
): Promise<CalendarIntegration | null> {
  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "google_calendar_sync",
    actionName: "calendar.get_integration",
  });

  const supabase = await createSupabaseServerClient();
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

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("calendar_integrations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (existing) {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
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

  const insert: Record<string, unknown> = {
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

  const supabase = await createSupabaseServerClient();
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
  classes: { name: string } | { name: string }[];
  primary_trainer_id: string | null;
};

export async function syncClassSessionToCalendar(
  organizationId: string,
  classSessionId: string,
): Promise<{ synced: boolean; externalEventId?: string }> {
  const hasAccess = await hasFeatureAccess(organizationId, "google_calendar_sync");
  if (!hasAccess) return { synced: false };

  const supabase = await createSupabaseServerClient();

  const [integrationRes, sessionRes] = await Promise.all([
    supabase
      .from("calendar_integrations")
      .select("id, calendar_id, sync_enabled, sync_classes")
      .eq("organization_id", organizationId)
      .eq("provider", "google")
      .maybeSingle(),
    supabase
      .from("class_sessions")
      .select("id, session_date, starts_at, ends_at, classes!inner(name), primary_trainer_id")
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
    // Stubbed: In production, this would call Google Calendar API
    // with class name, time, etc. from the session.
    const externalEventId = `stubbed-${classSessionId}-${Date.now()}`;

    await supabase.from("calendar_sync_logs").insert({
      organization_id: organizationId,
      integration_id: integration.id,
      event_type: "create",
      class_session_id: classSessionId,
      external_event_id: externalEventId,
      status: "success",
    });

    // Update last_synced_at
    await supabase
      .from("calendar_integrations")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", integration.id);

    return { synced: true, externalEventId };
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

  const supabase = await createSupabaseServerClient();

  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("id, sync_enabled")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (!integration?.sync_enabled) return { deleted: false };

  const integrationRow = integration as { id: string; sync_enabled: boolean };

  try {
    // Stubbed: In production, this would call Google Calendar API to delete event
    // const log = await supabase.from("calendar_sync_logs").select("external_event_id")
    //   .eq("class_session_id", classSessionId).eq("event_type", "create").maybeSingle();
    // if (log?.data?.external_event_id) await googleCalendar.events.delete({...});

    await supabase.from("calendar_sync_logs").insert({
      organization_id: organizationId,
      integration_id: integrationRow.id,
      event_type: "delete",
      class_session_id: classSessionId,
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

  const supabase = await createSupabaseServerClient();

  const [integrationRes, sessionsRes] = await Promise.all([
    supabase
      .from("calendar_integrations")
      .select("id, calendar_id, sync_enabled, sync_classes")
      .eq("organization_id", organizationId)
      .eq("provider", "google")
      .maybeSingle(),
    supabase
      .from("class_sessions")
      .select("id, session_date, starts_at, ends_at, classes!inner(name), primary_trainer_id")
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
      // In production, className would be extracted and used for the calendar event title.
      const externalEventId = `stubbed-${session.id}-${Date.now()}`;

      await supabase.from("calendar_sync_logs").insert({
        organization_id: organizationId,
        integration_id: integration.id,
        event_type: "create",
        class_session_id: session.id,
        external_event_id: externalEventId,
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

  const supabase = await createSupabaseServerClient();
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

  // Stubbed: when Google OAuth credentials are configured, build the consent URL
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/calendar/google/callback`;
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=PLACEHOLDER&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent`;
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

  const supabase = await createSupabaseServerClient();

  // Stubbed: exchange code for tokens via Google OAuth2 API
  // const tokens = await exchangeCodeForTokens(code);
  const placeholderTokens = {
    access_token: `placeholder-access-${code.slice(0, 8)}`,
    refresh_token: `placeholder-refresh-${code.slice(0, 8)}`,
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  };

  const { data: existing } = await supabase
    .from("calendar_integrations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("calendar_integrations")
      .update({
        access_token: placeholderTokens.access_token,
        refresh_token: placeholderTokens.refresh_token,
        token_expires_at: placeholderTokens.expires_at,
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return updated as CalendarIntegration;
  }

  const { data: created, error } = await supabase
    .from("calendar_integrations")
    .insert({
      organization_id: organizationId,
      provider: "google",
      access_token: placeholderTokens.access_token,
      refresh_token: placeholderTokens.refresh_token,
      token_expires_at: placeholderTokens.expires_at,
      sync_enabled: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return created as CalendarIntegration;
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

  const supabase = await createSupabaseServerClient();
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

  const supabase = await createSupabaseServerClient();
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

  const supabase = await createSupabaseServerClient();
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
