"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Database, Json } from "@/types/database";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch, requireOrgFeatureAccess } from "@/features/entitlement";
import { sendViaChannel } from "@/features/communications/lib/message-sender";
import { getOrgEmailConfigOrDefault } from "@/services/email/email-config-service";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignDeliveryInsert = Database["public"]["Tables"]["campaign_deliveries"]["Insert"];

export type SegmentFilters = {
  status?: string[];
  inactive_days?: number;
  plan_type?: string[];
};

export type MemberRecipient = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  gym_id: string | null;
  status: string;
  metadata: Json;
};

type DeliveryStats = {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
};

export type CampaignAnalytics = {
  campaign: CampaignRow | null;
  deliveries: DeliveryStats;
  byChannel: Record<string, DeliveryStats>;
  byStatus: Record<string, number>;
  engagementRate: number;
};

// ─── Existing saveCampaignAction (backward compat) ─────────────────────────

export async function saveCampaignAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "whatsapp_integration", actionName: "campaign.save" });
    const supabase = await createSupabaseServerClient();
    const campaignId = formData.get("campaignId") as string | null;
    const gymId = formData.get("gymId") as string;
    const name = formData.get("name") as string;
    const campaignType = formData.get("campaignType") as string;
    if (!gymId || !name || !campaignType) return { ...prevState, status: "error", message: "Gym, name, and campaign type are required." };

    const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
    if (!gym || gym.organization_id !== ctx.organizationId) return { ...prevState, status: "error", message: "Gym not in your organization." };

    const category = (formData.get("category") as string) || "membership";
    const segmentKey = (formData.get("segmentKey") as string) || "all";
    const scheduledFor = (formData.get("scheduledFor") as string) || null;
    const channelsRaw = formData.get("channels") as string | null;
    const targetGymsRaw = formData.get("targetGymIds") as string | null;
    const segmentFiltersRaw = formData.get("segmentFilters") as string | null;
    const messageBodyRaw = formData.get("messageBody") as string | null;

    if (campaignId) {
      const update: Record<string, unknown> = { name, campaign_type: campaignType, category, segment_key: segmentKey, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("campaigns").update(update as never).eq("id", campaignId);
      if (error) throw new Error(error.message);
    } else {
      const insert: Record<string, unknown> = { gym_id: gymId, name, campaign_type: campaignType, category, segment_key: segmentKey, status: scheduledFor ? "scheduled" : "draft", scheduled_for: scheduledFor };
      if (channelsRaw) insert.channels = channelsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (targetGymsRaw) insert.target_gym_ids = targetGymsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (segmentFiltersRaw) {
        try { insert.segment_filters = JSON.parse(segmentFiltersRaw) as Json; } catch { /* ignore */ }
      }
      if (messageBodyRaw) {
        try { insert.message_body = JSON.parse(messageBodyRaw) as Json; } catch { /* ignore */ }
      }
      const { data, error } = await supabase.from("campaigns").insert(insert as never).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_campaign", entityType: "campaign", entityId: data.id });
    }

    revalidateOrgModules(["/organization/communications"]);
    return { ...prevState, status: "success", message: "Campaign saved." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save campaign.");
  }
}

export async function sendCampaignAction(prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrganizationFeatureAccess({ organizationId: ctx.organizationId, featureKey: "whatsapp_integration", actionName: "campaign.send" });
    const campaignId = formData.get("campaignId") as string;
    if (!campaignId) return { ...prevState, status: "error", message: "Campaign ID is required." };

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("campaigns").update({ status: "running", updated_at: new Date().toISOString() } as never).eq("id", campaignId);
    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.send_campaign", entityType: "campaign", entityId: campaignId });
    revalidateOrgModules(["/organization/communications"]);
    return { ...prevState, status: "success", message: "Campaign sent." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to send campaign.");
  }
}

// ─── Network-wide campaign actions ─────────────────────────────────────────

