import { Suspense } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getSecurityDashboard, getSecurityKpis, getRecentSecurityEvents, getTenantRiskRanking } from "@/features/security/services/security-dashboard-service";
import { SecurityDashboard } from "@/features/security/components/security-dashboard";

async function SecurityContent() {
  await requireRole(["super_admin"], "/super-admin");
  const [dashboard, recentEvents, tenantRisk] = await Promise.all([
    getSecurityDashboard(),
    getRecentSecurityEvents(20),
    getTenantRiskRanking(),
  ]);
  const kpis = await getSecurityKpis(dashboard);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Platform Security</p>
          <h2 className="mt-2 text-2xl font-black md:text-3xl">Security Center</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground max-w-2xl">Enterprise security monitoring, incident response, risk-based authentication, and compliance management.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/super-admin/security/audit" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted transition-colors uppercase tracking-[0.06em]">Audit</Link>
          <Link href="/super-admin/security/incidents" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted transition-colors uppercase tracking-[0.06em]">Incidents</Link>
          <Link href="/super-admin/security/investigate" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted transition-colors uppercase tracking-[0.06em]">Investigate</Link>
          <Link href="/super-admin/security/sessions" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted transition-colors uppercase tracking-[0.06em]">Sessions</Link>
          <Link href="/super-admin/security/analytics" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted transition-colors uppercase tracking-[0.06em]">Analytics</Link>
          <Link href="/super-admin/security/settings" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted transition-colors uppercase tracking-[0.06em]">Settings</Link>
        </div>
      </div>
      <SecurityDashboard dashboard={dashboard} kpis={kpis} recentEvents={recentEvents} tenantRisk={tenantRisk} />
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><div className="h-8 w-48 bg-muted rounded-lg animate-pulse" /><div className="h-4 w-64 bg-muted rounded animate-pulse mt-2" /></div><div className="flex gap-2"><div className="h-9 w-20 bg-muted rounded-lg animate-pulse" /><div className="h-9 w-24 bg-muted rounded-lg animate-pulse" /></div></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="h-96 bg-muted rounded-xl animate-pulse" /><div className="h-96 bg-muted rounded-xl animate-pulse" /></div>
    </div>
  );
}

export default function SecurityPage() {
  return <Suspense fallback={<Loading />}><SecurityContent /></Suspense>;
}
