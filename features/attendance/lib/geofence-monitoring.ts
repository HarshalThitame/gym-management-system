import { createAdminClient } from "@/lib/supabase/admin";
import { getGeofenceRadiusMeters, isGeofenceEnabled } from "./geofence";

export type GeofenceMonitoringScope = {
  gymIds: string[];
  gymId?: string | null;
  branchId?: string | null;
  hours?: number;
  staleMinutes?: number;
};

export type GeofenceMonitoringBranchSummary = {
  branchId: string;
  branchName: string | null;
  gymId: string | null;
  geofenceEnabled: boolean;
  coordinatesConfigured: boolean;
  radiusMeters: number;
  activeSessions: number;
  staleSessions: number;
  recentExits: number;
  pendingReports: number;
  lowConfidenceReports: number;
  recentAutoCheckouts: number;
  lastLocationAt: string | null;
  status: "healthy" | "watch" | "critical";
  note: string;
};

export type GeofenceMonitoringEvent = {
  id: string;
  type: "geo_fence_exit" | "auto_checkout";
  memberId: string;
  memberName: string;
  memberCode: string | null;
  sessionId: string | null;
  branchId: string | null;
  branchName: string | null;
  occurredAt: string;
  distanceMeters: number | null;
  radiusMeters: number | null;
};

export type GeofenceMonitoringPendingSample = {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string | null;
  sessionId: string | null;
  branchId: string | null;
  branchName: string | null;
  occurredAt: string;
  distanceMeters: number | null;
  radiusMeters: number | null;
  reasonCode: "outside_pending" | "low_accuracy";
};

export type GeofenceMonitoringStaleSession = {
  sessionId: string;
  memberId: string;
  memberName: string;
  memberCode: string | null;
  branchId: string | null;
  branchName: string | null;
  lastLocationAt: string | null;
  minutesSinceLastLocation: number | null;
};

export type GeofenceMonitoringData = {
  totals: {
    branchesMonitored: number;
    branchesConfigured: number;
    branchesMissingCoordinates: number;
    branchesDisabled: number;
    activeTrackedSessions: number;
    staleTrackedSessions: number;
    recentExits: number;
    recentPendingReports: number;
    recentLowConfidenceReports: number;
    recentAutoCheckouts: number;
  };
  branches: GeofenceMonitoringBranchSummary[];
  recentEvents: GeofenceMonitoringEvent[];
  pendingSamples: GeofenceMonitoringPendingSample[];
  staleSessions: GeofenceMonitoringStaleSession[];
};

type BranchRow = {
  id: string;
  name: string | null;
  gym_id: string | null;
  latitude: number | null;
  longitude: number | null;
};

type BranchSettingRow = {
  branch_id: string;
  attendance_settings: unknown;
};

type SessionRow = {
  id: string;
  member_id: string;
  branch_id: string | null;
  gym_id: string | null;
  check_in_at: string;
  check_out_at: string | null;
  check_out_source: string | null;
  members?: {
    full_name: string | null;
    member_code: string | null;
  } | null;
};