export async function saveNetworkCampaignAction(
  prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/communications");
    await requireOrgFeatureAccess(ctx.organizationId, "network_wide_campaign_manager");
    const supabase = await createSupabaseServerClient();

    const campaignId = formData.get("campaignId") as string | null;
    const name = formData.get("name") as string;
    const channelsRaw = formData.get("channels") as string;
    const targetGymsRaw = formData.get("targetGymIds") as string;
    if (!name || !channelsRaw || !targetGymsRaw) {
      return { ...prevState, status: "error", message: "Name, channels, and target gyms are required." };
    }

    const channels = channelsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const targetGymIds = targetGymsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (channels.length === 0 || targetGymIds.length === 0) {
      return { ...prevState, status: "error", message: "At least one channel and one target gym are required." };
    }

    const { data: gyms } = await supabase.from("gyms").select("id").eq("organization_id", ctx.organizationId).in("id", targetGymIds);
    const validGymIds = (gyms ?? []).map((g) => g.id);
    if (validGymIds.length === 0) return { ...prevState, status: "error", message: "No valid target gyms found in your organization." };

    const category = (formData.get("category") as string) || "promotions";
    const scheduledFor = (formData.get("scheduledFor") as string) || null;
    const segmentFiltersRaw = formData.get("segmentFilters") as string | null;
    const messageBodyRaw = formData.get("messageBody") as string | null;

    let segmentFilters: Json = {};
    let messageBody: Json = {};
    if (segmentFiltersRaw) {
      try { segmentFilters = JSON.parse(segmentFiltersRaw) as Json; } catch { /* ignore */ }
    }
    if (messageBodyRaw) {
      try { messageBody = JSON.parse(messageBodyRaw) as Json; } catch { /* ignore */ }
    }

    const base: Record<string, unknown> = {
      name,
      campaign_type: "multi_channel",
      category,
      segment_key: "network_wide",
      channels,
      target_gym_ids: validGymIds,
      segment_filters: segmentFilters,
      message_body: messageBody,
      status: scheduledFor ? "scheduled" : "draft",
      scheduled_for: scheduledFor || null,
    };

    if (campaignId) {
      const { error } = await supabase.from("campaigns").update({ ...base, updated_at: new Date().toISOString() } as never).eq("id", campaignId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase.from("campaigns").insert(base as never).select("id").single();
      if (error) throw new Error(error.message);
      await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_network_campaign", entityType: "campaign", entityId: data.id });
    }

    revalidateOrgModules(["/organization/communications"]);
    return { ...prevState, status: "success", message: "Network campaign saved." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to save network campaign.");
  }
}

export async function resolveCampaignRecipientsAction(
  organizationId: string,
  targetGymIds: string[],
  segmentFilters: SegmentFilters,
): Promise<{ members: MemberRecipient[]; total: number }> {
  await requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager");
  const supabase = await createSupabaseServerClient();

  // Validate gyms belong to org in parallel with member query
  const { data: validGyms } = await supabase.from("gyms").select("id").eq("organization_id", organizationId).in("id", targetGymIds);
  const validGymIds = (validGyms ?? []).map((g) => g.id);
  if (validGymIds.length === 0) return { members: [], total: 0 };

  const memberStatuses = segmentFilters.status?.length ? segmentFilters.status : ["active"];
  let query = supabase.from("members")
    .select("id, full_name, email, phone, gym_id, status, metadata")
    .in("gym_id", validGymIds)
    .in("status", memberStatuses as never);

  if (segmentFilters.inactive_days && segmentFilters.inactive_days > 0) {
    const cutoff = new Date(Date.now() - segmentFilters.inactive_days * 24 * 60 * 60 * 1000).toISOString();
    query = query.lt("updated_at", cutoff);
  }

  const { data: membersData, error } = await query.order("full_name", { ascending: true }).limit(500);
  if (error) throw new Error(error.message);

  let members = (membersData ?? []) as unknown as MemberRecipient[];

  if (segmentFilters.plan_type?.length) {
    const memberIds = members.map((m) => m.id);
    if (memberIds.length > 0) {
      const { data: memberships } = await supabase.from("memberships")
        .select("member_id, membership_plans!inner(plan_type)")
        .in("member_id", memberIds)
        .in("status", ["active"]);
      const memberPlanTypes = new Map<string, string>();
      for (const m of (memberships ?? [])) {
        const plan = (m as unknown as { membership_plans: { plan_type: string } }).membership_plans;
        if (plan?.plan_type && segmentFilters.plan_type.includes(plan.plan_type)) {
          memberPlanTypes.set(m.member_id, plan.plan_type);
        }
      }
      members = members.filter((m) => memberPlanTypes.has(m.id));
    }
  }

  return { members, total: members.length };
}

export async function executeNetworkCampaignAction(
  organizationId: string,
  campaignId: string,
): Promise<{ sent: number; failed: number; deliveries: string[] }> {
  await requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager");
  const supabase = await createSupabaseServerClient();

  const { data: campaign, error: campaignErr } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
  if (campaignErr || !campaign) throw new Error("Campaign not found.");

  // Validate campaign belongs to org: check gym_id or target_gym_ids are owned by this org
  const campaignGymIds: string[] = [];
  if (campaign.target_gym_ids?.length) campaignGymIds.push(...campaign.target_gym_ids);
  else if (campaign.gym_id) campaignGymIds.push(campaign.gym_id);
  if (campaignGymIds.length > 0) {
    const { data: orgGyms } = await supabase.from("gyms").select("id").eq("organization_id", organizationId);
    const orgGymIdSet = new Set((orgGyms ?? []).map((g) => g.id));
    if (!campaignGymIds.some((gid) => orgGymIdSet.has(gid))) throw new Error("Campaign does not belong to this organization.");
  }

  const targetGymIds = (campaign.target_gym_ids?.length ? campaign.target_gym_ids : (campaign.gym_id ? [campaign.gym_id] : [])) as string[];
  const channels = (campaign.channels?.length ? campaign.channels : [campaign.campaign_type]) as string[];
  const segmentFilters = (campaign.segment_filters as unknown as SegmentFilters) ?? {};
  const messageBody = campaign.message_body as Record<string, string> | null;

  const { members } = await resolveCampaignRecipientsAction(organizationId, targetGymIds, segmentFilters);
  const emailConfig = await getOrgEmailConfigOrDefault(organizationId);

  if (members.length === 0) {
    await supabase.from("campaigns").update({ status: "completed", updated_at: new Date().toISOString() } as never).eq("id", campaignId);
    return { sent: 0, failed: 0, deliveries: [] };
  }

  const deliveryRows: CampaignDeliveryInsert[] = [];
  for (const member of members) {
    for (const channel of channels) {
      const recipient = channel === "email" ? member.email : member.phone;
      if (!recipient) continue;
      deliveryRows.push({
        campaign_id: campaignId,
        organization_id: organizationId,
        member_id: member.id,
        channel: channel as CampaignDeliveryInsert["channel"],
        recipient,
        status: "pending",
      });
    }
  }

  const deliveryIds: string[] = [];
  if (deliveryRows.length > 0) {
    const { data: inserted } = await supabase.from("campaign_deliveries").insert(deliveryRows as never).select("id");
    if (inserted) deliveryIds.push(...inserted.map((d) => d.id));
  }

  await supabase.from("campaigns").update({
    status: "running",
    sent_count: members.length,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never).eq("id", campaignId);

  let sentCount = 0;
  let failedCount = 0;

  const sendPromises = deliveryRows.map(async (delivery, idx) => {
    const deliveryId = deliveryIds[idx];
    const recipient = delivery.recipient;
    const channel = delivery.channel;
    const subject = (messageBody?.["email_subject"] ?? "Campaign Update") as string;
    const body = (messageBody?.[channel as string] ?? messageBody?.["body"] ?? "") as string;

    const result = await sendViaChannel(channel, recipient, subject, body, emailConfig.from ?? undefined, emailConfig.replyTo ?? undefined);
    if (result.ok) {
      sentCount++;
      if (deliveryId) {
        await supabase.from("campaign_deliveries").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        } as never).eq("id", deliveryId);
      }
    } else {
      failedCount++;
      if (deliveryId) {
        await supabase.from("campaign_deliveries").update({
          status: "failed",
          error_message: result.error,
        } as never).eq("id", deliveryId);
      }
    }
  });

  await Promise.all(sendPromises);

  await supabase.from("campaigns").update({
    sent_count: sentCount,
    failed_count: failedCount,
    updated_at: new Date().toISOString(),
  } as never).eq("id", campaignId);

  revalidateOrgModules(["/organization/communications"]);
  return { sent: sentCount, failed: failedCount, deliveries: deliveryIds };
}

