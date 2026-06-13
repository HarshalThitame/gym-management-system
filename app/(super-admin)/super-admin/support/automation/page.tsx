import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/features/support/services/support-db";
import { AutomationPageClient } from "./automation-page-client";

async function AutomationContent() {
  await requireRole(["super_admin"], "/super-admin");
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data: rules } = await sdb.from("support_automation_rules").select("*").order("priority", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Automation Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure IF-THEN workflow automation for tickets, SLAs, and notifications.</p>
      </div>
      <AutomationPageClient rules={rules ?? []} />
    </div>
  );
}

export default function AutomationPage() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <AutomationContent />
    </Suspense>
  );
}
