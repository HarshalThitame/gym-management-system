import { getSupabaseClient } from "@/api/supabase";

export interface LoadTestResult {
  name: string;
  records: number;
  durationMs: number;
  avgMs: number;
  passed: boolean;
}

export async function runLoadTests(orgId: string): Promise<LoadTestResult[]> {
  const results: LoadTestResult[] = [];
  const supabase = getSupabaseClient();

  const test = async (name: string, fn: () => Promise<any>, minRecords: number) => {
    const start = Date.now();
    try {
      const { data, count } = await fn();
      const duration = Date.now() - start;
      const recordCount = count ?? (Array.isArray(data) ? data.length : 0);
      results.push({
        name,
        records: recordCount,
        durationMs: duration,
        avgMs: recordCount > 0 ? Math.round(duration / recordCount) : duration,
        passed: recordCount >= minRecords,
      });
    } catch (error) {
      results.push({ name, records: 0, durationMs: Date.now() - start, avgMs: 0, passed: false });
    }
  };

  await test("Attendance: 30-day records", () =>
    supabase.from("attendance_sessions").select("*", { count: "exact", head: false }).eq("organization_id", orgId).gte("check_in_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(100), 0);

  await test("Payments: MTD transactions", () =>
    supabase.from("payments").select("*", { count: "exact", head: false }).eq("organization_id", orgId).eq("status", "paid").gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).limit(100), 0);

  await test("Members: Active count", () =>
    supabase.from("members").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"), 0);

  await test("Leads: Pipeline count", () =>
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", orgId), 0);

  await test("Memberships: Active", () =>
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"), 0);

  return results;
}

export function analyzeLoadResults(results: LoadTestResult[]): { score: number; summary: string; warnings: string[] } {
  const avgDurations = results.filter((r) => r.passed).map((r) => r.avgMs);
  const avg = avgDurations.length > 0 ? Math.round(avgDurations.reduce((a, b) => a + b, 0) / avgDurations.length) : 0;
  const warnings: string[] = [];

  for (const r of results) {
    if (r.durationMs > 5000) warnings.push(`${r.name}: ${r.durationMs}ms exceeds 5s threshold`);
    if (!r.passed) warnings.push(`${r.name}: returned 0 records`);
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - (avg / 50))));
  const summary = avg < 20 ? "Excellent" : avg < 50 ? "Good" : avg < 100 ? "Fair" : "Needs Optimization";

  return { score, summary, warnings };
}
