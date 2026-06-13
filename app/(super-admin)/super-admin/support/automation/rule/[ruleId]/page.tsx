import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/features/support/services/support-db";
import type { SupportAutomationRuleRow } from "@/types/enterprise";

async function RuleDetailContent({ ruleId }: { ruleId: string }) {
  await requireRole(["super_admin"], "/super-admin");
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: rule } = await sdb.from("support_automation_rules").select("*").eq("id", ruleId).single();
  if (!rule) notFound();

  const r = rule as SupportAutomationRuleRow;

  return (
    <div className="space-y-6">
      <Link href="/super-admin/support/automation" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Automation Rules
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{r.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{r.description ?? "No description"}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trigger Event</p>
          <p className="text-sm font-medium mt-1 capitalize">{r.trigger_event.replace(/_/g, " ")}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Priority</p>
          <p className="text-sm font-medium mt-1">{r.priority}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Execution Count</p>
          <p className="text-sm font-medium mt-1">{r.execution_count}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Conditions</p>
          <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-auto max-h-60">
            {JSON.stringify(r.conditions, null, 2)}
          </pre>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actions</p>
          <pre className="text-xs font-mono bg-muted rounded-md p-3 overflow-auto max-h-60">
            {JSON.stringify(r.actions, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default async function RuleDetailPage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <RuleDetailContent ruleId={ruleId} />
    </Suspense>
  );
}
