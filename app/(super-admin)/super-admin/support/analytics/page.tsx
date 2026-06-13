import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { getSupportDashboard } from "@/features/support/services/support-analytics-service";
import { SupportAnalytics } from "@/features/support/components/support-analytics";

async function AnalyticsContent() {
  await requireRole(["super_admin"], "/super-admin");
  const dashboard = await getSupportDashboard();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide support metrics, trends, and agent performance.</p>
      </div>
      <SupportAnalytics dashboard={dashboard} />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <AnalyticsContent />
    </Suspense>
  );
}
