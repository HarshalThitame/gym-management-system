"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const superAdminRoles = ["super_admin"] as const;

type DashboardSecurityAction = "acknowledge" | "assign" | "escalate" | "snooze" | "resolve";

type DashboardSchedulePayload = {
  user_id: string;
  email: string;
  frequency: "weekly";
  status: "active";
  next_run_at: string;
};

type DashboardScheduleClient = Awaited<ReturnType<typeof createSupabaseServerClient>> & {
  from(table: "platform_dashboard_email_schedules"): {
    upsert(payload: DashboardSchedulePayload, options: { onConflict: "user_id,frequency" }): {
      select(columns: string): {
        maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
};

const securityActionStatuses: Record<DashboardSecurityAction, "investigating" | "resolved"> = {
  acknowledge: "investigating",
  assign: "investigating",
  escalate: "investigating",
  snooze: "investigating",
  resolve: "resolved"
};

export async function updateDashboardSecurityEventAction(formData: FormData) {
  const context = await requireRole(superAdminRoles, "/super-admin");
  const securityEventId = String(formData.get("securityEventId") ?? "");
  const action = String(formData.get("action") ?? "") as DashboardSecurityAction;
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? "/super-admin"));

  if (!securityEventId || !isDashboardSecurityAction(action)) {
    redirect(returnTo);
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: readError } = await supabase
    .from("security_events")
    .select("id, status, metadata")
    .eq("id", securityEventId)
    .maybeSingle();

  if (readError || !existing) {
    console.error("[super-admin-dashboard] Security event workflow read failed.", readError?.message ?? "Missing event");
    redirect(returnTo);
  }

  const now = new Date();
  const metadata: Record<string, Json> = {
    ...jsonRecord(existing.metadata),
    dashboard_last_action: action,
    dashboard_last_action_at: now.toISOString(),
    dashboard_last_action_by: context.userId
  };

  if (action === "assign") {
    metadata.assigned_queue = "security_operations";
    metadata.assigned_at = now.toISOString();
  }

  if (action === "escalate") {
    metadata.escalated = true;
    metadata.escalated_at = now.toISOString();
  }

  if (action === "snooze") {
    metadata.snoozed_until = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  const status = securityActionStatuses[action];
  const { error } = await supabase
    .from("security_events")
    .update({
      status,
      metadata,
      resolved_at: status === "resolved" ? now.toISOString() : null
    })
    .eq("id", securityEventId);

  if (error) {
    console.error("[super-admin-dashboard] Security event workflow update failed.", error.message);
    redirect(returnTo);
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: `dashboard.security_event.${action}`,
    entityType: "security_event",
    entityId: securityEventId,
    metadata: { status }
  });

  revalidatePath("/super-admin");
  revalidatePath("/super-admin/security");
  redirect(returnTo);
}

export async function scheduleDashboardSummaryEmailAction(formData: FormData) {
  const context = await requireRole(superAdminRoles, "/super-admin");
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? "/super-admin"));

  if (!context.userId || !context.email) {
    redirect(returnTo);
  }

  const supabase = await createSupabaseServerClient() as DashboardScheduleClient;
  const { error } = await supabase
    .from("platform_dashboard_email_schedules")
    .upsert({
      user_id: context.userId,
      email: context.email,
      frequency: "weekly",
      status: "active",
      next_run_at: nextWeeklyRunAt()
    }, { onConflict: "user_id,frequency" })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[super-admin-dashboard] Dashboard email schedule update failed.", error.message);
    redirect(returnTo);
  }

  await writeAuditLog({
    actorId: context.userId,
    gymId: context.profile?.gym_id ?? null,
    action: "dashboard.summary_email_scheduled",
    entityType: "platform_dashboard_email_schedule",
    entityId: context.userId,
    metadata: { frequency: "weekly" }
  });

  revalidatePath("/super-admin");
  redirect(returnTo);
}

function isDashboardSecurityAction(value: string): value is DashboardSecurityAction {
  return value === "acknowledge" || value === "assign" || value === "escalate" || value === "snooze" || value === "resolve";
}

function safeReturnTo(value: string) {
  if (value.startsWith("/super-admin")) {
    return value;
  }

  return "/super-admin";
}

function nextWeeklyRunAt() {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}

function jsonRecord(value: Json): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, Json>;
}
