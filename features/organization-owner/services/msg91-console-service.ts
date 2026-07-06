import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import {
  getIntegrationByProvider,
  getIntegrationLogs,
  getLatestIntegrationLog,
  getMaskedIntegrationStatus,
  type IntegrationConnectionStatus,
} from "@/features/integrations/services/integrations-service";

type IntegrationLogRow = Database["public"]["Tables"]["integration_logs"]["Row"];
type CommunicationHistoryRow = Database["public"]["Tables"]["communication_history"]["Row"];
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];

export type Msg91ConsoleLog = {
  id: string;
  action: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export type Msg91ConsoleDelivery = {
  id: string;
  channel: "sms" | "whatsapp";
  status: string;
  gymId: string | null;
  gymName: string | null;
  branchId: string | null;
  category: string;
  direction: string;
  preview: string;
  createdAt: string;
  sourceType: string | null;
  sourceId: string | null;
};

export type Msg91ConsoleChannel = {
  provider: "msg91_sms" | "msg91_whatsapp";
  title: string;
  status: IntegrationConnectionStatus;
  statusLabel: string;
  errorMessage: string | null;
  lastActivityAt: string | null;
  configSummary: Record<string, string | boolean | null>;
  latestLogMessage: string | null;
  latestLogStatus: string | null;
  latestLogAt: string | null;
  recentLogs: Msg91ConsoleLog[];
};

export type Msg91ConsoleData = {
  organizationId: string;
  gyms: Array<{ id: string; name: string }>;
  sms: Msg91ConsoleChannel;
  whatsapp: Msg91ConsoleChannel;
  recentDeliveries: Msg91ConsoleDelivery[];
  metrics: {
    connectedChannels: number;
    errorChannels: number;
    staleChannels: number;
    recentFailures: number;
    totalDeliveries: number;
    smsDeliveries: number;
    whatsappDeliveries: number;
  };
};

export async function getMsg91ConsoleData(organizationId: string): Promise<Msg91ConsoleData> {
  const supabase = await createSupabaseServerClient();
  const [sms, whatsapp, gymsResult] = await Promise.all([
    buildChannelConsole(organizationId, "msg91_sms", "MSG91 SMS"),
    buildChannelConsole(organizationId, "msg91_whatsapp", "MSG91 WhatsApp"),
    supabase.from("gyms").select("id, name").eq("organization_id", organizationId).order("name", { ascending: true }),
  ]);

  if (gymsResult.error) {
    throw new Error(gymsResult.error.message);
  }

  const gyms = (gymsResult.data ?? []) as GymRow[];
  const gymMap = new Map(gyms.map((gym) => [gym.id, gym.name] as const));
  const gymIds = gyms.map((gym) => gym.id);

  let deliveryQuery = supabase
    .from("communication_history")
    .select("id, body, channel, status, created_at, direction, category, gym_id, branch_id, source_type, source_id")
    .in("channel", ["sms", "whatsapp"])
    .order("created_at", { ascending: false })
    .limit(40);

  if (gymIds.length > 0) {
    deliveryQuery = deliveryQuery.in("gym_id", gymIds);
  }

  const { data: deliveries, error: deliveryError } = await deliveryQuery;
  if (deliveryError) {
    throw new Error(deliveryError.message);
  }

  const recentDeliveries = (deliveries ?? []).map((row) => mapDelivery(row as CommunicationHistoryRow, gymMap));
  const recentFailures = sms.recentLogs.filter((log) => log.status === "error").length + whatsapp.recentLogs.filter((log) => log.status === "error").length;
  const connectedChannels = [sms, whatsapp].filter((channel) => channel.status === "connected").length;
  const errorChannels = [sms, whatsapp].filter((channel) => channel.status === "error").length;
  const staleChannels = [sms, whatsapp].filter((channel) => channel.lastActivityAt ? isStale(channel.lastActivityAt, 24) : true).length;

  return {
    organizationId,
    gyms: gyms.map((gym) => ({ id: gym.id, name: gym.name })),
    sms,
    whatsapp,
    recentDeliveries,
    metrics: {
      connectedChannels,
      errorChannels,
      staleChannels,
      recentFailures,
      totalDeliveries: recentDeliveries.length,
      smsDeliveries: recentDeliveries.filter((delivery) => delivery.channel === "sms").length,
      whatsappDeliveries: recentDeliveries.filter((delivery) => delivery.channel === "whatsapp").length,
    },
  };
}

async function buildChannelConsole(
  organizationId: string,
  provider: "msg91_sms" | "msg91_whatsapp",
  title: string,
): Promise<Msg91ConsoleChannel> {
  const integration = await getIntegrationByProvider(organizationId, provider);
  if (!integration) {
    return {
      provider,
      title,
      status: "disconnected",
      statusLabel: "Not connected",
      errorMessage: null,
      lastActivityAt: null,
      configSummary: {},
      latestLogMessage: null,
      latestLogStatus: null,
      latestLogAt: null,
      recentLogs: [],
    };
  }

  const status = getMaskedIntegrationStatus(integration);
  const [latestLog, recentLogs] = await Promise.all([
    getLatestIntegrationLog(integration.id),
    getIntegrationLogs(integration.id),
  ]);

  return {
    provider,
    title,
    status: status?.status ?? (integration.status as IntegrationConnectionStatus),
    statusLabel: status?.status === "connected"
      ? "Connected"
      : status?.status === "error"
        ? "Needs attention"
        : status?.status === "expired"
          ? "Reconnect required"
          : "Not connected",
    errorMessage: status?.errorMessage ?? integration.error_message,
    lastActivityAt: status?.lastActivityAt ?? integration.last_sync_at ?? integration.updated_at,
    configSummary: status?.maskedConfig ?? {},
    latestLogMessage: describeLog(latestLog ?? null),
    latestLogStatus: latestLog?.status ?? null,
    latestLogAt: latestLog?.created_at ?? null,
    recentLogs: recentLogs.slice(0, 10).map(mapIntegrationLog),
  };
}

function mapIntegrationLog(log: IntegrationLogRow): Msg91ConsoleLog {
  return {
    id: log.id,
    action: log.action,
    status: log.status,
    errorMessage: log.error_message,
    createdAt: log.created_at,
  };
}

function mapDelivery(row: CommunicationHistoryRow, gymMap: Map<string, string>): Msg91ConsoleDelivery {
  return {
    id: row.id,
    channel: row.channel === "whatsapp" ? "whatsapp" : "sms",
    status: row.status,
    gymId: row.gym_id,
    gymName: row.gym_id ? gymMap.get(row.gym_id) ?? null : null,
    branchId: row.branch_id,
    category: row.category,
    direction: row.direction,
    preview: makePreview(row.body),
    createdAt: row.created_at,
    sourceType: row.source_type,
    sourceId: row.source_id,
  };
}

function describeLog(log: IntegrationLogRow | null) {
  if (!log) return null;
  if (log.error_message) return log.error_message;
  return `${log.action} · ${log.status}`;
}

export function makePreview(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 140) return compact;
  return `${compact.slice(0, 137)}...`;
}

export function isStale(value: string, hours: number) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return true;
  return Date.now() - time > hours * 60 * 60 * 1000;
}
