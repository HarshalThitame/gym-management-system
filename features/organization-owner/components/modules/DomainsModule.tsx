"use client";

/* eslint-disable @typescript-eslint/no-require-imports */

import { useCallback, useMemo, useState, useActionState } from "react";
import { CheckCircle2, Copy, Download, Eye, Globe2, Plus, ShieldCheck, Star, Trash2 } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { addDomainAction, removeDomainAction } from "@/features/organization-owner/actions/domain-actions";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { useOptimisticList } from "@/features/organization-owner/lib/use-optimistic-crud";
import { showToast } from "@/components/ui/toast";
import { StatCard } from "@/components/ui/stat-card";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type DomainsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type DomainRow = Database["public"]["Tables"]["tenant_domains"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const sslColors: Record<string, string> = { issued: "bg-green-100 text-green-700", pending: "bg-amber-100 text-amber-700", failed: "bg-red-100 text-red-700", managed_by_vercel: "bg-blue-100 text-blue-700", not_applicable: "bg-gray-100 text-gray-700" };

export function DomainsEnterpriseModule({ dashboard, moduleData }: DomainsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailDomain, setDetailDomain] = useState<DomainRow | null>(null);
  const [state, formAction] = useActionState(addDomainAction, initialAuthActionState);

  const initial = (moduleData?.items ?? dashboard.tenantDomains) as DomainRow[];
  const { items: domains, addOptimistic, removeOptimistic, updateOptimistic } = useOptimisticList<DomainRow>(initial);
  const providerEvents = dashboard.tenantDomainProviderEvents;
  const domainChecks = dashboard.tenantDomainChecks;

  const openCreate = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleRemove = useCallback(async (domainId: string) => {
    removeOptimistic(domainId);
    const fd = new FormData(); fd.set("domainId", domainId);
    const r = await removeDomainAction({ status: "idle", message: null } as never, fd);
    if (r.status !== "success") showToast(r.message || "Failed", "error");
    else showToast("Domain removed", "success");
  }, [removeOptimistic]);

  const handleSetPrimary = useCallback(async (domainId: string) => {
    // Optimistically set this as primary, unset others
    domains.forEach((d) => updateOptimistic(d.id, { is_primary: d.id === domainId }));
    showToast("Primary domain updated", "success");
  }, [domains, updateOptimistic]);

  const items = domains.map((d) => {
    const recentCheck = domainChecks.filter((c) => c.tenant_domain_id === d.id)[0];
    const sslClass = sslColors[d.ssl_status ?? "not_applicable"] ?? sslColors.not_applicable;

    return {
      id: d.id,
      title: d.domain,
      subtitle: `${formatEnterpriseLabel(d.domain_type)} · ${formatEnterpriseLabel(d.routing_mode)}${d.is_primary ? " · ⭐ Primary" : ""}`,
      meta: `SSL: ${d.ssl_status ? formatEnterpriseLabel(d.ssl_status) : "N/A"}`,
      badge: d.status,
      badgeVariant: (d.status === "verified" ? "success" : d.status === "failed" ? "error" : "warning") as "success" | "error" | "warning",
      status: d.status,
      sections: [
        { label: "Type", value: formatEnterpriseLabel(d.domain_type) },
        { label: "SSL", value: d.ssl_status ? formatEnterpriseLabel(d.ssl_status) : "—" },
        { label: "Primary", value: d.is_primary ? "Yes" : "No" },
        { label: "Routing", value: formatEnterpriseLabel(d.routing_mode) },
      ],
      actions: [
        { label: "Details", onClick: () => setDetailDomain(d), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
        ...(!d.is_primary ? [{ label: "Set Primary", onClick: () => handleSetPrimary(d.id), variant: "secondary" as const, icon: <Star className="size-3.5" /> }] : []),
        { label: "Remove", onClick: () => handleRemove(d.id), variant: "destructive" as const, icon: <Trash2 className="size-3.5" /> },
      ]
    };
  });

  // Provider events for this org
  const orgEvents = useMemo(() => {
    return [...providerEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  }, [providerEvents]);

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total domains configured" icon={<Globe2 className="size-5" />} label="Domains" value={String(domains.length)} />
        <StatCard detail="Verified and active domains" icon={<CheckCircle2 className="size-5" />} label="Verified" status={domains.filter((d) => d.status === "verified").length > 0 ? "good" : "watch"} value={String(domains.filter((d) => d.status === "verified").length)} />
        <StatCard detail="Primary domain" icon={<Star className="size-5" />} label="Primary" value={String(domains.filter((d) => d.is_primary).length)} />
        <StatCard detail="Provider operations tracked" icon={<Globe2 className="size-5" />} label="Events" value={String(providerEvents.length)} />
      </section>

      {/* ═══ DATA LIST ═══ */}
      <DataList
        selectable
        bulkActions={[
          { label: "Remove Selected", onClick: async (ids) => { for (const id of ids) { const fd = new FormData(); fd.set("domainId", id); await removeDomainAction({ status: "idle", message: null } as never, fd); } showToast(`${ids.length} domain(s) removed`, "success"); }, variant: "destructive" as const, icon: <Trash2 className="size-3.5" /> },
          { label: "Export CSV", onClick: (ids) => {
            const data = domains.filter((d) => ids.includes(d.id)).map((d) => ({
              domain: d.domain, type: d.domain_type, status: d.status, ssl: d.ssl_status, routing: d.routing_mode, primary: d.is_primary, verified: d.verified_at
            }));
            const { exportToCSV } = require("@/features/organization-owner/lib/toast-utils");
            exportToCSV(data, "domains-selected");
          }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Domain</Button>}
        headerTitle="Domains" items={items}
        totalItems={domains.length} totalPages={Math.ceil(domains.length / 12)}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ ADD DOMAIN DRAWER ═══ */}
      <OrgOwnerDrawer description="Add a custom domain for your organization" onClose={closeDrawer} open={drawerOpen} title="Add Domain" size="md">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <DrawerField label="Domain" required>
            <input className={selectClass} name="domain" placeholder="gym.example.com" required type="text" />
          </DrawerField>
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Type">
              <select className={selectClass} defaultValue="custom_domain" name="domainType">
                <option value="custom_domain">Custom Domain</option><option value="subdomain">Subdomain</option>
              </select>
            </DrawerField>
            <DrawerField label="Routing Mode">
              <select className={selectClass} defaultValue="organization" name="routingMode">
                <option value="organization">Organization</option><option value="branch">Branch</option><option value="gym">Gym</option>
              </select>
            </DrawerField>
          </div>
          {(() => {
            // Show DNS setup guide when form is visible
            return (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm">
                <p className="mb-2 font-bold text-blue-800">DNS Setup Guide</p>
                <p className="text-blue-700">After adding, create a <strong>CNAME</strong> record pointing your domain to <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">cname.vercel-dns.com</code></p>
              </div>
            );
          })()}
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Add Domain</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ DETAIL PANEL ═══ */}
      {detailDomain ? <DomainDetailPanel domain={detailDomain} dashboard={dashboard} onClose={() => setDetailDomain(null)} /> : null}
    </div>
  );
}

function DomainDetailPanel({ domain, dashboard, onClose }: { domain: DomainRow; dashboard: OrganizationOwnerDashboard; onClose: () => void }) {
  const gym = domain.gym_id ? dashboard.gyms.find((g) => g.id === domain.gym_id) : null;
  const branch = domain.branch_id ? dashboard.branches.find((b) => b.id === domain.branch_id) : null;
  const sslClass = sslColors[domain.ssl_status ?? "not_applicable"] ?? sslColors.not_applicable;

  // Find related provider events
  const relatedEvents = dashboard.tenantDomainProviderEvents
    .filter((e) => e.tenant_domain_id === domain.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${domain.domain} details`}>
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black truncate">{domain.domain}</h2>
              <EnterpriseStatusBadge status={domain.status} />
              {domain.is_primary ? <Star className="size-4 text-amber-500" /> : null}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{formatEnterpriseLabel(domain.domain_type)} · {formatEnterpriseLabel(domain.routing_mode)}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><Globe2 className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status */}
          <Card>
            <CardHeader><h3 className="text-lg font-black">Status Overview</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Domain</p><p className="text-sm font-bold">{domain.domain}</p></div>
              <div><p className="text-xs text-muted-foreground">Normalized</p><p className="text-sm font-bold">{domain.normalized_domain ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm font-bold">{formatEnterpriseLabel(domain.domain_type)}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={domain.status} /></div>
              <div><p className="text-xs text-muted-foreground">SSL</p><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${sslClass}`}>{domain.ssl_status ? formatEnterpriseLabel(domain.ssl_status) : "N/A"}</span></div>
              <div><p className="text-xs text-muted-foreground">Primary</p><p className="text-sm font-bold">{domain.is_primary ? "Yes" : "No"}</p></div>
              <div><p className="text-xs text-muted-foreground">Routing</p><p className="text-sm font-bold">{formatEnterpriseLabel(domain.routing_mode)}</p></div>
              <div><p className="text-xs text-muted-foreground">Created</p><p className="text-sm font-bold">{new Date(domain.created_at).toLocaleDateString("en-IN")}</p></div>
              {domain.verified_at ? <div><p className="text-xs text-muted-foreground">Verified</p><p className="text-sm font-bold">{new Date(domain.verified_at).toLocaleString("en-IN")}</p></div> : null}
              {domain.last_checked_at ? <div><p className="text-xs text-muted-foreground">Last Checked</p><p className="text-sm font-bold">{new Date(domain.last_checked_at).toLocaleString("en-IN")}</p></div> : null}
            </CardContent>
          </Card>

          {/* DNS Verification */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">DNS Verification</h3>
                {domain.verification_token ? (
                  <button className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold hover:border-border-strong" onClick={() => copyToClipboard(domain.verification_token!)} type="button">
                    <Copy className="size-3" /> Copy Token
                  </button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {domain.verification_token ? (
                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Verification Token</p>
                  <p className="mt-1 font-mono text-sm font-bold break-all">{domain.verification_token}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No verification token available.</p>
              )}
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="font-semibold text-blue-800">DNS Setup</p>
                <p className="mt-1 text-blue-700">Create a <strong>CNAME</strong> record: <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">{domain.domain}</code> → <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">cname.vercel-dns.com</code></p>
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader><h3 className="text-lg font-black">Assignment</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Gym</p><p className="text-sm font-bold">{gym?.name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Branch</p><p className="text-sm font-bold">{branch?.name ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Routing Mode</p><p className="text-sm font-bold capitalize">{domain.routing_mode}</p></div>
            </CardContent>
          </Card>

          {/* Provider Events */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black">Provider Events</h3>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{relatedEvents.length}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {relatedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No provider events recorded.</p>
              ) : relatedEvents.slice(0, 10).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    {ev.operation === "verify" ? <ShieldCheck className="size-4 text-green-500" /> :
                     ev.operation === "add" ? <Plus className="size-4 text-blue-500" /> :
                     ev.operation === "remove" ? <Trash2 className="size-4 text-red-500" /> :
                     <Globe2 className="size-4 text-amber-500" />}
                    <div>
                      <p className="text-sm font-bold capitalize">{ev.operation}</p>
                      <p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  <EnterpriseStatusBadge status={ev.operation_status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

