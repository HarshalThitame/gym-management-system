import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { searchAuditLogs, getAuditStats } from "@/features/security/services/security-audit-service";
import { SecurityAuditLog } from "@/features/security/components/security-audit-log";

async function AuditContent() {
  await requireRole(["super_admin"], "/super-admin");
  const [result, stats] = await Promise.all([searchAuditLogs({ pageSize: 50 }), getAuditStats()]);
  return (
    <div className="space-y-6">
      <Link href="/super-admin/security" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.06em]">
        <ChevronLeft className="size-3.5" /> Back to Security
      </Link>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Audit & Compliance</p>
          <h2 className="mt-2 text-2xl font-black">Audit Logs</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Immutable audit trail of all platform actions. <span className="font-medium">{stats.total.toLocaleString()}</span> total events · <span className="font-medium">{stats.today}</span> today</p>
        </div>
      </div>
      <SecurityAuditLog logs={result.logs as Array<Record<string, unknown>>} total={result.total} />
    </div>
  );
}

export default function AuditPage() {
  return <Suspense fallback={<div className="space-y-6"><div className="h-5 w-32 bg-muted rounded animate-pulse" /><div className="h-8 w-48 bg-muted rounded-lg animate-pulse" /><div className="h-96 bg-muted rounded-xl animate-pulse" /></div>}><AuditContent /></Suspense>;
}
