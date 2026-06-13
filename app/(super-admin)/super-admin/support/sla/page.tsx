import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { listSlaPolicies, getSlaDashboard } from "@/features/support/services/support-sla-service";
import { SupportSlaDashboard } from "@/features/support/components/support-sla-dashboard";

async function SlaContent() {
  await requireRole(["super_admin"], "/super-admin");
  const [policies, slaStats] = await Promise.all([
    listSlaPolicies(),
    getSlaDashboard(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SLA Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure and monitor Service Level Agreements across all tenants.</p>
      </div>
      <SupportSlaDashboard policies={policies} slaStats={slaStats} />
    </div>
  );
}

export default function SlaPage() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <SlaContent />
    </Suspense>
  );
}
