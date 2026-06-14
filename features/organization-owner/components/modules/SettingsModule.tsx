"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, Download, Gauge, Settings as SettingsIcon, ShieldCheck, ToggleLeft, ToggleRight, XCircle } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { toggleFeatureFlagAction } from "@/features/organization-owner/actions/settings-actions";

type SettingsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function SettingsEnterpriseModule({ dashboard, moduleData }: SettingsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [activeTab, setActiveTab] = useState<"flags" | "branch" | "compliance" | "notifications">("flags");
  const [flagFilter, setFlagFilter] = useState<string>("all");

  const flags = (moduleData?.items ?? dashboard.featureFlags) as typeof dashboard.featureFlags;
  const branchSettings = dashboard.branchSettings;
  const complianceRequests = dashboard.complianceRequests;
  const tenantConfigs = dashboard.tenantConfigs;

  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q }); }, [navigate]);

  const handleToggleFlag = useCallback(async (flagId: string, current: boolean) => {
    const fd = new FormData(); fd.set("flagId", flagId); fd.set("enabled", String(!current));
    const r = await toggleFeatureFlagAction({ status: "idle", message: null } as never, fd);
    showToast(r.message || "Toggled", r.status === "success" ? "success" : "error");
  }, []);

  // ── KPIs ──
  const enabledFlags = flags.filter((f) => f.enabled).length;
  const activeFlags = flags.filter((f) => f.status === "active").length;
  const openCompliance = complianceRequests.filter((c) => c.status === "open" || c.status === "in_review").length;

  // ── Filtered flags ──
  const filteredFlags = flags.filter((f) => {
    if (flagFilter === "enabled") return f.enabled;
    if (flagFilter === "disabled") return !f.enabled;
    return true;
  });

  const flagItems = filteredFlags.map((f) => ({
    id: f.id,
    title: f.name,
    subtitle: `Key: ${f.flag_key}`,
    meta: `Rollout: ${f.rollout_percentage ?? 0}% · Status: ${f.status}`,
    badge: f.enabled ? "Enabled" : "Disabled",
    badgeVariant: (f.enabled ? "success" : "neutral") as "success" | "neutral",
    sections: [
      { label: "Key", value: f.flag_key },
      { label: "Enabled", value: f.enabled ? "Yes" : "No" },
      { label: "Rollout", value: `${f.rollout_percentage ?? 0}%` },
      { label: "Status", value: f.status },
    ],
    actions: [
      {
        label: f.enabled ? "Disable" : "Enable",
        onClick: () => handleToggleFlag(f.id, f.enabled),
        variant: "secondary" as const,
        icon: f.enabled ? <XCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />
      }
    ]
  }));

  // ── Branch settings as items ──
  const branchItems = branchSettings.map((bs) => ({
    id: bs.id,
    title: dashboard.branches.find((b) => b.id === bs.branch_id)?.name ?? "Unknown Branch",
    subtitle: `Settings ID: ${bs.id.slice(0, 8)}`,
    meta: `Updated: ${new Date(bs.updated_at).toLocaleDateString("en-IN")}`,
    badge: "configured",
    badgeVariant: "info" as const,
    sections: Object.entries(bs).filter(([k]) => k.endsWith("_settings")).filter(([, v]) => v).map(([k]) => ({
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: "Configured"
    })),
    actions: []
  }));

  // ── Compliance items ──
  const complianceItems = complianceRequests.map((cr) => ({
    id: cr.id,
    title: formatEnterpriseLabel(cr.request_type),
    subtitle: cr.status,
    meta: new Date(cr.created_at).toLocaleDateString("en-IN"),
    badge: cr.status,
    badgeVariant: (cr.status === "completed" ? "success" : cr.status === "open" ? "warning" : "info") as "success" | "warning" | "info",
    sections: [
      { label: "Type", value: formatEnterpriseLabel(cr.request_type) },
      { label: "Status", value: cr.status },
      { label: "Created", value: new Date(cr.created_at).toLocaleDateString("en-IN") },
    ],
    actions: []
  }));

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Feature flags controlling platform behavior" icon={<Gauge className="size-5" />} label="Flags" value={String(flags.length)} />
        <StatCard detail="Feature flags currently enabled" icon={<CheckCircle2 className="size-5" />} label="Enabled" value={String(enabledFlags)} />
        <StatCard detail="Branch-level configuration records" icon={<SettingsIcon className="size-5" />} label="Branch Settings" value={String(branchSettings.length)} />
        <StatCard detail="Active compliance requests" icon={<ShieldCheck className="size-5" />} label="Open Compliance" status={openCompliance > 0 ? "watch" : "good"} value={String(openCompliance)} />
      </section>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
        {(["flags", "branch", "compliance", "notifications"] as const).map((tab) => (
          <button key={tab} className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab} type="button">
            {tab === "flags" ? "Feature Flags" : tab === "branch" ? "Branch Settings" : tab === "compliance" ? "Compliance" : "Notifications"}
          </button>
        ))}
      </div>

      {/* ═══ TAB: FEATURE FLAGS ═══ */}
      {activeTab === "flags" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["all", "enabled", "disabled"] as const).map((f) => (
              <button key={f} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${flagFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-surface text-muted-foreground hover:text-foreground"}`} onClick={() => setFlagFilter(f)} type="button">
                {f === "all" ? "All" : f === "enabled" ? "Enabled" : "Disabled"} {f === "all" ? `(${flags.length})` : f === "enabled" ? `(${enabledFlags})` : `(${flags.length - enabledFlags})`}
              </button>
            ))}
          </div>
          <DataList
            selectable
            bulkActions={[
              { label: "Export CSV", onClick: (ids) => {
                const data = flags.filter((f) => ids.includes(f.id)).map((f) => ({ name: f.name, key: f.flag_key, enabled: f.enabled, rollout: f.rollout_percentage, status: f.status }));
                exportToCSV(data, "flags-selected");
              }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
            ]}
            headerTitle="Feature Flags"
            items={flagItems}
            totalItems={filteredFlags.length}
            totalPages={Math.ceil(filteredFlags.length / (filters.pageSize ?? 12))}
            currentPage={currentPage}
            onPageChange={(p) => navigate({ page: p })}
            pageSize={filters.pageSize ?? 12}
          />
        </div>
      ) : null}

      {/* ═══ TAB: BRANCH SETTINGS ═══ */}
      {activeTab === "branch" ? (
        <div className="space-y-4">
          {branchSettings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
              <SettingsIcon className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">No branch settings configured</p>
              <p className="mt-1 text-xs text-muted-foreground">Branch settings will appear here once configured for each branch location.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{branchSettings.length} branch{branchSettings.length !== 1 ? "es" : ""} have custom settings configured.</p>
              <DataList
                headerTitle="Branch Configurations"
                items={branchItems}
                totalItems={branchSettings.length}
                totalPages={Math.ceil(branchSettings.length / 12)}
                currentPage={currentPage}
                onPageChange={(p) => navigate({ page: p })}
                pageSize={filters.pageSize ?? 12}
              />
            </>
          )}
        </div>
      ) : null}

      {/* ═══ TAB: COMPLIANCE ═══ */}
      {activeTab === "compliance" ? (
        <div className="space-y-4">
          {complianceRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
              <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">No compliance requests</p>
              <p className="mt-1 text-xs text-muted-foreground">Data export, deletion, and consent requests will appear here.</p>
            </div>
          ) : (
            <DataList
              headerTitle="Compliance Requests"
              items={complianceItems}
              totalItems={complianceRequests.length}
              totalPages={Math.ceil(complianceRequests.length / 12)}
              currentPage={currentPage}
              onPageChange={(p) => navigate({ page: p })}
              pageSize={filters.pageSize ?? 12}
            />
          )}
        </div>
      ) : null}

      {/* ═══ TAB: NOTIFICATIONS ═══ */}
      {activeTab === "notifications" ? (
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Notification Preferences</h3>
            <p className="text-sm text-muted-foreground">Configure how your organization receives alerts and updates</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "billing_alerts", label: "Billing Alerts", desc: "Payment failures, invoice ready, subscription renewal", enabled: true },
              { key: "security_alerts", label: "Security Alerts", desc: "Suspicious logins, unauthorized access, MFA changes", enabled: true },
              { key: "member_activity", label: "Member Activity", desc: "New member signups, membership expirations, freeze requests", enabled: false },
              { key: "staff_changes", label: "Staff Changes", desc: "Staff invite accepted, role changes, deactivations", enabled: true },
              { key: "system_updates", label: "System Updates", desc: "Platform maintenance, new features, version updates", enabled: true },
              { key: "domain_health", label: "Domain Health", desc: "SSL expiry, DNS check failures, domain verification", enabled: false },
            ].map((pref) => (
              <div key={pref.key} className="flex items-center justify-between rounded-md border border-border bg-background p-4">
                <div>
                  <p className="text-sm font-bold">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">{pref.desc}</p>
                </div>
                <button
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${pref.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-muted-foreground"}`}
                  onClick={() => showToast(`${pref.label} ${pref.enabled ? "disabled" : "enabled"}`, "success")}
                  type="button"
                >
                  {pref.enabled ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                  {pref.enabled ? "On" : "Off"}
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
