import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/features/support/services/support-db";
import { listTickets } from "@/features/support/services/support-ticket-service";
import { getSupportDashboard } from "@/features/support/services/support-analytics-service";
import { SupportInbox } from "@/features/support/components/support-inbox";
import { SupportAnalytics } from "@/features/support/components/support-analytics";
import { SupportSlaDashboard } from "@/features/support/components/support-sla-dashboard";
import { listSlaPolicies, getSlaDashboard } from "@/features/support/services/support-sla-service";
import { listSavedViews } from "@/features/support/services/support-saved-views-service";
import { SavedView } from "@/features/support/services/support-saved-views-service";
import { SupportPageClient } from "./support-page-client";

async function SupportContent() {
  const ctx = await requireRole(["super_admin"], "/super-admin");
  const [ticketResult, dashboard, slaPolicies, slaStats] = await Promise.all([
    listTickets({ page: 1, pageSize: 50 }),
    getSupportDashboard(),
    listSlaPolicies(),
    getSlaDashboard(),
  ]);

  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data: savedViewsRow } = await sdb
    .from("user_preferences")
    .select("value")
    .eq("user_id", ctx.userId ?? "")
    .eq("key", "support_saved_views")
    .maybeSingle();

  const savedViewsData = savedViewsRow as { value: SavedView[] } | null;
  const views = savedViewsData?.value ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Enterprise ticket management, SLA monitoring, and customer health tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/super-admin/support/analytics" className="h-9 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center">Analytics</Link>
          <Link href="/super-admin/support/sla" className="h-9 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center">SLA</Link>
          <Link href="/super-admin/support/automation" className="h-9 px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center">Automation</Link>
        </div>
      </div>

      <SupportPageClient ticketResult={ticketResult} dashboard={dashboard} slaPolicies={slaPolicies} slaStats={slaStats} views={views ?? []} />
    </div>
  );
}

function SupportLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><div className="h-8 w-48 bg-muted rounded-lg animate-pulse" /><div className="h-4 w-72 bg-muted rounded animate-pulse mt-2" /></div>
        <div className="flex gap-2"><div className="h-9 w-20 bg-muted rounded-lg animate-pulse" /><div className="h-9 w-16 bg-muted rounded-lg animate-pulse" /><div className="h-9 w-24 bg-muted rounded-lg animate-pulse" /></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      <div className="h-10 bg-muted rounded-lg animate-pulse w-full max-w-md" />
      <div className="h-96 bg-muted rounded-xl animate-pulse" />
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<SupportLoading />}>
      <SupportContent />
    </Suspense>
  );
}
