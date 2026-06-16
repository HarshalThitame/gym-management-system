"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowUpDown,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Globe2,
  Loader2,
  MapPin,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { GymBranchNode, GymBranchManagementSummary, BranchNode } from "@/features/super-admin/services/gym-branch-management-service";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
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
  revenueFormatted: string;
  hasSettings: boolean;
  hasAdmin: boolean;
  warnings: number;
  warningLabels: string[];
  gymName: string;
  address: string | null;
};

type OrgBranchInfo = {
  id: string;
  name: string;
  branchCount: number;
  packageName: string;
  maxBranches: number;
  remaining: number;
  isUnlimited: boolean;
};

const statusOptions = ["all", "active", "maintenance", "suspended", "deactivated", "archived", "planned"] as const;
const pageSizeOptions = [10, 25, 50, 100] as const;

type BranchesClientProps = {
  data: {
    summary: GymBranchManagementSummary;
    gyms: GymBranchNode[];
    orphanBranches: BranchNode[];
    organizations: Array<{ id: string; name: string; slug: string; status: string }>;
  };
};

export function BranchesClient({ data }: BranchesClientProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [detailBranch, setDetailBranch] = useState<BranchFlat | null>(null);
  const [editBranch, setEditBranch] = useState<BranchFlat | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showBulkBar, setShowBulkBar] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  // Derive org options
  const orgOptions = useMemo(() => {
    const orgs = new Map<string, string>();
    for (const org of data.organizations) {
      orgs.set(org.id, org.name);
    }
    return Array.from(orgs.entries()).map(([id, name]) => ({ id, name }));
  }, [data.organizations]);

  // Build org branch info with limits
  const orgBranchInfo = useMemo(() => {
    const map = new Map<string, OrgBranchInfo>();
    for (const org of data.organizations) {
      map.set(org.id, {
        id: org.id,
        name: org.name,
        branchCount: 0,
        packageName: "No plan",
        maxBranches: 5,
        remaining: 5,
        isUnlimited: false,
      });
    }
    for (const node of data.gyms) {
      if (node.organization) {
        const info = map.get(node.organization.id);
        if (info) {
          info.branchCount += node.branches.length;
        }
      }
    }
    return map;
  }, [data.gyms, data.organizations]);

  // Flatten all branches
  const allBranches: BranchFlat[] = useMemo(() => {
    const branches: BranchFlat[] = [];
    for (const node of data.gyms) {
      for (const bn of node.branches) {
        const w = bn.warnings || [];
        branches.push({
          id: bn.branch.id,
          name: bn.branch.name,
          organizationId: node.organization?.id ?? "",
          organizationName: node.organization?.name ?? "Unknown",
          status: bn.branch.status,
          city: bn.branch.city,
          state: bn.branch.state,
          country: bn.branch.country,
          phone: bn.branch.phone,
          email: bn.branch.email,
          capacity: bn.branch.capacity,
          timezone: bn.branch.timezone,
          currency: bn.branch.currency,
          branchCode: bn.branch.branch_code,
          slug: bn.branch.slug,
          createdAt: bn.branch.created_at,
          updatedAt: bn.branch.updated_at,
          activeMembers: bn.metrics.activeMembers,
          revenue: bn.metrics.revenue,
          revenueFormatted: formatCurrency(bn.metrics.revenue),
          hasSettings: bn.settings !== null,
          hasAdmin: bn.admins.length > 0,
          warnings: w.length,
          warningLabels: w.map((x) => x.title),
          gymName: node.gym.name,
          address: bn.branch.address,
        });
      }
    }
    for (const ob of data.orphanBranches) {
      const w = ob.warnings || [];
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
        revenueFormatted: formatCurrency(ob.metrics.revenue),
        hasSettings: ob.settings !== null,
        hasAdmin: ob.admins.length > 0,
        warnings: w.length,
        warningLabels: w.map((x) => x.title),
        gymName: "No location",
        address: ob.branch.address,
      });
    }
    return branches;
  }, [data.gyms, data.orphanBranches]);

  // Apply filters + sort + pagination
  const filtered = useMemo(() => {
    let result = allBranches;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.organizationName.toLowerCase().includes(q) ||
          (b.city?.toLowerCase().includes(q) ?? false) ||
          (b.branchCode?.toLowerCase().includes(q) ?? false) ||
          (b.email?.toLowerCase().includes(q) ?? false) ||
          (b.phone?.toLowerCase().includes(q) ?? false)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (orgFilter !== "all") {
      result = result.filter((b) => b.organizationId === orgFilter);
    }
    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "organizationName": cmp = a.organizationName.localeCompare(b.organizationName); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "activeMembers": cmp = a.activeMembers - b.activeMembers; break;
        case "createdAt": cmp = a.createdAt.localeCompare(b.createdAt); break;
        default: cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [allBranches, query, statusFilter, orgFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // KPIs
  const kpis = useMemo(() => {
    const total = allBranches.length;
    const active = allBranches.filter((b) => b.status === "active").length;
    const inactive = allBranches.filter((b) => b.status !== "active" && b.status !== "archived").length;
    const orgsWith = new Set(allBranches.map((b) => b.organizationId)).size;
    const noSetup = allBranches.filter((b) => !b.hasSettings).length;
    const noAdmin = allBranches.filter((b) => !b.hasAdmin).length;
    const attention = allBranches.filter((b) => b.warnings > 0 || !b.hasSettings || !b.hasAdmin).length;
    const suspended = allBranches.filter((b) => b.status === "suspended").length;
    return { total, active, inactive, orgsWith, noSetup, noAdmin, attention, suspended };
  }, [allBranches]);

  const totalMembers = useMemo(() => allBranches.reduce((s, b) => s + b.activeMembers, 0), [allBranches]);
  const avgMembers = allBranches.length > 0 ? Math.round(totalMembers / allBranches.length) : 0;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (paginated.every((b) => selectedIds.has(b.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((b) => b.id)));
    }
  };

  // Simulated actions
  const handleStatusAction = async (branchId: string, action: string, name: string) => {
    setActionLoading(`${action}-${branchId}`);
    await new Promise((r) => setTimeout(r, 600));
    showToast(`${name} ${action === "activate" ? "activated" : action === "suspend" ? "suspended" : "archived"} successfully.`, "success");
    setActionLoading(null);
    setOpenMenuId(null);
  };

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Branch & Location Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCompactNumber(kpis.total)} branches across {formatCompactNumber(kpis.orgsWith)} organizations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowCreate(true)} variant="accent" size="sm">
            <Plus className="size-4" /> Create Branch
          </Button>
          <ButtonLink
            href={`/api/super-admin/organizations/export?scope=branches&format=csv`}
            variant="secondary"
            size="sm"
          >
            <Download className="size-4" /> Export
          </ButtonLink>
        </div>
      </div>

      {/* KPI Row 1 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <KpiCard icon={<Building2 className="size-5" />} label="Total Branches" value={formatCompactNumber(kpis.total)} {...(kpis.active > 0 ? { trend: `${Math.round((kpis.active / Math.max(kpis.total, 1)) * 100)}% active` } : {})} />
        <KpiCard icon={<CheckCircle2 className="size-5 text-green-600" />} label="Active" value={formatCompactNumber(kpis.active)} />
        <KpiCard icon={<Ban className="size-5 text-amber-600" />} label="Suspended" value={formatCompactNumber(kpis.suspended)} />
        <KpiCard icon={<AlertTriangle className="size-5 text-red-600" />} label="Needs Attention" value={formatCompactNumber(kpis.attention)} />
      </section>

      {/* KPI Row 2 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <KpiCard icon={<Users className="size-5 text-blue-600" />} label="Avg Members / Branch" value={formatCompactNumber(avgMembers)} />
        <KpiCard icon={<Cpu className="size-5" />} label="No Setup" value={formatCompactNumber(kpis.noSetup)} />
        <KpiCard icon={<ShieldAlert className="size-5" />} label="No Admin" value={formatCompactNumber(kpis.noAdmin)} />
        <KpiCard icon={<TrendingUp className="size-5 text-indigo-600" />} label="Inactive / Issues" value={formatCompactNumber(kpis.inactive)} />
      </section>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, org, city, code, email, phone..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              />
            </div>
            <select className="h-11 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="all">All Statuses</option>
              {statusOptions.filter((s) => s !== "all").map((opt) => (
                <option key={opt} value={opt}>{formatEnterpriseLabel(opt)}</option>
              ))}
            </select>
            <select className="h-11 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary" value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}>
              <option value="all">All Organizations</option>
              {orgOptions.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <select className="h-11 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {pageSizeOptions.map((s) => (<option key={s} value={s}>{s} rows</option>))}
            </select>
            {(query || statusFilter !== "all" || orgFilter !== "all") && (
              <button onClick={() => { setQuery(""); setStatusFilter("all"); setOrgFilter("all"); setPage(1); }} className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted" type="button">
                Clear Filters
              </button>
            )}
            <span className="text-sm text-muted-foreground">{filtered.length} of {allBranches.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-accent bg-accent/5 p-3">
          <span className="text-sm font-bold">{selectedIds.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => { selectedIds.forEach((id) => handleStatusAction(id, "activate", "Branches")); setActionLoading("bulk-activate"); }}>
            <PlayCircle className="size-4" /> Activate All
          </Button>
          <Button size="sm" variant="destructive" onClick={() => { selectedIds.forEach((id) => handleStatusAction(id, "suspend", "Branches")); setActionLoading("bulk-suspend"); }}>
            <PauseCircle className="size-4" /> Suspend All
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Building2 className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-lg font-bold">{query || statusFilter !== "all" || orgFilter !== "all" ? "No branches match your filters" : "No branches exist yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {query || statusFilter !== "all" || orgFilter !== "all" ? "Try adjusting your search or filter criteria." : "Create your first branch to get started."}
              </p>
              <div className="mt-4 flex gap-3">
                {(query || statusFilter !== "all" || orgFilter !== "all") && (
                  <Button variant="secondary" onClick={() => { setQuery(""); setStatusFilter("all"); setOrgFilter("all"); }}>
                    Clear Filters
                  </Button>
                )}
                <Button onClick={() => setShowCreate(true)} variant="accent">
                  <Plus className="size-4" /> Create Branch
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50">
                    <th className="w-10 px-3 py-3">
                      <input type="checkbox" className="size-4 rounded border-border accent-primary" checked={paginated.length > 0 && paginated.every((b) => selectedIds.has(b.id))} onChange={toggleAll} />
                    </th>
                    <th className="px-3 py-3">
                      <button onClick={() => handleSort("name")} className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground" type="button">
                        Branch {sortField === "name" && <ArrowUpDown className="size-3" />}
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button onClick={() => handleSort("organizationName")} className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground" type="button">
                        Organization {sortField === "organizationName" && <ArrowUpDown className="size-3" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Location</th>
                    <th className="px-3 py-3">
                      <button onClick={() => handleSort("status")} className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground" type="button">
                        Status {sortField === "status" && <ArrowUpDown className="size-3" />}
                      </button>
                    </th>
                    <th className="px-3 py-3">
                      <button onClick={() => handleSort("activeMembers")} className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground" type="button">
                        Members {sortField === "activeMembers" && <ArrowUpDown className="size-3" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Limit</th>
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Health</th>
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((branch) => {
                    const orgInfo = orgBranchInfo.get(branch.organizationId);
                    const used = orgInfo?.branchCount ?? 0;
                    const limit = orgInfo?.maxBranches ?? 0;
                    const remaining = Math.max(0, limit - used);
                    const isUnlimited = limit === -1;
                    return (
                      <tr key={branch.id} className={`border-b border-border transition-colors hover:bg-surface-muted/30 ${selectedIds.has(branch.id) ? "bg-accent/5" : ""}`}>
                        <td className="px-3 py-3">
                          <input type="checkbox" className="size-4 rounded border-border accent-primary" checked={selectedIds.has(branch.id)} onChange={() => toggleSelect(branch.id)} />
                        </td>
                        <td className="px-3 py-3">
                          <button onClick={() => setDetailBranch(branch)} className="font-bold text-foreground hover:text-primary transition-colors text-left" type="button">
                            {branch.name}
                          </button>
                          <p className="mt-0.5 text-xs text-muted-foreground">{branch.branchCode}</p>
                        </td>
                        <td className="px-3 py-3">
                          <a href={`/super-admin/organizations/${branch.organizationId}`} className="text-sm text-foreground hover:text-primary transition-colors">
                            {branch.organizationName}
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate max-w-32">{branch.city ?? "N/A"}{branch.state ? `, ${branch.state}` : ""}</span>
                          </div>
                          {branch.gymName !== "No location" && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{branch.gymName}</p>
                          )}
                        </td>
                        <td className="px-3 py-3"><StatusBadge status={branch.status} /></td>
                        <td className="px-3 py-3 text-sm font-semibold">{formatCompactNumber(branch.activeMembers)}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-semibold">
                            {isUnlimited ? "Unlimited" : `${used}/${limit}`}
                          </span>
                          {!isUnlimited && remaining <= 1 && (
                            <span className="ml-1 text-xs text-amber-600">⚠️</span>
                          )}
                        </td>
                        <td className="px-3 py-3"><HealthIndicator hasSettings={branch.hasSettings} hasAdmin={branch.hasAdmin} warnings={branch.warnings} warningLabels={branch.warningLabels} /></td>
                        <td className="px-3 py-3 relative">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setDetailBranch(branch)} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground" type="button" aria-label="View details">
                              <Eye className="size-4" />
                            </button>
                            <button onClick={() => { setEditBranch(branch); setOpenMenuId(null); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground" type="button" aria-label="Edit">
                              <Edit3 className="size-4" />
                            </button>
                            <div className="relative">
                              <button onClick={() => setOpenMenuId(openMenuId === branch.id ? null : branch.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground" type="button" aria-label="More actions">
                                <MoreHorizontal className="size-4" />
                              </button>
                              {openMenuId === branch.id && (
                                <div ref={menuRef} className="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border border-border bg-surface p-1.5 shadow-premium">
                                  <ActionMenuItem icon={<PlayCircle className="size-4" />} label="Activate" onClick={() => handleStatusAction(branch.id, "activate", branch.name)} disabled={branch.status === "active" || actionLoading === `activate-${branch.id}`} loading={actionLoading === `activate-${branch.id}`} />
                                  <ActionMenuItem icon={<PauseCircle className="size-4 text-amber-600" />} label="Suspend" onClick={() => handleStatusAction(branch.id, "suspend", branch.name)} disabled={branch.status === "suspended" || branch.status === "archived" || actionLoading === `suspend-${branch.id}`} loading={actionLoading === `suspend-${branch.id}`} />
                                  <ActionMenuItem icon={<Archive className="size-4" />} label="Archive" onClick={() => handleStatusAction(branch.id, "archive", branch.name)} disabled={branch.status === "archived" || actionLoading === `archive-${branch.id}`} loading={actionLoading === `archive-${branch.id}`} />
                                  <div className="my-1 border-t border-border" />
                                  <ActionMenuItem icon={<ExternalLink className="size-4" />} label="View Organization" onClick={() => window.open(`/super-admin/organizations/${branch.organizationId}`, "_blank")} />
                                  <ActionMenuItem icon={<MapPin className="size-4" />} label="View Members" onClick={() => showToast("Members view coming soon", "info")} />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-3">
          <p className="text-sm text-muted-foreground">
            Page {safePage} of {totalPages} · {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-surface-muted disabled:opacity-40" type="button">
              <ChevronLeft className="inline size-4" /> Previous
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-surface-muted disabled:opacity-40" type="button">
              Next <ChevronRight className="inline size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Branch Drawer */}
      {showCreate && (
        <BranchFormDrawer
          title="Create Branch"
          orgOptions={orgOptions}
          orgBranchInfo={orgBranchInfo}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => { showToast("Branch created successfully.", "success"); setShowCreate(false); }}
        />
      )}

      {/* Edit Branch Drawer */}
      {editBranch && (
        <BranchFormDrawer
          title="Edit Branch"
          branch={editBranch}
          orgOptions={orgOptions}
          orgBranchInfo={orgBranchInfo}
          onClose={() => setEditBranch(null)}
          onSubmit={(data) => { showToast("Branch updated successfully.", "success"); setEditBranch(null); }}
        />
      )}

      {/* Detail Drawer */}
      {detailBranch && (
        <BranchDetailDrawer
          branch={detailBranch}
          orgInfo={orgBranchInfo.get(detailBranch.organizationId)}
          onClose={() => setDetailBranch(null)}
          onEdit={() => { setEditBranch(detailBranch); setDetailBranch(null); }}
        />
      )}
    </div>
  );
}

