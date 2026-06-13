import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { listEmergencyOverrides } from "@/features/security/services/security-emergency-service";
import { EmergencyOverrideManager } from "./emergency-manager";

async function EmergencyContent() {
  await requireRole(["super_admin"], "/super-admin");
  const result = await listEmergencyOverrides({ pageSize: 50 });
  return (
    <div className="space-y-6">
      <Link href="/super-admin/security" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.06em]">
        <ChevronLeft className="size-3.5" /> Back to Security
      </Link>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Break-Glass Access</p>
          <h2 className="mt-2 text-2xl font-black">Emergency Override</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Break-glass access workflow for critical situations. Requires justification, MFA, and approval.</p>
        </div>
      </div>
      <EmergencyOverrideManager overrides={result.overrides as Array<Record<string, unknown>>} />
    </div>
  );
}

export default function EmergencyPage() {
  return <Suspense fallback={<div className="space-y-6"><div className="h-5 w-32 bg-muted rounded animate-pulse" /><div className="h-8 w-48 bg-muted rounded-lg animate-pulse" /><div className="h-96 bg-muted rounded-xl animate-pulse" /></div>}><EmergencyContent /></Suspense>;
}