type LocationEventRow = {
  id: string;
  member_id: string;
  branch_id: string | null;
  attendance_session_id: string | null;
  latitude: number;
  longitude: number;
  inside_geofence: boolean;
  geofence_radius_m: number | null;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

export async function getGeofenceMonitoringAnalyticsV1(input: GeofenceMonitoringScope): Promise<GeofenceMonitoringData> {
  const supabase = createAdminClient();
  const hours = clamp(input.hours ?? 24, 1, 168);
  const staleMinutes = clamp(input.staleMinutes ?? 30, 5, 180);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

  const branches = await loadBranches(supabase, input);
  if (branches.length === 0) {
    return emptyGeofenceMonitoringData();
  }

  const branchIds = branches.map((branch) => branch.id);
  const [settingsRows, activeSessions, locationEvents, autoCheckoutSessions] = await Promise.all([
    loadBranchSettings(supabase, branchIds),
    loadActiveSessions(supabase, input, branchIds),
    loadLocationEvents(supabase, input, branchIds, since),
    loadAutoCheckoutSessions(supabase, input, branchIds, since)
  ]);

  const memberIds = uniqueIds([
    ...activeSessions.map((session) => session.member_id),
    ...locationEvents.map((event) => event.member_id),
    ...autoCheckoutSessions.map((session) => session.member_id)
  ]);
  const membersById = await loadMembersById(supabase, memberIds);

  const branchSettings = new Map(settingsRows.map((row) => [row.branch_id, row]));
  const sessionsByBranch = groupBy(activeSessions, (session) => session.branch_id ?? "");
  const eventsByBranch = groupBy(locationEvents, (event) => event.branch_id ?? "");
  const autoCheckoutByBranch = groupBy(autoCheckoutSessions, (session) => session.branch_id ?? "");
  const latestEventBySession = latestBy(locationEvents, (event) => event.attendance_session_id ?? `${event.member_id}-${event.branch_id ?? ""}`);
  const latestEventByMember = latestBy(locationEvents, (event) => event.member_id);
  const pendingLocationEvents = locationEvents.filter((event) => isPendingGeofenceEvent(event));

  const branchesData = branches.map((branch) => {
    const settings = branchSettings.get(branch.id)?.attendance_settings ?? {};
    const coordinatesConfigured = branch.latitude !== null && branch.longitude !== null;
    const geofenceEnabled = isGeofenceEnabled(settings) && coordinatesConfigured;
    const radiusMeters = getGeofenceRadiusMeters(settings);
    const branchSessions = sessionsByBranch.get(branch.id) ?? [];
    const branchEvents = eventsByBranch.get(branch.id) ?? [];
    const branchAutoCheckouts = autoCheckoutByBranch.get(branch.id) ?? [];
    const branchRecentExits = branchEvents.filter((event) => event.inside_geofence === false);
    const branchPendingReports = branchEvents.filter((event) => isPendingGeofenceEvent(event));
    const branchLowConfidenceReports = branchEvents.filter((event) => isLowConfidenceGeofenceEvent(event));

    const staleSessions = branchSessions.filter((session) => {
      const latestEvent = latestEventBySession.get(session.id) ?? latestEventByMember.get(session.member_id) ?? null;
      const lastSeenAt = latestEvent?.occurred_at ?? session.check_in_at;
      return new Date(lastSeenAt).getTime() < new Date(staleCutoff).getTime();
    });

    const lastLocationAt = branchEvents[0]?.occurred_at ?? branchSessions[0]?.check_in_at ?? null;
    const note = !coordinatesConfigured
      ? "Branch coordinates are missing."
      : !geofenceEnabled
        ? "Checkout geofence is disabled."
        : branchLowConfidenceReports.length > 0
          ? `${branchLowConfidenceReports.length} low-confidence sample${branchLowConfidenceReports.length === 1 ? "" : "s"} need attention.`
          : branchPendingReports.length > 0
            ? `${branchPendingReports.length} pending sample${branchPendingReports.length === 1 ? "" : "s"} before auto-checkout.`
            : staleSessions.length > 0
              ? `${staleSessions.length} tracker${staleSessions.length === 1 ? "" : "s"} need attention.`
              : branchRecentExits.length > 0
                ? `${branchRecentExits.length} exit event${branchRecentExits.length === 1 ? "" : "s"} in the selected window.`
                : "Geofence tracking healthy.";

    const status: GeofenceMonitoringBranchSummary["status"] = !coordinatesConfigured
      ? "critical"
      : !geofenceEnabled || staleSessions.length > 0 || branchLowConfidenceReports.length > 0 || branchRecentExits.length > 0
        ? "watch"
        : "healthy";

    return {
      branchId: branch.id,
      branchName: branch.name,
      gymId: branch.gym_id,
      geofenceEnabled,
      coordinatesConfigured,
      radiusMeters,
      activeSessions: branchSessions.length,
      staleSessions: staleSessions.length,
      recentExits: branchRecentExits.length,
      pendingReports: branchPendingReports.length,
      lowConfidenceReports: branchLowConfidenceReports.length,
      recentAutoCheckouts: branchAutoCheckouts.length,
      lastLocationAt,
      status,
      note
    };
  });

  const recentEvents = [
    ...locationEvents
      .filter((event) => event.inside_geofence === false)
      .map((event) => toEventRow("geo_fence_exit", event, membersById, branches)),
    ...autoCheckoutSessions.map((session) => toAutoCheckoutEvent(session, membersById, branches))
  ]
    .filter((event): event is GeofenceMonitoringEvent => Boolean(event))
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 20);

  const pendingSamples = pendingLocationEvents
    .map((event) => toPendingSample(event, membersById, branches))
    .filter((event): event is GeofenceMonitoringPendingSample => Boolean(event))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 20);

  const staleSessions = branchesData.flatMap((branch) => {
    const branchSessions = sessionsByBranch.get(branch.branchId) ?? [];
    return branchSessions
      .map((session) => {
        const latestEvent = latestEventBySession.get(session.id) ?? latestEventByMember.get(session.member_id) ?? null;
        const lastSeenAt = latestEvent?.occurred_at ?? session.check_in_at;
        if (new Date(lastSeenAt).getTime() >= new Date(staleCutoff).getTime()) {
          return null;
        }

        const member = membersById.get(session.member_id);
        return {
          sessionId: session.id,
          memberId: session.member_id,
          memberName: member?.full_name ?? session.members?.full_name ?? "Member",
          memberCode: member?.member_code ?? session.members?.member_code ?? null,
          branchId: branch.branchId,
          branchName: branch.branchName,
          lastLocationAt: latestEvent?.occurred_at ?? null,
          minutesSinceLastLocation: Math.max(0, Math.round((Date.now() - new Date(lastSeenAt).getTime()) / 60000))
        } satisfies GeofenceMonitoringStaleSession;
      })
      .filter((item): item is GeofenceMonitoringStaleSession => Boolean(item));
  });

  return {
    totals: {
      branchesMonitored: branchesData.length,
      branchesConfigured: branchesData.filter((branch) => branch.geofenceEnabled).length,
      branchesMissingCoordinates: branchesData.filter((branch) => !branch.coordinatesConfigured).length,
      branchesDisabled: branchesData.filter((branch) => branch.coordinatesConfigured && !branch.geofenceEnabled).length,
      activeTrackedSessions: activeSessions.length,
      staleTrackedSessions: staleSessions.length,
      recentExits: locationEvents.filter((event) => event.inside_geofence === false).length,
      recentPendingReports: pendingSamples.length,
      recentLowConfidenceReports: pendingSamples.filter((sample) => sample.reasonCode === "low_accuracy").length,
      recentAutoCheckouts: autoCheckoutSessions.length
    },
    branches: branchesData,
    recentEvents,
    pendingSamples,
    staleSessions
  };
}