// ─── Campaign analytics ────────────────────────────────────────────────────

function computeStats(deliveries: { status: string }[]): DeliveryStats {
  const total = deliveries.length;
  const sent = deliveries.filter((d) => d.status === "sent" || d.status === "delivered" || d.status === "opened" || d.status === "clicked").length;
  const delivered = deliveries.filter((d) => d.status === "delivered" || d.status === "opened" || d.status === "clicked").length;
  const opened = deliveries.filter((d) => d.status === "opened" || d.status === "clicked").length;
  const clicked = deliveries.filter((d) => d.status === "clicked").length;
  const failed = deliveries.filter((d) => d.status === "failed").length;
  const bounced = deliveries.filter((d) => d.status === "bounced").length;
  return { total, sent, delivered, opened, clicked, failed, bounced };
}

export async function getCampaignAnalyticsAction(
  organizationId: string,
  campaignId: string,
): Promise<CampaignAnalytics> {
  await requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager");
  const supabase = await createSupabaseServerClient();

  const [campaignRes, deliveriesRes, byChannelRes, byStatusRes] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).single(),
    supabase.from("campaign_deliveries").select("status").eq("campaign_id", campaignId),
    supabase.from("campaign_deliveries").select("channel, status").eq("campaign_id", campaignId),
    supabase.from("campaign_deliveries").select("status").eq("campaign_id", campaignId),
  ]);

  const campaign = campaignRes.data ?? null;
  const deliveries = (deliveriesRes.data ?? []) as { status: string }[];
  const byChannelData = (byChannelRes.data ?? []) as { channel: string; status: string }[];
  const byStatusData = (byStatusRes.data ?? []) as { status: string }[];

  const overall = computeStats(deliveries);

  const channelStats = (ch: string): DeliveryStats => {
    const chDeliveries = byChannelData.filter((d) => d.channel === ch);
    return computeStats(chDeliveries);
  };

  const byChannel: Record<string, DeliveryStats> = {
    email: channelStats("email"),
    whatsapp: channelStats("whatsapp"),
    sms: channelStats("sms"),
  };

  const byStatus: Record<string, number> = {};
  for (const d of byStatusData) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
  }

  const engagementRate = overall.delivered > 0
    ? Math.round(((overall.opened + overall.clicked) / overall.delivered) * 100)
    : 0;

  return { campaign, deliveries: overall, byChannel, byStatus, engagementRate };
}