function ActionMenuItem({ icon, label, onClick, disabled, loading }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-muted text-foreground"}`} type="button">
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function KpiCard({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string; trend?: string | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs transition-all hover:shadow-sm hover:border-border-strong">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <p className="text-xs font-bold uppercase tracking-[0.1em]">{label}</p>
        </div>
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
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

function HealthIndicator({ hasSettings, hasAdmin, warnings, warningLabels }: { hasSettings: boolean; hasAdmin: boolean; warnings: number; warningLabels: string[] }) {
  const healthy = hasSettings && hasAdmin && warnings === 0;
  if (healthy) {
    return <span className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle2 className="size-3" /> Healthy</span>;
  }
  const items: string[] = [];
  if (!hasSettings) items.push("No setup");
  if (!hasAdmin) items.push("No admin");
  if (warnings > 0) items.push(...warningLabels.slice(0, 1));
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item, i) => (
        <span key={i} className="text-xs font-bold text-amber-600">{item}</span>
      ))}
    </div>
  );
}

function BranchFormDrawer({
  title,
  branch,
  orgOptions,
  orgBranchInfo,
  onClose,
  onSubmit,
}: {
  title: string;
  branch?: BranchFlat;
  orgOptions: { id: string; name: string }[];
  orgBranchInfo: Map<string, OrgBranchInfo>;
  onClose: () => void;
  onSubmit: (data: Record<string, string>) => void;
}) {
  const [selectedOrg, setSelectedOrg] = useState(branch?.organizationId ?? "");
  const [name, setName] = useState(branch?.name ?? "");
  const [code, setCode] = useState(branch?.branchCode ?? "");
  const [city, setCity] = useState(branch?.city ?? "");
  const [state, setState] = useState(branch?.state ?? "");
  const [country, setCountry] = useState(branch?.country ?? "India");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [email, setEmail] = useState(branch?.email ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [status, setStatus] = useState(branch?.status ?? "active");
  const [submitting, setSubmitting] = useState(false);

  const orgInfo = selectedOrg ? orgBranchInfo.get(selectedOrg) : undefined;
  const atLimit = orgInfo && !orgInfo.isUnlimited && orgInfo.branchCount >= orgInfo.maxBranches && !branch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedOrg) return;
    if (atLimit) {
      showToast(`Branch limit reached for this organization (${orgInfo?.branchCount}/${orgInfo?.maxBranches}). Upgrade the plan or apply an override.`, "error");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    onSubmit({ name, code, city, state, country, phone, email, address, organizationId: selectedOrg, status });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-y-auto border-l border-border bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <h2 className="text-xl font-black">{title}</h2>
          <button onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted" type="button"><X className="size-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Organization */}
          <div className="space-y-2">
            <label className="text-sm font-bold">Organization <span className="text-red-500">*</span></label>
            <select className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)} required disabled={!!branch}>
              <option value="">Select organization</option>
              {orgOptions.map((org) => {
                const info = orgBranchInfo.get(org.id);
                const used = info?.branchCount ?? 0;
                const limit = info?.maxBranches ?? 0;
                const remaining = Math.max(0, limit - used);
                const atLimit = !info?.isUnlimited && used >= limit;
                return (
                  <option key={org.id} value={org.id} disabled={atLimit && !branch}>
                    {org.name} ({used}/{limit}){atLimit ? " — AT LIMIT" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Branch limit warning */}
          {atLimit && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              <AlertTriangle className="mr-1 inline size-4" />
              This organization has reached its branch limit ({orgInfo?.branchCount}/{orgInfo?.maxBranches}). Upgrade the plan or apply a Super Admin override to add more branches.
            </div>
          )}

          {/* Name & Code */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold">Branch Name <span className="text-red-500">*</span></label>
              <input className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown Fitness" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold">Branch Code</label>
              <input className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" value={code} onChange={(e) => setCode(e.target.value)} placeholder="DTN-001" />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="text-sm font-bold">Address</label>
            <textarea className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>

          {/* City, State, Country */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-bold">City</label>
              <input className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold">State</label>
              <input className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold">Country</label>
              <input className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>

          {/* Contact */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold">Email</label>
              <input className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="branch@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold">Phone</label>
              <input className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-bold">Status</label>
            <select className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.filter((s) => s !== "all").map((opt) => (
                <option key={opt} value={opt}>{formatEnterpriseLabel(opt)}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={submitting || !name.trim() || !selectedOrg}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {branch ? "Update Branch" : "Create Branch"}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BranchDetailDrawer({ branch, orgInfo, onClose, onEdit }: { branch: BranchFlat; orgInfo: OrgBranchInfo | null | undefined; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-y-auto border-l border-border bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-6 py-4">
          <h2 className="text-xl font-black">{branch.name}</h2>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground" type="button" aria-label="Edit"><Edit3 className="size-5" /></button>
            <button onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted" type="button" aria-label="Close"><X className="size-5" /></button>
          </div>
        </div>
        <div className="space-y-5 p-6">
          {/* Status + Code */}
          <div className="flex items-center gap-3">
            <StatusBadge status={branch.status} />
            <span className="text-sm text-muted-foreground">{branch.branchCode}</span>
          </div>

          {/* Branch Limit Card */}
          {orgInfo && (
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Subscription & Branch Limit</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold">{orgInfo.packageName}</span>
                <span className="text-sm font-bold">
                  {orgInfo.isUnlimited ? "Unlimited" : `${orgInfo.branchCount} / ${orgInfo.maxBranches} branches`}
                </span>
              </div>
              {!orgInfo.isUnlimited && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${orgInfo.remaining <= 0 ? "bg-red-500" : orgInfo.remaining <= 1 ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(100, (orgInfo.branchCount / Math.max(orgInfo.maxBranches, 1)) * 100)}%` }}
                  />
                </div>
              )}
              {!orgInfo.isUnlimited && orgInfo.remaining <= 0 && (
                <p className="mt-2 text-xs font-semibold text-red-600">Branch limit reached. Apply override or upgrade plan.</p>
              )}
            </div>
          )}

          {/* Organization */}
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Organization</p>
            <a href={`/super-admin/organizations/${branch.organizationId}`} className="mt-1 flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              {branch.organizationName} <ExternalLink className="size-3" />
            </a>
            <p className="mt-1 text-xs text-muted-foreground">Location: {branch.gymName}</p>
          </div>

          {/* Contact */}
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Contact</p>
            <div className="mt-2 space-y-1.5 text-sm">
              {branch.email && <p><span className="text-muted-foreground">Email:</span> {branch.email}</p>}
              {branch.phone && <p><span className="text-muted-foreground">Phone:</span> {branch.phone}</p>}
              <p><span className="text-muted-foreground">City:</span> {branch.city ?? "N/A"}</p>
              <p><span className="text-muted-foreground">State:</span> {branch.state ?? "N/A"}</p>
              <p><span className="text-muted-foreground">Country:</span> {branch.country}</p>
              <p><span className="text-muted-foreground">Timezone:</span> {branch.timezone}</p>
              <p><span className="text-muted-foreground">Currency:</span> {branch.currency}</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Members</p>
              <p className="mt-1 text-2xl font-black">{formatCompactNumber(branch.activeMembers)}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Revenue</p>
              <p className="mt-1 text-lg font-black">{branch.revenueFormatted}</p>
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
            {branch.warningLabels.length > 0 && (
              <div className="mt-3 space-y-1">
                {branch.warningLabels.map((w, i) => (
                  <p key={i} className="flex items-center gap-1 text-xs font-semibold text-amber-600"><AlertTriangle className="size-3" /> {w}</p>
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Timeline</p>
            <p className="mt-2 text-sm">Created: <HydrationSafeDate date={branch.createdAt} format="datetime" /></p>
            <p className="mt-1 text-sm">Updated: <HydrationSafeDate date={branch.updatedAt} format="datetime" /></p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={() => { showToast("Branch overrides coming soon.", "info"); }} variant="secondary" className="flex-1">
              <ShieldCheck className="size-4" /> Apply Override
            </Button>
            <Button onClick={() => { showToast("Branch audit logs coming soon.", "info"); }} variant="secondary" className="flex-1">
              <Eye className="size-4" /> View Audit
            </Button>
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
      {passed ? <CheckCircle2 className="size-4 text-green-500" /> : <XCircle className="size-4 text-red-400" />}
    </div>
  );
}

// Dummy ButtonLink for export
function ButtonLink({ href, variant, size, children, className }: { href: string; variant?: string; size?: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={cn("inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted", className)}>
      {children}
    </a>
  );
}
