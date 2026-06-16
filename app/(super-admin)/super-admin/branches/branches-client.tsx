"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { GymBranchNode, GymBranchManagementSummary, BranchNode } from "@/features/super-admin/services/gym-branch-management-service";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { HydrationSafeDate } from "@/components/ui/hydration-safe-date";

type BranchFlat = {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  status: string;
  city: string | null;
  state: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  capacity: number;
  timezone: string;
  currency: string;
  branchCode: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  activeMembers: number;
  revenue: number;
  hasSettings: boolean;
  hasAdmin: boolean;
  warnings: number;
  gymName: string;
};

type BranchesClientProps = {
  data: {
    summary: GymBranchManagementSummary;
    gyms: GymBranchNode[];
    orphanBranches: BranchNode[];
    organizations: Array<{ id: string; name: string; slug: string; status: string }>;
    adminCandidates: unknown[];
    approvalRequests: unknown[];
    auditTimeline: unknown[];
    filters: { query: string; organizationId: string; status: string; page: number; pageSize: number };
    pagination: { page: number; pageSize: number; totalGyms: number; totalPages: number };
  };
};

const statusOptions = ["all", "active", "maintenance", "suspended", "deactivated", "archived"] as const;

export function BranchesClient({ data }: BranchesClientProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [detailBranch, setDetailBranch] = useState<BranchFlat | null>(null);

  // Derive organizations list for filter
  const orgOptions = useMemo(() => {
    const orgs = new Map<string, string>();
    for (const node of data.gyms) {
      if (node.organization) {
        orgs.set(node.organization.id, node.organization.name);
      }
    }
    for (const ob of data.orphanBranches) {
      if (ob.branch.organization_id) {
        orgs.set(ob.branch.organization_id, ob.branch.organization_id);
      }
    }
    return Array.from(orgs.entries()).map(([id, name]) => ({ id, name }));
  }, [data.gyms, data.orphanBranches]);

  // Flatten all branches from all gym nodes
  const allBranches: BranchFlat[] = useMemo(() => {
    const branches: BranchFlat[] = [];
    for (const node of data.gyms) {
      for (const branchNode of node.branches) {
        branches.push({
          id: branchNode.branch.id,
          name: branchNode.branch.name,
          organizationId: node.organization?.id ?? "",
          organizationName: node.organization?.name ?? "Unknown",
          status: branchNode.branch.status,
          city: branchNode.branch.city,
          state: branchNode.branch.state,
          country: branchNode.branch.country,
          phone: branchNode.branch.phone,
          email: branchNode.branch.email,
          capacity: branchNode.branch.capacity,
          timezone: branchNode.branch.timezone,
          currency: branchNode.branch.currency,
          branchCode: branchNode.branch.branch_code,
          slug: branchNode.branch.slug,
          createdAt: branchNode.branch.created_at,
          updatedAt: branchNode.branch.updated_at,
          activeMembers: branchNode.metrics.activeMembers,
          revenue: branchNode.metrics.revenue,
          hasSettings: branchNode.settings !== null,
          hasAdmin: branchNode.admins.length > 0,
          warnings: branchNode.warnings.length,
          gymName: node.gym.name,
        });
      }
    }
    // Include orphan branches
    for (const ob of data.orphanBranches) {
      branches.push({
        id: ob.branch.id,
        name: ob.branch.name,
        organizationId: ob.branch.organization_id,
        organizationName: "Unknown",
        status: ob.branch.status,
        city: ob.branch.city,
        state: ob.branch.state,
        country: ob.branch.country,
        phone: ob.branch.phone,
        email: ob.branch.email,
        capacity: ob.branch.capacity,
        timezone: ob.branch.timezone,
        currency: ob.branch.currency,
        branchCode: ob.branch.branch_code,
        slug: ob.branch.slug,
        createdAt: ob.branch.created_at,
        updatedAt: ob.branch.updated_at,
        activeMembers: ob.metrics.activeMembers,
        revenue: ob.metrics.revenue,
        hasSettings: ob.settings !== null,
        hasAdmin: ob.admins.length > 0,
        warnings: ob.warnings.length,
        gymName: "No location",
      });
    }
    return branches;
  }, [data.gyms, data.orphanBranches]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = allBranches;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.organizationName.toLowerCase().includes(q) ||
          (b.city?.toLowerCase().includes(q) ?? false) ||
          (b.branchCode?.toLowerCase().includes(q) ?? false)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (orgFilter !== "all") {
      result = result.filter((b) => b.organizationId === orgFilter);
    }
    return result;
  }, [allBranches, query, statusFilter, orgFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = allBranches.length;
    const active = allBranches.filter((b) => b.status === "active").length;
    const inactive = allBranches.filter((b) => b.status !== "active" && b.status !== "archived").length;
    const orgsWithBranches = new Set(allBranches.map((b) => b.organizationId)).size;
    const noSettings = allBranches.filter((b) => !b.hasSettings).length;
    const noAdmin = allBranches.filter((b) => !b.hasAdmin).length;
    const requiresAttention = allBranches.filter((b) => b.warnings > 0 || !b.hasSettings || !b.hasAdmin).length;
    return { total, active, inactive, orgsWithBranches, noSettings, noAdmin, requiresAttention };
  }, [allBranches]);

  const totalMembers = useMemo(() => allBranches.reduce((s, b) => s + b.activeMembers, 0), [allBranches]);
  const avgMembers = allBranches.length > 0 ? Math.round(totalMembers / allBranches.length) : 0;

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Branch & Location Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage {formatCompactNumber(kpis.total)} branches across {formatCompactNumber(kpis.orgsWithBranches)} organizations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/super-admin/organizations" variant="secondary" size="sm">
            <Building2 className="size-4" /> Organizations
          </ButtonLink>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Building2 className="size-5" />} label="Total Branches" value={formatCompactNumber(kpis.total)} />
        <KpiCard icon={<CheckCircle2 className="size-5 text-green-600" />} label="Active" value={formatCompactNumber(kpis.active)} />
        <KpiCard icon={<AlertTriangle className="size-5 text-amber-600" />} label="Inactive / Issues" value={formatCompactNumber(kpis.inactive)} />
        <KpiCard icon={<Users className="size-5 text-blue-600" />} label="Avg Members/Branch" value={formatCompactNumber(avgMembers)} />
      </section>

      {/* Secondary KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Cpu className="size-5" />} label="No Settings" value={formatCompactNumber(kpis.noSettings)} />
        <KpiCard icon={<ShieldAlert className="size-5" />} label="No Admin" value={formatCompactNumber(kpis.noAdmin)} />
        <KpiCard icon={<AlertTriangle className="size-5 text-red-600" />} label="Needs Attention" value={formatCompactNumber(kpis.requiresAttention)} />
        <KpiCard icon={<Building2 className="size-5" />} label="Organizations" value={formatCompactNumber(kpis.orgsWithBranches)} />
      </section>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search branches, organizations, cities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="h-11 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" ? "All Statuses" : formatEnterpriseLabel(opt)}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary"
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
            >
              <option value="all">All Organizations</option>
              {orgOptions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => { setQuery(""); setStatusFilter("all"); setOrgFilter("all"); }}
              className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted"
              type="button"
            >
              Clear Filters
            </button>
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {allBranches.length} branches
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Branches Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Building2 className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-lg font-bold">No branches found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filter criteria.</p>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => { setQuery(""); setStatusFilter("all"); setOrgFilter("all"); }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50">
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Branch</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Organization</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Location</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Members</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Health</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Created</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((branch) => (
                    <tr
                      key={branch.id}
                      className="border-b border-border transition-colors hover:bg-surface-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <button
                            onClick={() => setDetailBranch(branch)}
                            className="font-bold text-foreground hover:text-primary transition-colors"
                            type="button"
                          >
                            {branch.name}
                          </button>
                          <p className="mt-0.5 text-xs text-muted-foreground">{branch.branchCode}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{branch.organizationName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          {branch.city ?? "N/A"}{branch.state ? `, ${branch.state}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={branch.status} />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {formatCompactNumber(branch.activeMembers)}
                      </td>
                      <td className="px-4 py-3">
                        <HealthIndicator
                          hasSettings={branch.hasSettings}
                          hasAdmin={branch.hasAdmin}
                          warnings={branch.warnings}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <HydrationSafeDate date={branch.createdAt} format="date" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDetailBranch(branch)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                            type="button"
                            aria-label="View details"
                          >
                            <Eye className="size-4" />
                          </button>
                          <a
                            href={`/super-admin/organizations/${branch.organizationId}`}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                            aria-label="View organization"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {detailBranch && (
        <BranchDetailDrawer branch={detailBranch} onClose={() => setDetailBranch(null)} />
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-bold uppercase tracking-[0.1em]">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    maintenance: "bg-amber-100 text-amber-700 border-amber-200",
    suspended: "bg-red-100 text-red-700 border-red-200",
    deactivated: "bg-gray-100 text-gray-600 border-gray-200",
    archived: "bg-gray-100 text-gray-500 border-gray-200",
    planned: "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <span className={`rounded-md border px-2.5 py-0.5 text-xs font-bold ${styles[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {formatEnterpriseLabel(status)}
    </span>
  );
}

function HealthIndicator({ hasSettings, hasAdmin, warnings }: { hasSettings: boolean; hasAdmin: boolean; warnings: number }) {
  const healthy = hasSettings && hasAdmin && warnings === 0;
  if (healthy) {
    return <span className="text-xs font-bold text-green-600">Healthy</span>;
  }
  const issues: string[] = [];
  if (!hasSettings) issues.push("No setup");
  if (!hasAdmin) issues.push("No admin");
  if (warnings > 0) issues.push(`${warnings} issue(s)`);
  return <span className="text-xs font-bold text-amber-600">{issues.join(", ")}</span>;
}

function BranchDetailDrawer({ branch, onClose }: { branch: BranchFlat; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-y-auto border-l border-border bg-surface shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <h2 className="text-xl font-black">{branch.name}</h2>
          <button onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted" type="button" aria-label="Close">
            <XCircle className="size-5" />
          </button>
        </div>
        <div className="space-y-6 p-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <StatusBadge status={branch.status} />
            <span className="text-sm text-muted-foreground">{branch.branchCode}</span>
          </div>

          {/* Organization */}
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Organization</p>
            <p className="mt-1 text-sm font-bold">{branch.organizationName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Location: {branch.gymName}</p>
          </div>

          {/* Contact */}
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Contact</p>
            <div className="mt-2 space-y-1 text-sm">
              {branch.email && <p>Email: {branch.email}</p>}
              {branch.phone && <p>Phone: {branch.phone}</p>}
              {branch.city && <p>City: {branch.city}</p>}
              {branch.state && <p>State: {branch.state}</p>}
              <p>Country: {branch.country}</p>
              <p>Timezone: {branch.timezone}</p>
              <p>Currency: {branch.currency}</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Members</p>
              <p className="mt-1 text-2xl font-black">{formatCompactNumber(branch.activeMembers)}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Capacity</p>
              <p className="mt-1 text-2xl font-black">{formatCompactNumber(branch.capacity)}</p>
            </div>
          </div>

          {/* Health */}
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Configuration Health</p>
            <div className="mt-3 space-y-2">
              <HealthCheck label="Settings configured" passed={branch.hasSettings} />
              <HealthCheck label="Admin assigned" passed={branch.hasAdmin} />
              <HealthCheck label="Contact details" passed={Boolean(branch.email && branch.phone)} />
              <HealthCheck label="Address completed" passed={Boolean(branch.city && branch.state)} />
            </div>
          </div>

          {/* Timestamps */}
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Timeline</p>
            <p className="mt-2 text-sm">
              Created: <HydrationSafeDate date={branch.createdAt} format="datetime" />
            </p>
            <p className="mt-1 text-sm">
              Updated: <HydrationSafeDate date={branch.updatedAt} format="datetime" />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {passed ? (
        <CheckCircle2 className="size-4 text-green-500" />
      ) : (
        <XCircle className="size-4 text-red-400" />
      )}
    </div>
  );
}
