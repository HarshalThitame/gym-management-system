import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";
import type { SupportCustomerHealthScoreRow, SupportTicketRow } from "@/types/enterprise";

export async function getCustomerHealth(customerId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const [healthResult, ticketsResult, membershipResult, attendanceResult, bookingsResult, profileResult] = await Promise.all([
    sdb.from("support_customer_health_scores").select("*").eq("customer_id", customerId).eq("organization_id", organizationId).maybeSingle(),
    sdb.from("support_tickets").select("*").eq("customer_id", customerId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    sdb.from("memberships").select("*, membership_plans(name, max_duration_days, renewal_rate)").eq("user_id", customerId).maybeSingle(),
    sdb.from("attendance_sessions").select("id, check_in_at").eq("user_id", customerId).order("check_in_at", { ascending: false }).limit(30),
    sdb.from("class_bookings").select("*, class_sessions!inner(name, starts_at, ends_at)").eq("member_id", customerId).order("created_at", { ascending: false }).limit(20),
    sdb.from("profiles").select("last_login_at, login_count, metadata").eq("id", customerId).single().catch(() => ({ data: null })),
  ]);

  const health = healthResult.data as SupportCustomerHealthScoreRow | null;
  const tickets = (ticketsResult.data ?? []) as SupportTicketRow[];
  const membership = membershipResult.data as Record<string, unknown> | null;
  const attendance = (attendanceResult.data ?? []) as Array<Record<string, unknown>>;
  const bookings = (bookingsResult.data ?? []) as Array<Record<string, unknown>>;
  const profile = profileResult?.data as Record<string, unknown> | null;

  const openTickets = tickets.filter((t) => !["resolved", "closed"].includes(t.status));
  const avgSatisfaction = health?.satisfaction_score ?? 0;

  const last30Days = new Date(Date.now() - 30 * 86400000).toISOString();
  const recentAttendance = attendance.filter((a) => a.check_in_at && (a.check_in_at as string) >= last30Days);
  const attendanceRate = 30 > 0 ? Math.round((recentAttendance.length / 30) * 100) : 0;

  const profileMetadata = profile?.metadata as Record<string, unknown> | null;
  const rewardPoints = (membership?.reward_points as number) ?? (profileMetadata?.reward_points as number) ?? 0;
  const lastLoginAt = profile?.last_login_at as string | null;
  const loginCount = (profile?.login_count as number) ?? 0;

  const upcomingBookings = bookings.filter((b) => {
    const session = b.class_sessions as Record<string, unknown> | null;
    return session?.starts_at && new Date(session.starts_at as string) > new Date();
  });

  return {
    health,
    tickets,
    membership,
    attendance: recentAttendance,
    attendanceRate,
    bookings: upcomingBookings,
    rewardPoints,
    lastLoginAt,
    loginCount,
    openTickets: openTickets.length,
    lifetimeValue: health?.lifetime_value ?? 0,
    churnProbability: health?.churn_probability ?? 0,
    satisfactionScore: avgSatisfaction,
    healthScore: health?.health_score ?? 100,
    complaintFrequency: health?.complaint_frequency ?? 0,
  };
}

export async function computeHealthScore(customerId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: tickets } = await sdb
    .from("support_tickets")
    .select("*")
    .eq("customer_id", customerId)
    .eq("organization_id", organizationId);

  const { data: attendance } = await sdb
    .from("attendance_sessions")
    .select("id, check_in_at")
    .eq("user_id", customerId)
    .gte("check_in_at", new Date(Date.now() - 90 * 86400000).toISOString());

  const { data: payments } = await sdb
    .from("payments")
    .select("amount, status, created_at")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (!tickets) return;

  const allTickets = tickets as Array<Record<string, unknown>>;
  const totalTickets = allTickets.length;
  const resolvedTickets = allTickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
  const breachedTickets = allTickets.filter((t) => t.sla_breached).length;
  const reopenedTickets = allTickets.filter((t) => (t.reopened_count as number ?? 0) > 0).length;
  const openTicketsCount = allTickets.filter((t) => !["resolved", "closed"].includes(t.status as string)).length;

  const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 100;
  const breachRate = totalTickets > 0 ? (breachedTickets / totalTickets) * 100 : 0;
  const reopenRate = totalTickets > 0 ? (reopenedTickets / totalTickets) * 100 : 0;

  const attendanceDays = attendance?.length ?? 0;
  const attendanceScore = Math.min(100, (attendanceDays / 90) * 100);

  const failedPayments = (payments ?? []).filter((p: Record<string, unknown>) => p.status === "failed").length;
  const paymentHealth = Math.max(0, 100 - failedPayments * 20);

  const healthScore = Math.max(0, Math.min(100,
    (resolutionRate * 0.25) +
    ((100 - breachRate) * 0.2) +
    ((100 - reopenRate) * 0.1) +
    (attendanceScore * 0.2) +
    (paymentHealth * 0.15) +
    (openTicketsCount === 0 ? 10 : Math.max(0, 10 - (openTicketsCount * 3)))
  ));

  const complaintFrequency = totalTickets;
  const churnProbability = Math.max(0, Math.min(100,
    (100 - attendanceScore) * 0.3 +
    breachRate * 0.2 +
    reopenRate * 0.15 +
    (100 - paymentHealth) * 0.2 +
    (openTicketsCount > 3 ? 15 : openTicketsCount * 5)
  ));

  const totalRevenue = (payments ?? [])
    .filter((p: Record<string, unknown>) => p.status === "completed")
    .reduce((s: number, p: Record<string, unknown>) => s + ((p.amount as number) ?? 0), 0);

  await sdb.from("support_customer_health_scores").upsert({
    customer_id: customerId,
    organization_id: organizationId,
    health_score: Math.round(healthScore * 100) / 100,
    churn_probability: Math.round(churnProbability * 100) / 100,
    complaint_frequency: complaintFrequency,
    open_ticket_count: openTicketsCount,
    lifetime_value: totalRevenue,
    computed_at: new Date().toISOString(),
  }, { onConflict: "customer_id,organization_id" });
}

export async function listCustomerHealth(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data, error } = await sdb
    .from("support_customer_health_scores")
    .select("*, customer:profiles!customer_id(id, full_name, email)")
    .eq("organization_id", organizationId)
    .order("health_score", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return data;
}
