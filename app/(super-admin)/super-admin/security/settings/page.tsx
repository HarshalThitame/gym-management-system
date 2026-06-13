import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getMfaPolicies, getMfaStats } from "@/features/security/services/security-mfa-service";
import { getPasswordPolicies } from "@/features/security/services/security-password-service";
import { listNotificationRules } from "@/features/security/services/security-notification-service";

async function SettingsContent() {
  await requireRole(["super_admin"], "/super-admin");
  const [mfaPolicies, mfaStats, passwordPolicy, notificationRules] = await Promise.all([
    getMfaPolicies(), getMfaStats(), getPasswordPolicies(), listNotificationRules(),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/super-admin/security" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="h-4 w-4" /> Back to Security</Link>
      <div><h1 className="text-2xl font-bold tracking-tight">Security Settings</h1><p className="text-sm text-muted-foreground mt-0.5">MFA policies, password policies, and notification rules.</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">MFA Enrollment</p>
          <p className="text-3xl font-bold">{mfaStats.enrollmentRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">{mfaStats.enrolledUsers} of {mfaStats.totalUsers} users enrolled</p>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${mfaStats.enrollmentRate}%` }} />
          </div>
          <div className="mt-3 space-y-1 text-xs">
            {(Object.entries(mfaStats.byMethod) as [string, number][]).map(([method, count]) => (
              <div key={method} className="flex justify-between"><span className="capitalize">{method}</span><span className="font-mono">{count}</span></div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Password Policy</p>
          {passwordPolicy ? (
            <div className="space-y-1.5 text-xs">
              <Row label="Min Length" value={String(passwordPolicy.min_length ?? 10)} />
              <Row label="Expiration" value={passwordPolicy.expiration_days ? `${passwordPolicy.expiration_days} days` : "Never"} />
              <Row label="History" value={`${passwordPolicy.history_count ?? 5} passwords`} />
              <Row label="Failed Attempts" value={`${passwordPolicy.max_failed_attempts ?? 5} before lockout`} />
              <Row label="Lockout Duration" value={`${passwordPolicy.lockout_duration_minutes ?? 30} min`} />
              <Row label="Prevent Common" value={passwordPolicy.prevent_common ? "Yes" : "No"} />
              <Row label="Prevent Breached" value={passwordPolicy.prevent_breached ? "Yes" : "No"} />
            </div>
          ) : <p className="text-xs text-muted-foreground">Default policy active</p>}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">MFA Policies</p>
          {mfaPolicies.length === 0 ? <p className="text-xs text-muted-foreground">No custom MFA policies</p> : (
            <div className="space-y-2">
              {mfaPolicies.slice(0, 5).map((p: { id: string; name: string; requirement: string }, i: number) => (
                <div key={p.id ?? i} className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate">{p.name}</span>
                  <span className="text-muted-foreground capitalize">{p.requirement?.replace(/_/g, " ") ?? ""}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <Link href="/super-admin/security/mfa" className="text-xs text-primary hover:underline">Manage MFA Settings →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

export default function SettingsPage() {
  return <Suspense fallback={<div className="h-96 bg-muted rounded-xl animate-pulse" />}><SettingsContent /></Suspense>;
}
