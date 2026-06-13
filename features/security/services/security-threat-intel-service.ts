import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sdb } from "./security-db";

const KNOWN_MALICIOUS_IPS = ["10.0.0.1", "192.168.1.1"];

export async function checkIpReputation(ipAddress: string): Promise<{ score: number; isMalicious: boolean; category: string | null }> {
  if (KNOWN_MALICIOUS_IPS.includes(ipAddress)) {
    return { score: 85, isMalicious: true, category: "known_malicious" };
  }
  return { score: 0, isMalicious: false, category: null };
}

export async function cacheThreatIndicator(indicator: { type: string; value: string; score: number; category?: string; source?: string }) {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);
  await db.from("threat_intel_cache").upsert({
    indicator_type: indicator.type,
    indicator_value: indicator.value,
    threat_score: indicator.score,
    category: indicator.category ?? null,
    source: indicator.source ?? "internal",
    is_malicious: indicator.score > 50,
    last_checked_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  }, { onConflict: "indicator_type,indicator_value" });
}

export async function getThreatIntelStats() {
  const supabase = await createSupabaseServerClient();
  const db = sdb(supabase as unknown);

  const [total, malicious, byType] = await Promise.all([
    db.from("threat_intel_cache").select("*", { count: "exact", head: true }),
    db.from("threat_intel_cache").select("*", { count: "exact", head: true }).eq("is_malicious", true),
    db.from("threat_intel_cache").select("indicator_type", { count: "exact" }),
  ]);

  const typeCounts: Record<string, number> = {};
  for (const t of (byType.data ?? []) as Array<Record<string, unknown>>) {
    const it = t.indicator_type as string;
    typeCounts[it] = (typeCounts[it] ?? 0) + 1;
  }

  return { total: total.count ?? 0, malicious: malicious.count ?? 0, byType: typeCounts };
}
