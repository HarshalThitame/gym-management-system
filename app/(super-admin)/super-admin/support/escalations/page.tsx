import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { getEscalationSummary } from "@/features/support/services/support-escalation-service";
import { SupportEscalationMatrix } from "@/features/support/components/support-escalation-matrix";

async function EscalationsContent() {
  await requireRole(["super_admin"], "/super-admin");
  const summary = await getEscalationSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Escalation Matrix</h1>
        <p className="text-sm text-muted-foreground mt-1">Track active escalations across all 5 support levels and manage escalation rules.</p>
      </div>
      <SupportEscalationMatrix
        byLevel={summary.byLevel}
        activeEscalations={summary.activeEscalations as Record<string, unknown>[]}
        escalationRules={summary.escalationRules as Record<string, unknown>[]}
      />
    </div>
  );
}

export default function EscalationsPage() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <EscalationsContent />
    </Suspense>
  );
}
