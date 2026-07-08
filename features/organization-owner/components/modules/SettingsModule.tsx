"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, Download, ExternalLink, Gauge, Settings as SettingsIcon, ShieldCheck, ToggleLeft, ToggleRight, XCircle } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { StatCard } from "@/components/ui/stat-card";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { saveBranchSettingAction, toggleFeatureFlagAction } from "@/features/organization-owner/actions/settings-actions";
import { useHasFeature } from "@/features/organization-owner/entitlements/entitlement-provider";
import { GoogleCalendarPanel } from "@/features/organization-owner/components/modules/GoogleCalendarPanel";
import { WebhookPanel } from "@/features/organization-owner/components/modules/WebhookPanel";

type SettingsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

export function SettingsEnterpriseModule({ dashboard, moduleData }: SettingsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [activeTab, setActiveTab] = useState<"flags" | "branch" | "compliance" | "notifications" | "integrations_calendar" | "integrations_webhooks">("flags");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [geofenceBranchId, setGeofenceBranchId] = useState<string>(dashboard.branches[0]?.id ?? "");
  const [geofenceEnabled, setGeofenceEnabled] = useState<boolean>(true);
  const [geofenceRadiusM, setGeofenceRadiusM] = useState<string>("150");
  const [geofenceOutsideSampleThreshold, setGeofenceOutsideSampleThreshold] = useState<string>("2");
  const [geofenceMinAccuracyM, setGeofenceMinAccuracyM] = useState<string>("50");
  const [geofenceExitGraceSeconds, setGeofenceExitGraceSeconds] = useState<string>("120");
  const [geofenceStaleTimeoutMinutes, setGeofenceStaleTimeoutMinutes] = useState<string>("5");
  const [geofenceSaving, setGeofenceSaving] = useState(false);
  const hasGoogleCalendar = useHasFeature("google_calendar_sync");
  const hasWebhooks = useHasFeature("webhooks");

  const flags = (moduleData?.items ?? dashboard.featureFlags) as typeof dashboard.featureFlags;
  const branchSettings = dashboard.branchSettings;
  const complianceRequests = dashboard.complianceRequests;

  const handleToggleFlag = useCallback(async (flagId: string, current: boolean) => {
    const fd = new FormData(); fd.set("flagId", flagId); fd.set("enabled", String(!current));
    const r = await toggleFeatureFlagAction({ status: "idle", message: null } as never, fd);
    showToast(r.message || "Toggled", r.status === "success" ? "success" : "error");
  }, []);

  useEffect(() => {
    const selected = branchSettings.find((item) => item.branch_id === geofenceBranchId);
    const attendanceSettings = (selected?.attendance_settings ?? {}) as Record<string, unknown>;
    if (selected) {
      setGeofenceEnabled(attendanceSettings.geo_fence_enabled === true || attendanceSettings.geo_fence_enabled === "true");
      setGeofenceRadiusM(String(attendanceSettings.geo_fence_radius_m ?? 150));
      setGeofenceOutsideSampleThreshold(String(attendanceSettings.geo_fence_outside_sample_threshold ?? 2));
      setGeofenceMinAccuracyM(String(attendanceSettings.geo_fence_min_accuracy_m ?? 50));
      setGeofenceExitGraceSeconds(String(attendanceSettings.geo_fence_exit_grace_seconds ?? 120));
      setGeofenceStaleTimeoutMinutes(String(attendanceSettings.geo_fence_stale_timeout_minutes ?? 5));
    }
  }, [branchSettings, geofenceBranchId]);

  const handleSaveGeofence = useCallback(async () => {
    if (!geofenceBranchId) return;
    setGeofenceSaving(true);
    try {
      const fd = new FormData();
      fd.set("branchId", geofenceBranchId);
      fd.set("settingsKey", "attendance");
      fd.set("settingsValue", JSON.stringify({
        geo_fence_enabled: geofenceEnabled,
        geo_fence_radius_m: Number(geofenceRadiusM) > 0 ? Number(geofenceRadiusM) : 150,
        geo_fence_outside_sample_threshold: Number(geofenceOutsideSampleThreshold) >= 1 ? Number(geofenceOutsideSampleThreshold) : 2,
        geo_fence_min_accuracy_m: Number(geofenceMinAccuracyM) > 0 ? Number(geofenceMinAccuracyM) : 50,
        geo_fence_exit_grace_seconds: Number(geofenceExitGraceSeconds) > 0 ? Number(geofenceExitGraceSeconds) : 120,
        geo_fence_stale_timeout_minutes: Number(geofenceStaleTimeoutMinutes) > 0 ? Number(geofenceStaleTimeoutMinutes) : 5,
      }));
      const r = await saveBranchSettingAction({ status: "idle", message: null } as never, fd);
      showToast(r.message || "Geofence settings saved.", r.status === "success" ? "success" : "error");
    } finally {
      setGeofenceSaving(false);
    }
  }, [geofenceBranchId, geofenceEnabled, geofenceRadiusM, geofenceExitGraceSeconds, geofenceMinAccuracyM, geofenceOutsideSampleThreshold, geofenceStaleTimeoutMinutes]);

  // ── KPIs ──
  const enabledFlags = flags.filter((f) => f.enabled).length;
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
        <StatCard detail="Branch-level configuration records" icon={<SettingsIcon className="size-5" />} label="Gym Settings" value={String(branchSettings.length)} />
        <StatCard detail="Active compliance requests" icon={<ShieldCheck className="size-5" />} label="Open Compliance" status={openCompliance > 0 ? "watch" : "good"} value={String(openCompliance)} />
      </section>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 flex-wrap" role="tablist">
        {(["flags", "branch", "compliance", "notifications"] as const).map((tab) => (
          <button key={tab} className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab} type="button">
            {tab === "flags" ? "Feature Flags" : tab === "branch" ? "Gym Settings" : tab === "compliance" ? "Compliance" : "Notifications"}
          </button>
        ))}
        {(hasGoogleCalendar || hasWebhooks) && (
          <span className="flex items-center px-2 text-xs font-bold text-muted-foreground whitespace-nowrap">Integrations:</span>
        )}
        {hasGoogleCalendar && (
          <button
            className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition flex items-center gap-1.5 ${activeTab === "integrations_calendar" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("integrations_calendar")}
            role="tab"
            aria-selected={activeTab === "integrations_calendar"}
            type="button"
          >
            <Calendar className="size-3.5" /> Calendar
          </button>
        )}
        {hasWebhooks && (
          <button
            className={`flex-1 rounded-md px-4 py-2 text-sm font-bold transition flex items-center gap-1.5 ${activeTab === "integrations_webhooks" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("integrations_webhooks")}
            role="tab"
            aria-selected={activeTab === "integrations_webhooks"}
            type="button"
          >
            <ExternalLink className="size-3.5" /> Webhooks
          </button>
        )}
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
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Geofence Attendance</h3>
              <p className="text-sm text-muted-foreground">Configure the gym geofence used for location reporting and checkout-only auto-checkout.</p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Branch</span>
                <select
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  value={geofenceBranchId}
                  onChange={(event) => setGeofenceBranchId(event.target.value)}
                >
                  {dashboard.branches.map((branch) => (
                    <option key={branch.id as string} value={branch.id as string}>
                      {branch.name as string}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Radius (meters)</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  type="number"
                  min={25}
                  step={5}
                  value={geofenceRadiusM}
                  onChange={(event) => setGeofenceRadiusM(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Outside samples before checkout</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  type="number"
                  min={1}
                  step={1}
                  value={geofenceOutsideSampleThreshold}
                  onChange={(event) => setGeofenceOutsideSampleThreshold(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Minimum accuracy (meters)</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  type="number"
                  min={1}
                  step={1}
                  value={geofenceMinAccuracyM}
                  onChange={(event) => setGeofenceMinAccuracyM(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exit grace window (seconds)</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  type="number"
                  min={1}
                  step={1}
                  value={geofenceExitGraceSeconds}
                  onChange={(event) => setGeofenceExitGraceSeconds(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stale tracker timeout (minutes)</span>
                <input
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  type="number"
                  min={1}
                  step={1}
                  value={geofenceStaleTimeoutMinutes}
                  onChange={(event) => setGeofenceStaleTimeoutMinutes(event.target.value)}
                />
              </label>
              <label className="flex items-center gap-3 rounded-md border border-border bg-surface-muted px-3 py-3 md:col-span-2">
                <input
                  checked={geofenceEnabled}
                  className="size-4"
                  onChange={(event) => setGeofenceEnabled(event.target.checked)}
                  type="checkbox"
                />
                <div>
                  <p className="text-sm font-bold">Enable checkout geofence</p>
                  <p className="text-xs text-muted-foreground">Members are checked out automatically when they leave the selected radius. Check-in remains button- or reader-driven.</p>
                </div>
              </label>
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50 md:col-span-2"
                disabled={geofenceSaving || !geofenceBranchId}
                onClick={() => void handleSaveGeofence()}
                type="button"
              >
                {geofenceSaving ? "Saving..." : "Save geofence settings"}
              </button>
            </CardContent>
          </Card>
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
                headerTitle="Gym Configurations"
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

      {/* ═══ TAB: INTEGRATIONS — GOOGLE CALENDAR ═══ */}
      {activeTab === "integrations_calendar" && (
        <GoogleCalendarPanel dashboard={dashboard} hasFeature={hasGoogleCalendar} />
      )}

      {/* ═══ TAB: INTEGRATIONS — WEBHOOKS ═══ */}
      {activeTab === "integrations_webhooks" && (
        <WebhookPanel dashboard={dashboard} hasFeature={hasWebhooks} />
      )}
    </div>
  );
}