export async function getOrganizationCampaignStatsAction(
  organizationId: string,
): Promise<{ totalSent: number; totalCampaigns: number; avgEngagementRate: number }> {
  await requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager");
  const supabase = await createSupabaseServerClient();

  const { data: gyms } = await supabase.from("gyms").select("id").eq("organization_id", organizationId);
  const gymIds = (gyms ?? []).map((g) => g.id);

  if (gymIds.length === 0) return { totalSent: 0, totalCampaigns: 0, avgEngagementRate: 0 };

  const [campaignsRes, deliveriesRes] = await Promise.all([
    supabase.from("campaigns").select("id, sent_count, delivered_count, opened_count").in("gym_id", gymIds),
    supabase.from("campaign_deliveries").select("status").eq("organization_id", organizationId),
  ]);

  const campaigns = campaignsRes.data ?? [];
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count ?? 0), 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + (c.delivered_count ?? 0), 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + (c.opened_count ?? 0), 0);
  const avgEngagementRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;

  return { totalSent, totalCampaigns: campaigns.length, avgEngagementRate };
}

export async function getCampaignDeliveriesAction(
  organizationId: string,
  campaignId: string,
): Promise<Array<{ id: string; recipient: string; channel: string; status: string; sent_at: string | null; error_message: string | null }>> {
  await requireOrgFeatureAccess(organizationId, "network_wide_campaign_manager");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("campaign_deliveries")
    .select("id, recipient, channel, status, sent_at, error_message")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Array<{ id: string; recipient: string; channel: string; status: string; sent_at: string | null; error_message: string | null }>;
}
