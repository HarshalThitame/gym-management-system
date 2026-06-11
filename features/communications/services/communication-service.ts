import { addDays, formatISO } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignRow, CommunicationDashboardData, CommunicationSegmentRow, NotificationCenterData, NotificationPreferenceRow, SegmentRecipient } from "@/types/communications";
import type { TrainerRow } from "@/types/training";

export async function listNotificationTemplates(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("notification_templates").select("*").order("category", { ascending: true }).order("name", { ascending: true });
  if (gymId) {
    query = query.or(`gym_id.eq.${gymId},gym_id.is.null`);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function listCommunicationSegments(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("communication_segments").select("*").eq("status", "active").order("name", { ascending: true });
  if (gymId) {
    query = query.or(`gym_id.eq.${gymId},gym_id.is.null`);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function getCommunicationDashboard(gymId: string | null): Promise<CommunicationDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = todayDate();

  let templatesQuery = supabase.from("notification_templates").select("*").order("created_at", { ascending: false }).limit(40);
  let segmentsQuery = supabase.from("communication_segments").select("*").order("name", { ascending: true }).limit(40);
  let campaignsQuery = supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(40);
  let performanceQuery = supabase.from("campaign_performance_summary").select("*").limit(40);
  let announcementsQuery = supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(30);
  let automationQuery = supabase.from("communication_automation_rules").select("*").order("created_at", { ascending: false }).limit(40);
  let channelQuery = supabase.from("communication_channel_daily_summary").select("*").gte("communication_date", formatISO(addDays(new Date(), -14), { representation: "date" })).limit(200);
  let historyQuery = supabase.from("communication_history").select("*").order("created_at", { ascending: false }).limit(40);
  let unreadQuery = supabase.from("notifications").select("id").eq("status", "unread");

  if (gymId) {
    templatesQuery = templatesQuery.or(`gym_id.eq.${gymId},gym_id.is.null`);
    segmentsQuery = segmentsQuery.or(`gym_id.eq.${gymId},gym_id.is.null`);
    campaignsQuery = campaignsQuery.eq("gym_id", gymId);
    performanceQuery = performanceQuery.eq("gym_id", gymId);
    announcementsQuery = announcementsQuery.eq("gym_id", gymId);
    automationQuery = automationQuery.eq("gym_id", gymId);
    channelQuery = channelQuery.eq("gym_id", gymId);
    historyQuery = historyQuery.eq("gym_id", gymId);
    unreadQuery = unreadQuery.eq("gym_id", gymId);
  }

  const [templatesResult, segmentsResult, campaignsResult, performanceResult, announcementsResult, automationResult, channelResult, historyResult, unreadResult] = await Promise.all([
    templatesQuery,
    segmentsQuery,
    campaignsQuery,
    performanceQuery,
    announcementsQuery,
    automationQuery,
    channelQuery,
    historyQuery,
    unreadQuery
  ]);
  const firstError = [templatesResult, segmentsResult, campaignsResult, performanceResult, announcementsResult, automationResult, channelResult, historyResult, unreadResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const channelRows = channelResult.data ?? [];
  const todayRows = channelRows.filter((row) => row.communication_date === today);

  return {
    templates: templatesResult.data ?? [],
    segments: segmentsResult.data ?? [],
    campaigns: campaignsResult.data ?? [],
    campaignPerformance: performanceResult.data ?? [],
    announcements: announcementsResult.data ?? [],
    automationRules: automationResult.data ?? [],
    channelSummary: channelRows,
    recentHistory: historyResult.data ?? [],
    metrics: {
      emailsToday: sumChannel(todayRows, "email"),
      whatsappToday: sumChannel(todayRows, "whatsapp"),
      smsToday: sumChannel(todayRows, "sms"),
      unreadNotifications: unreadResult.data?.length ?? 0,
      activeCampaigns: (campaignsResult.data ?? []).filter((campaign) => campaign.status === "scheduled" || campaign.status === "running").length,
      activeAutomations: (automationResult.data ?? []).filter((rule) => rule.status === "active").length
    }
  };
}

export async function getMemberNotificationCenter(userId: string): Promise<NotificationCenterData | null> {
  const supabase = await createSupabaseServerClient();
  const { data: members, error } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(error.message);
  }
  const member = members?.[0] ?? null;
  if (!member) {
    return null;
  }

  const [notificationsResult, announcementsResult, preferencesResult, historyResult] = await Promise.all([
    supabase.from("notifications").select("*").or(`user_id.eq.${userId},member_id.eq.${member.id}`).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(80),
    getVisibleAnnouncements(member.gym_id, "all_members"),
    supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("communication_history").select("*").or(`recipient_user_id.eq.${userId},member_id.eq.${member.id}`).order("created_at", { ascending: false }).limit(80)
  ]);

  const firstError = [notificationsResult, preferencesResult, historyResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const notifications = notificationsResult.data ?? [];
  return {
    notifications,
    announcements: announcementsResult,
    preferences: preferencesResult.data ?? null,
    history: historyResult.data ?? [],
    metrics: {
      unread: notifications.filter((notification) => notification.status === "unread").length,
      pinned: notifications.filter((notification) => notification.pinned).length,
      priority: notifications.filter((notification) => notification.status === "unread" && (notification.priority === "high" || notification.priority === "urgent")).length,
      totalHistory: historyResult.data?.length ?? 0
    }
  };
}

export async function getTrainerNotificationCenter(userId: string, gymId: string | null): Promise<NotificationCenterData | null> {
  const supabase = await createSupabaseServerClient();
  let trainerQuery = supabase.from("trainers").select("*").eq("user_id", userId);
  if (gymId) {
    trainerQuery = trainerQuery.eq("gym_id", gymId);
  }
  const { data: trainer, error } = await trainerQuery.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!trainer) {
    return null;
  }

  const [notificationsResult, announcementsResult, preferencesResult, historyResult] = await Promise.all([
    supabase.from("notifications").select("*").or(`user_id.eq.${userId},trainer_id.eq.${trainer.id}`).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(80),
    getVisibleAnnouncements(trainer.gym_id, "staff"),
    supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("communication_history").select("*").or(`recipient_user_id.eq.${userId},trainer_id.eq.${trainer.id}`).order("created_at", { ascending: false }).limit(80)
  ]);
  const firstError = [notificationsResult, preferencesResult, historyResult].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const notifications = notificationsResult.data ?? [];
  return {
    notifications,
    announcements: announcementsResult,
    preferences: preferencesResult.data ?? null,
    history: historyResult.data ?? [],
    metrics: {
      unread: notifications.filter((notification) => notification.status === "unread").length,
      pinned: notifications.filter((notification) => notification.pinned).length,
      priority: notifications.filter((notification) => notification.status === "unread" && (notification.priority === "high" || notification.priority === "urgent")).length,
      totalHistory: historyResult.data?.length ?? 0
    }
  };
}

export async function getOrCreateNotificationPreferences(input: { userId: string; gymId: string | null; memberId?: string | null; trainerId?: string | null }): Promise<NotificationPreferenceRow> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error } = await supabase.from("notification_preferences").select("*").eq("user_id", input.userId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (existing) {
    return existing;
  }

  const { data, error: insertError } = await supabase.from("notification_preferences").insert({
    user_id: input.userId,
    gym_id: input.gymId,
    member_id: input.memberId ?? null,
    trainer_id: input.trainerId ?? null
  }).select("*").maybeSingle();

  if (insertError || !data) {
    throw new Error(insertError?.message ?? "Could not create notification preferences.");
  }
  return data;
}

export async function resolveSegmentRecipients(gymId: string | null, segmentKey: string): Promise<SegmentRecipient[]> {
  const members = await getMembersForSegment(gymId, segmentKey);
  const trainerIds = Array.from(new Set(members.map((member) => member.assigned_trainer_id).filter((id): id is string => Boolean(id))));
  const trainers = await getTrainersById(trainerIds);
  return members.map((member) => ({
    member,
    trainer: member.assigned_trainer_id ? pickTrainer(trainers.get(member.assigned_trainer_id)) : null,
    email: member.email,
    phone: member.phone,
    userId: member.user_id
  }));
}

export async function getCampaignWithTemplate(campaignId: string): Promise<{ campaign: CampaignRow; template: Awaited<ReturnType<typeof listNotificationTemplates>>[number] | null; segment: CommunicationSegmentRow | null }> {
  const supabase = await createSupabaseServerClient();
  const { data: campaign, error } = await supabase.from("campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (error || !campaign) {
    throw new Error(error?.message ?? "Campaign not found.");
  }
  const [templateResult, segmentResult] = await Promise.all([
    campaign.template_id ? supabase.from("notification_templates").select("*").eq("id", campaign.template_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    campaign.segment_id ? supabase.from("communication_segments").select("*").eq("id", campaign.segment_id).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);
  if (templateResult.error || segmentResult.error) {
    throw new Error(templateResult.error?.message ?? segmentResult.error?.message ?? "Campaign lookup failed.");
  }
  return { campaign, template: templateResult.data ?? null, segment: segmentResult.data ?? null };
}

async function getVisibleAnnouncements(gymId: string | null, targetSegment: string) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  let query = supabase
    .from("announcements")
    .select("*")
    .eq("status", "published")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(20);

  if (gymId) {
    query = query.eq("gym_id", gymId);
  }

  if (targetSegment === "staff") {
    query = query.in("target_segment", ["all_staff", "staff", "trainers", "all_members"]);
  } else {
    query = query.in("target_segment", ["all_members", targetSegment]);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

async function getMembersForSegment(gymId: string | null, segmentKey: string) {
  if (segmentKey === "active_members") {
    return getMembersByMembershipStatus(gymId, "active");
  }
  if (segmentKey === "expired_members") {
    return getMembersByMembershipStatus(gymId, "expired");
  }
  if (segmentKey === "premium_members") {
    return getPremiumMembers(gymId);
  }
  if (segmentKey === "pt_clients") {
    return getPtMembers(gymId);
  }
  if (segmentKey === "inactive_members") {
    return getInactiveMembers(gymId, 15);
  }
  return getAllMembers(gymId);
}

async function getAllMembers(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("members").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(2000);
  if (gymId) {
    query = query.eq("gym_id", gymId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

async function getMembersByMembershipStatus(gymId: string | null, status: "active" | "expired") {
  const supabase = await createSupabaseServerClient();
  let membershipQuery = supabase.from("memberships").select("member_id").eq("status", status).limit(3000);
  if (gymId) {
    membershipQuery = membershipQuery.eq("gym_id", gymId);
  }
  const { data, error } = await membershipQuery;
  if (error) {
    throw new Error(error.message);
  }
  const ids = Array.from(new Set((data ?? []).map((row) => row.member_id)));
  return getMembersById(ids);
}

async function getPremiumMembers(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let planQuery = supabase.from("membership_plans").select("id").in("access_level", ["premium", "elite"]);
  if (gymId) {
    planQuery = planQuery.eq("gym_id", gymId);
  }
  const { data: plans, error: planError } = await planQuery;
  if (planError) {
    throw new Error(planError.message);
  }
  const planIds = (plans ?? []).map((plan) => plan.id);
  if (planIds.length === 0) {
    return [];
  }
  let membershipQuery = supabase.from("memberships").select("member_id").eq("status", "active").in("membership_plan_id", planIds).limit(3000);
  if (gymId) {
    membershipQuery = membershipQuery.eq("gym_id", gymId);
  }
  const { data, error } = await membershipQuery;
  if (error) {
    throw new Error(error.message);
  }
  return getMembersById(Array.from(new Set((data ?? []).map((row) => row.member_id))));
}

async function getPtMembers(gymId: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("member_pt_packages").select("member_id").eq("status", "active").limit(3000);
  if (gymId) {
    query = query.eq("gym_id", gymId);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return getMembersById(Array.from(new Set((data ?? []).map((row) => row.member_id))));
}

async function getInactiveMembers(gymId: string | null, days: number) {
  const allMembers = await getAllMembers(gymId);
  const cutoff = formatISO(addDays(new Date(), -days), { representation: "date" });
  const supabase = await createSupabaseServerClient();
  let frequencyQuery = supabase.from("attendance_member_frequency").select("member_id,last_visit_at").limit(5000);
  if (gymId) {
    frequencyQuery = frequencyQuery.eq("gym_id", gymId);
  }
  const { data, error } = await frequencyQuery;
  if (error) {
    throw new Error(error.message);
  }
  const lastVisitByMember = new Map((data ?? []).filter((row) => row.member_id).map((row) => [row.member_id as string, row.last_visit_at]));
  return allMembers.filter((member) => {
    const lastVisit = lastVisitByMember.get(member.id);
    return !lastVisit || lastVisit.slice(0, 10) < cutoff;
  });
}

async function getMembersById(memberIds: string[]) {
  if (memberIds.length === 0) {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("members").select("*").in("id", memberIds).order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

async function getTrainersById(trainerIds: string[]) {
  if (trainerIds.length === 0) {
    return new Map<string, TrainerRow>();
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("trainers").select("*").in("id", trainerIds);
  if (error) {
    throw new Error(error.message);
  }
  return new Map((data ?? []).map((trainer) => [trainer.id, trainer]));
}

function pickTrainer(trainer?: TrainerRow) {
  if (!trainer) {
    return null;
  }
  return { id: trainer.id, display_name: trainer.display_name };
}

function sumChannel(rows: CommunicationDashboardData["channelSummary"], channel: string) {
  return rows.filter((row) => row.channel === channel).reduce((total, row) => total + (row.total ?? 0), 0);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
