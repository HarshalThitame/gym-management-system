import { addDays, formatISO, startOfMonth } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ReceptionDashboardData = {
  metrics: {
    todayCheckIns: number;
    todayRegistrations: number;
    pendingRenewals: number;
    todayPayments: number;
    todayPaymentAmount: number;
    todayLeads: number;
    appointments: number;
    upcomingClasses: number;
    recentActivities: number;
    pendingPayments: number;
  };
  leads: Database["public"]["Tables"]["leads"]["Row"][];
  payments: Database["public"]["Tables"]["payments"]["Row"][];
  recentSessions: Database["public"]["Tables"]["attendance_sessions"]["Row"][];
};

export async function getReceptionDashboard(gymId: string): Promise<ReceptionDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = formatISO(new Date(), { representation: "date" });
  const tomorrow = formatISO(addDays(new Date(), 1), { representation: "date" });
  const weekEnd = formatISO(addDays(new Date(), 7), { representation: "date" });
  const monthStart = formatISO(startOfMonth(new Date()), { representation: "date" });

  const [
    checkInsResult,
    registrationsResult,
    renewalsResult,
    todayPaymentsResult,
    leadsResult,
    upcomingClassesResult,
    pendingPaymentsResult,
    recentSessionsResult,
    recentPaymentsResult
  ] = await Promise.all([
    supabase.from("attendance_sessions").select("*", { count: "exact" }).eq("gym_id", gymId).gte("check_in_at", `${today}T00:00:00.000Z`).lt("check_in_at", `${tomorrow}T00:00:00.000Z`),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("joined_at", today).lt("joined_at", tomorrow),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("gym_id", gymId).in("status", ["active", "frozen"]).gte("end_date", today).lte("end_date", weekEnd),
    supabase.from("payments").select("*").eq("gym_id", gymId).eq("status", "paid").gte("created_at", `${today}T00:00:00.000Z`).lt("created_at", `${tomorrow}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(20),
    supabase.from("leads").select("*").eq("gym_id", gymId).gte("created_at", `${today}T00:00:00.000Z`).lt("created_at", `${tomorrow}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(20),
    supabase.from("class_sessions").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("session_date", today).lte("session_date", weekEnd).in("status", ["scheduled", "in_progress"]),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("gym_id", gymId).in("status", ["pending", "processing", "failed"]),
    supabase.from("attendance_sessions").select("*").eq("gym_id", gymId).order("check_in_at", { ascending: false }).limit(8),
    supabase.from("payments").select("*").eq("gym_id", gymId).gte("created_at", `${monthStart}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(8)
  ]);
  const firstError = [
    checkInsResult,
    registrationsResult,
    renewalsResult,
    todayPaymentsResult,
    leadsResult,
    upcomingClassesResult,
    pendingPaymentsResult,
    recentSessionsResult,
    recentPaymentsResult
  ].find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const todayPayments = todayPaymentsResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const recentSessions = recentSessionsResult.data ?? [];
  const payments = recentPaymentsResult.data ?? [];

  return {
    metrics: {
      todayCheckIns: checkInsResult.count ?? todayPayments.length,
      todayRegistrations: registrationsResult.count ?? 0,
      pendingRenewals: renewalsResult.count ?? 0,
      todayPayments: todayPayments.length,
      todayPaymentAmount: todayPayments.reduce((total, payment) => total + payment.amount, 0),
      todayLeads: leads.length,
      appointments: 0,
      upcomingClasses: upcomingClassesResult.count ?? 0,
      recentActivities: recentSessions.length + payments.length + leads.length,
      pendingPayments: pendingPaymentsResult.count ?? 0
    },
    leads,
    payments,
    recentSessions
  };
}

export async function listReceptionPayments(gymId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listReceptionLeads(gymId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
