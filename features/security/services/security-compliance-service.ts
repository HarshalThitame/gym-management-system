import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

export async function getComplianceStatus() {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const [gdprResult, soc2Result, auditResult] = await Promise.all([
    db.from("compliance_requests").select("*", { count: "exact" }).gte("created_at", new Date(Date.now() - 365 * 86400000).toISOString()),
    db.from("compliance_reports").select("*", { count: "exact" }).eq("report_type", "soc2").gte("created_at", new Date(Date.now() - 365 * 86400000).toISOString()),
    db.from("audit_logs").select("*", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()),
  ]);

  return {
    gdprRequests: gdprResult.count ?? 0,
    soc2Reports: soc2Result.count ?? 0,
    auditLogs90d: auditResult.count ?? 0,
    status: "compliant" as const,
  };
}

export async function listComplianceReports(organizationId?: string) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  let q = db.from("compliance_reports").select("*, generator:profiles!generated_by(id, full_name)");
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data } = await q.order("created_at", { ascending: false });
  return data ?? [];
}

export async function generateComplianceReport(input: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  const { data, error } = await db.from("compliance_reports").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
