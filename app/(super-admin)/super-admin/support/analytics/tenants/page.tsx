import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { getTenantSupportMetrics } from "@/features/support/services/support-analytics-service";
import { SupportTenantAnalytics } from "@/features/support/components/support-tenant-analytics";

async function TenantAnalyticsContent() {
  await requireRole(["super_admin"], "/super-admin");
  const metrics = await getTenantSupportMetrics();
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Tenant Analytics</h1><p className="text-sm text-muted-foreground mt-1">Support metrics broken down by tenant organization.</p></div>
      <SupportTenantAnalytics metrics={metrics} />
    </div>
  );
}

export default function TenantAnalyticsPage() {
  return <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}><TenantAnalyticsContent /></Suspense>;
}
