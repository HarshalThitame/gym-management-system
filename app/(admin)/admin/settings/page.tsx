import type { Metadata } from "next";
import { Building2, Flag, Gauge, Globe2, Settings, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type BranchSettingRow = Database["public"]["Tables"]["branch_settings"]["Row"];
type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
type TenantDomainRow = Database["public"]["Tables"]["tenant_domains"]["Row"];
type HealthCheckRow = Database["public"]["Tables"]["system_health_checks"]["Row"];

export const metadata: Metadata = createMetadata({
  title: "Gym Settings",
  description: "Branch and gym-scoped operational settings for gym administrators.",
  path: "/admin/settings"
});

export default async function AdminSettingsPage() {
  const scope = await requireGymAdminScope("/admin/settings");
  const supabase = await createSupabaseServerClient();
  const [
    gymResult,
    branchesResult,
    domainsResult
  ] = await Promise.all([
    supabase.from("gyms").select("*").eq("id", scope.gymId).maybeSingle(),
    supabase.from("branches").select("*").eq("gym_id", scope.gymId).order("created_at", { ascending: false }),
    supabase.from("tenant_domains").select("*").eq("gym_id", scope.gymId).order("is_primary", { ascending: false }).order("updated_at", { ascending: false }).limit(20)
  ]);
  const branches = branchesResult.data ?? [];
  const branchIds = branches.map((branch) => branch.id);
  const [settingsResult, flagsResult, healthResult] = await Promise.all([
    branchIds.length > 0
      ? supabase.from("branch_settings").select("*").in("branch_id", branchIds).order("updated_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as BranchSettingRow[], error: null }),
    branchIds.length > 0
      ? supabase.from("feature_flags").select("*").in("branch_id", branchIds).order("updated_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as FeatureFlagRow[], error: null }),
    branchIds.length > 0
      ? supabase.from("system_health_checks").select("*").in("branch_id", branchIds).order("checked_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as HealthCheckRow[], error: null })
  ]);
  const gym = gymResult.data;
  const settings = settingsResult.data ?? [];
  const flags = flagsResult.data ?? [];
  const domains = domainsResult.data ?? [];
  const healthChecks = healthResult.data ?? [];
  const activeBranches = branches.filter((branch) => branch.status === "active").length;
  const enabledFlags = flags.filter((flag) => flag.enabled && flag.status === "active").length;
  const verifiedDomains = domains.filter((domain) => domain.status === "verified").length;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Gym Settings</p>
        <h2 className="mt-2 text-3xl font-black">Branch-scoped settings and governance</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          This page is limited to the current gym scope. Organization management, global SaaS settings, subscriptions, backups, and platform monitoring remain in Super Admin or Organization Owner portals.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail={gym?.status ? `Gym status: ${formatEnterpriseLabel(gym.status)}` : "Current authenticated gym scope"} icon={<Building2 className="size-5" />} label="Gym" value={gym?.name ?? "Current Gym"} />
        <StatCard detail={`${activeBranches} active branch records`} icon={<Gauge className="size-5" />} label="Branches" value={String(branches.length)} />
        <StatCard detail={`${enabledFlags} enabled branch-level flags`} icon={<Flag className="size-5" />} label="Feature Flags" value={String(flags.length)} />
        <StatCard detail={`${verifiedDomains} verified gym domains`} icon={<Globe2 className="size-5" />} label="Domains" value={String(domains.length)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-5" />
              <h3 className="text-2xl font-black">Branches</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Branches attached to the current gym only.</p>
          </CardHeader>
          <CardContent>
            <BranchList branches={branches} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="size-5" />
              <h3 className="text-2xl font-black">Branch Settings</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Operational setting records available in this gym scope.</p>
          </CardHeader>
          <CardContent>
            <SettingsList settings={settings} branches={branches} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Flag className="size-5" />
              <h3 className="text-2xl font-black">Feature Flags</h3>
            </div>
          </CardHeader>
          <CardContent>
            <FeatureFlagList flags={flags} branches={branches} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe2 className="size-5" />
              <h3 className="text-2xl font-black">Domains</h3>
            </div>
          </CardHeader>
          <CardContent>
            <DomainList domains={domains} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              <h3 className="text-2xl font-black">Health</h3>
            </div>
          </CardHeader>
          <CardContent>
            <HealthList healthChecks={healthChecks} branches={branches} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function BranchList({ branches }: { branches: BranchRow[] }) {
  if (branches.length === 0) {
    return <EmptyState text="No branch records are attached to this gym yet." />;
  }

  return (
    <div className="space-y-3">
      {branches.map((branch) => (
        <div className="rounded-md border border-border bg-surface-muted p-4" key={branch.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{branch.name}</p>
            <EnterpriseStatusBadge status={branch.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {branch.branch_code} · {[branch.city, branch.state, branch.country].filter(Boolean).join(", ")} · capacity {branch.capacity}
          </p>
        </div>
      ))}
    </div>
  );
}

function SettingsList({ settings, branches }: { settings: BranchSettingRow[]; branches: BranchRow[] }) {
  if (settings.length === 0) {
    return <EmptyState text="No branch settings records are available for this gym." />;
  }

  return (
    <div className="space-y-3">
      {settings.map((setting) => (
        <div className="rounded-md border border-border bg-surface-muted p-4" key={setting.id}>
          <p className="font-black">{branchName(branches, setting.branch_id)}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Updated {formatDate(setting.updated_at)} · membership, payment, attendance, class, notification, and security controls configured.</p>
        </div>
      ))}
    </div>
  );
}

function FeatureFlagList({ flags, branches }: { flags: FeatureFlagRow[]; branches: BranchRow[] }) {
  if (flags.length === 0) {
    return <EmptyState text="No branch feature flags are enabled in this gym scope." />;
  }

  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <div className="rounded-md border border-border bg-surface-muted p-4" key={flag.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{flag.name}</p>
            <EnterpriseStatusBadge status={flag.status} />
            <EnterpriseStatusBadge status={flag.enabled ? "active" : "paused"} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{flag.flag_key} · {branchName(branches, flag.branch_id)} · {flag.rollout_percentage}% rollout</p>
        </div>
      ))}
    </div>
  );
}

function DomainList({ domains }: { domains: TenantDomainRow[] }) {
  if (domains.length === 0) {
    return <EmptyState text="No custom or system domains are linked to this gym." />;
  }

  return (
    <div className="space-y-3">
      {domains.map((domain) => (
        <div className="rounded-md border border-border bg-surface-muted p-4" key={domain.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{domain.domain}</p>
            <EnterpriseStatusBadge status={domain.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatEnterpriseLabel(domain.domain_type)} · SSL {formatEnterpriseLabel(domain.ssl_status)}</p>
        </div>
      ))}
    </div>
  );
}

function HealthList({ healthChecks, branches }: { healthChecks: HealthCheckRow[]; branches: BranchRow[] }) {
  if (healthChecks.length === 0) {
    return <EmptyState text="No branch health checks are available yet." />;
  }

  return (
    <div className="space-y-3">
      {healthChecks.slice(0, 8).map((check) => (
        <div className="rounded-md border border-border bg-surface-muted p-4" key={check.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{formatEnterpriseLabel(check.component)}</p>
            <EnterpriseStatusBadge status={check.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{branchName(branches, check.branch_id)} · {check.latency_ms ?? 0}ms · {check.message ?? "No message"}</p>
        </div>
      ))}
    </div>
  );
}

function branchName(branches: BranchRow[], branchId: string | null) {
  return branches.find((branch) => branch.id === branchId)?.name ?? "Gym branch";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