async function loadBranches(supabase: ReturnType<typeof createAdminClient>, input: GeofenceMonitoringScope) {
  let query = supabase.from("branches").select("id, name, gym_id, latitude, longitude").order("name", { ascending: true });
  if (input.branchId) {
    query = query.eq("id", input.branchId);
  } else {
    query = query.in("gym_id", input.gymIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BranchRow[];
}

async function loadBranchSettings(supabase: ReturnType<typeof createAdminClient>, branchIds: string[]) {
  if (branchIds.length === 0) {
    return [] as BranchSettingRow[];
  }

  const { data, error } = await supabase
    .from("branch_settings")
    .select("branch_id, attendance_settings")
    .in("branch_id", branchIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BranchSettingRow[];
}

async function loadActiveSessions(supabase: ReturnType<typeof createAdminClient>, input: GeofenceMonitoringScope, branchIds: string[]) {
  let query = supabase
    .from("attendance_sessions")
    .select("id, member_id, branch_id, gym_id, check_in_at, members(full_name, member_code)")
    .eq("status", "inside")
    .order("check_in_at", { ascending: false });

  if (input.branchId) {
    query = query.eq("branch_id", input.branchId);
  } else {
    query = query.in("gym_id", input.gymIds);
  }

  if (branchIds.length > 0 && !input.branchId) {
    query = query.in("branch_id", branchIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SessionRow[];
}

async function loadLocationEvents(supabase: ReturnType<typeof createAdminClient>, input: GeofenceMonitoringScope, branchIds: string[], since: string) {
  let query = supabase
    .from("attendance_location_events")
    .select("id, member_id, branch_id, attendance_session_id, latitude, longitude, inside_geofence, geofence_radius_m, occurred_at, metadata")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false });

  if (input.branchId) {
    query = query.eq("branch_id", input.branchId);
  } else {
    query = query.in("gym_id", input.gymIds);
  }

  if (branchIds.length > 0 && !input.branchId) {
    query = query.in("branch_id", branchIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LocationEventRow[];
}

async function loadAutoCheckoutSessions(supabase: ReturnType<typeof createAdminClient>, input: GeofenceMonitoringScope, branchIds: string[], since: string) {
  let query = supabase
    .from("attendance_sessions")
    .select("id, member_id, branch_id, gym_id, check_in_at, check_out_at, check_out_source, members(full_name, member_code)")
    .in("check_out_source", ["system"])
    .gte("check_out_at", since)
    .order("check_out_at", { ascending: false });

  if (input.branchId) {
    query = query.eq("branch_id", input.branchId);
  } else {
    query = query.in("gym_id", input.gymIds);
  }

  if (branchIds.length > 0 && !input.branchId) {
    query = query.in("branch_id", branchIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SessionRow[];
}

async function loadMembersById(supabase: ReturnType<typeof createAdminClient>, memberIds: string[]) {
  if (memberIds.length === 0) {
    return new Map<string, { full_name: string | null; member_code: string | null }>();
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, member_code")
    .in("id", memberIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((member) => [member.id as string, { full_name: member.full_name as string | null, member_code: member.member_code as string | null }]));
}

function toEventRow(
  type: GeofenceMonitoringEvent["type"],
  event: LocationEventRow,
  membersById: Map<string, { full_name: string | null; member_code: string | null }>,
  branches: BranchRow[]
) {
  const member = membersById.get(event.member_id);
  const branch = branches.find((item) => item.id === event.branch_id) ?? null;
  return {
    id: event.id,
    type,
    memberId: event.member_id,
    memberName: member?.full_name ?? "Member",
    memberCode: member?.member_code ?? null,
    sessionId: event.attendance_session_id,
    branchId: event.branch_id,
    branchName: branch?.name ?? null,
    occurredAt: event.occurred_at,
    distanceMeters: toDistanceMeters(event.metadata),
    radiusMeters: event.geofence_radius_m
  };
}

function toAutoCheckoutEvent(
  session: SessionRow,
  membersById: Map<string, { full_name: string | null; member_code: string | null }>,
  branches: BranchRow[]
): GeofenceMonitoringEvent {
  const member = membersById.get(session.member_id);
  const branch = branches.find((item) => item.id === session.branch_id) ?? null;
  return {
    id: session.id,
    type: "auto_checkout",
    memberId: session.member_id,
    memberName: member?.full_name ?? session.members?.full_name ?? "Member",
    memberCode: member?.member_code ?? session.members?.member_code ?? null,
    sessionId: session.id,
    branchId: session.branch_id,
    branchName: branch?.name ?? null,
    occurredAt: session.check_out_at ?? session.check_in_at,
    distanceMeters: null,
    radiusMeters: null
  };
}

function toPendingSample(
  event: LocationEventRow,
  membersById: Map<string, { full_name: string | null; member_code: string | null }>,
  branches: BranchRow[]
): GeofenceMonitoringPendingSample | null {
  const reasonCode = getGeofenceDecisionCode(event);
  if (reasonCode !== "outside_pending" && reasonCode !== "low_accuracy") {
    return null;
  }

  const member = membersById.get(event.member_id);
  const branch = branches.find((item) => item.id === event.branch_id) ?? null;
  return {
    id: event.id,
    memberId: event.member_id,
    memberName: member?.full_name ?? "Member",
    memberCode: member?.member_code ?? null,
    sessionId: event.attendance_session_id,
    branchId: event.branch_id,
    branchName: branch?.name ?? null,
    occurredAt: event.occurred_at,
    distanceMeters: toDistanceMeters(event.metadata),
    radiusMeters: event.geofence_radius_m,
    reasonCode
  };
}

function toDistanceMeters(metadata: Record<string, unknown> | null) {
  const raw = metadata?.distanceMeters;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getGeofenceDecisionCode(event: LocationEventRow) {
  const raw = event.metadata?.geofenceDecision;
  return typeof raw === "string" ? raw : null;
}

function isPendingGeofenceEvent(event: LocationEventRow) {
  const decision = getGeofenceDecisionCode(event);
  return decision === "outside_pending" || decision === "low_accuracy";
}

function isLowConfidenceGeofenceEvent(event: LocationEventRow) {
  return getGeofenceDecisionCode(event) === "low_accuracy";
}

function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function groupBy<T>(values: T[], getKey: (value: T) => string) {
  return values.reduce((acc, value) => {
    const key = getKey(value);
    const current = acc.get(key) ?? [];
    current.push(value);
    acc.set(key, current);
    return acc;
  }, new Map<string, T[]>());
}

function latestBy<T>(values: T[], getKey: (value: T) => string) {
  const map = new Map<string, T>();
  for (const value of values) {
    const key = getKey(value);
    if (!map.has(key)) {
      map.set(key, value);
    }
  }
  return map;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function emptyGeofenceMonitoringData(): GeofenceMonitoringData {
  return {
    totals: {
      branchesMonitored: 0,
      branchesConfigured: 0,
      branchesMissingCoordinates: 0,
      branchesDisabled: 0,
      activeTrackedSessions: 0,
      staleTrackedSessions: 0,
      recentExits: 0,
      recentPendingReports: 0,
      recentLowConfidenceReports: 0,
      recentAutoCheckouts: 0
    },
    branches: [],
    recentEvents: [],
    pendingSamples: [],
    staleSessions: []
  };
}
