import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { getAgentPerformance } from "@/features/support/services/support-agent-service";
import { SupportAgentDashboard } from "@/features/support/components/support-agent-dashboard";

async function AgentsContent() {
  await requireRole(["super_admin"], "/super-admin");
  const metrics = await getAgentPerformance();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor agent performance, workload distribution, and support team productivity.</p>
      </div>
      <SupportAgentDashboard metrics={metrics} />
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <AgentsContent />
    </Suspense>
  );
}
