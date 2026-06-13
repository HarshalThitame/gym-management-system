import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getRecentSecurityEvents } from "@/features/security/services/security-dashboard-service";
import { getRiskTrends } from "@/features/security/services/security-risk-service";
import { getThreatIntelStats } from "@/features/security/services/security-threat-intel-service";
import { SecurityAnalyticsCharts } from "./analytics-charts";

async function AnalyticsContent() {
  await requireRole(["super_admin"], "/super-admin");
  const [events, riskTrends, threatStats] = await Promise.all([
    getRecentSecurityEvents(5000), getRiskTrends(14), getThreatIntelStats(),
  ]);
  const eventsList = events as Array<Record<string, unknown>>;
  const severityCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const e of eventsList) {
    severityCounts[String(e.severity)] = (severityCounts[String(e.severity)] ?? 0) + 1;
    if (e.incident_category) categoryCounts[String(e.incident_category)] = (categoryCounts[String(e.incident_category)] ?? 0) + 1;
  }
  return (
    <div className="space-y-6">
      <Link href="/super-admin/security" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.06em]">
        <ChevronLeft className="size-3.5" /> Back to Security
      </Link>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Threat Intelligence</p>
          <h2 className="mt-2 text-2xl font-black">Security Analytics</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Attack trends, threat categories, and risk distribution across the platform.</p>
        </div>
      </div>
      <SecurityAnalyticsCharts totalEvents={eventsList.length} severityCounts={severityCounts} categoryCounts={categoryCounts} riskTrends={riskTrends as Array<Record<string, unknown>>} threatStats={threatStats} />
    </div>
  );
}

export default function AnalyticsPage() {
  return <Suspense fallback={<div className="space-y-6"><div className="h-5 w-32 bg-muted rounded animate-pulse" /><div className="h-8 w-48 bg-muted rounded-lg animate-pulse" /><div className="h-96 bg-muted rounded-xl animate-pulse" /></div>}><AnalyticsContent /></Suspense>;
}
