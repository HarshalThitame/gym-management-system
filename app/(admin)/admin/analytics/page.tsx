import { getEventStatsAction, getFunnelsAction, getReportsAction } from "@/features/analytics/actions/analytics-actions";
import { AnalyticsDashboard } from "@/features/analytics/components/analytics-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Advanced Analytics", description: "Event analytics, funnels, and reports" };

export default async function AnalyticsPage() {
  let stats: Awaited<ReturnType<typeof getEventStatsAction>> = [];
  let funnels: Awaited<ReturnType<typeof getFunnelsAction>> = [];
  let reports: Awaited<ReturnType<typeof getReportsAction>> = [];

  try {
    [stats, funnels, reports] = await Promise.all([
      getEventStatsAction(),
      getFunnelsAction(),
      getReportsAction(),
    ]);
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Analytics</p>
            <h2 className="text-3xl font-black">Advanced Analytics</h2>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Track events, analyze funnels, and generate insights about your gym operations.
        </p>
      </div>

      <AnalyticsDashboard stats={stats} funnels={funnels} reports={reports} />
    </div>
  );
}
