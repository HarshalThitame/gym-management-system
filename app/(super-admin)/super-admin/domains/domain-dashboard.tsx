"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, CloudCog, Download, FileText, Flag, Globe2, Loader2, RefreshCw, Search, ShieldCheck, ShieldOff, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import type { SuperAdminModule } from "@/features/super-admin/lib/super-admin-modules";

type DomainRow = Record<string, unknown>;
type CheckRow = Record<string, unknown>;
type ProviderEventRow = Record<string, unknown>;
type OrgRow = Record<string, unknown>;

type DomainStats = { domainCount: number; verifiedCount: number; failedCount: number; primaryCount: number; pendingCount: number };

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dnsTone(status: string, ssl: string): "good" | "watch" | "risk" | "neutral" {
  if (status === "verified" && ssl === "issued") return "good";
  if (status === "failed" || ssl === "failed") return "risk";
  if (status === "pending" || ssl === "pending") return "watch";
  return "neutral";
}

function toneVariant(tone: "good" | "watch" | "risk" | "neutral") {
  return tone === "good" ? "success" as const : tone === "watch" ? "info" as const : tone === "risk" ? "error" as const : "neutral" as const;
}

function StatusBadge({ status }: { status: string }) {
  const v = status === "verified" || status === "issued" ? "success" as const
    : status === "failed" ? "error" as const
    : status === "pending" ? "info" as const
    : "neutral" as const;
  return <Badge variant={v}>{status}</Badge>;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
}

type Registrar = "cloudflare" | "godaddy" | "namecheap" | "aws" | "other";

const REGISTRAR_LINKS: Record<Registrar, string> = {
  cloudflare: "https://dash.cloudflare.com",
  godaddy: "https://dcc.godaddy.com",
  namecheap: "https://ap.www.namecheap.com",
  aws: "https://console.aws.amazon.com/route53",
  other: "",
};

export function DomainDashboard({
  domains, checks, providerEvents, organizations, tenantConfigs, stats, module,
}: {
  domains: DomainRow[];
  checks: CheckRow[];
  providerEvents: ProviderEventRow[];
  organizations: OrgRow[];
  tenantConfigs: Record<string, unknown>[];
  stats: DomainStats;
  module: SuperAdminModule;
}) {
  const checksByDomain = useMemo(() => {
    const m = new Map<string, CheckRow>();
    for (const c of checks) m.set(c.tenant_domain_id as string, c);
    return m;
  }, [checks]);

  const providerByDomain = useMemo(() => {
    const m = new Map<string, ProviderEventRow>();
    for (const e of providerEvents) m.set(e.tenant_domain_id as string, e);
    return m;
  }, [providerEvents]);

  const orgMap = useMemo(() => new Map(organizations.map((o) => [o.id as string, o])), [organizations]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [providerIds, setProviderIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState<string | null>(null);
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [transferOrgId, setTransferOrgId] = useState<string>("");
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingRouting, setEditingRouting] = useState<string | null>(null);
  const PAGE_SIZE = 15;

  function setQueryAndReset(v: string) { setQuery(v); setPage(0); }
  function setStatusAndReset(v: string) { setStatusFilter(v); setPage(0); }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ column }: { column: string }) {
    if (sortKey !== column) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const computedHealthScores = useMemo(() => {
    const scores = new Map<string, { score: number; label: string }>();
    for (const d of domains) {
      const c = checksByDomain.get(d.id as string);
      let score = 100;
      if ((d.status as string) === "failed") score -= 40;
      else if ((d.status as string) === "pending") score -= 20;
      if ((d.ssl_status as string) === "failed") score -= 30;
      else if ((d.ssl_status as string) === "pending") score -= 10;
      if (c) {
        if ((c.dns_status as string) !== "passed") score -= 15;
        if ((c.tls_status as string) !== "passed") score -= 10;
        if ((c.ownership_status as string) !== "passed") score -= 10;
      }
      score = Math.max(0, score);
      const label = score >= 90 ? "Healthy" as const : score >= 70 ? "Degraded" as const : score >= 40 ? "Critical" as const : "Down" as const;
      scores.set(d.id as string, { score, label });
    }
    return scores;
  }, [domains, checksByDomain]);

  const filtered = useMemo(() => {
    let list = domains;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((d) => (d.domain as string).toLowerCase().includes(q) || (d.normalized_domain as string)?.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter((d) => (d.status as string) === statusFilter || (d.ssl_status as string) === statusFilter);
    }
    return list;
  }, [domains, query, statusFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const aVal = (a[sortKey] as string) ?? "";
      const bVal = (b[sortKey] as string) ?? "";
      const cmp = typeof aVal === "number" ? aVal - (bVal as unknown as number) : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const pagedDomains = useMemo(() => {
    const start = page * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const selectedDomain = useMemo(() => domains.find((d) => d.id === selectedId) ?? null, [domains, selectedId]);

  async function runCheck(domainId: string) {
    setCheckingIds((prev) => new Set(prev).add(domainId));
    try {
      const res = await fetch("/api/enterprise/domains/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Domain check completed", "success");
      } else {
        showToast(data.error?.message ?? "Check failed", "error");
      }
    } catch {
      showToast("Network error during check", "error");
    } finally {
      setCheckingIds((prev) => { const n = new Set(prev); n.delete(domainId); return n; });
    }
  }

  async function runProviderAction(domainId: string, action: string) {
    const key = `${domainId}:${action}`;
    setProviderIds((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/enterprise/domains/provision", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, action }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(`Vercel ${action} completed`, "success");
      } else {
        showToast(data.error?.message ?? "Provider action failed", "error");
      }
    } catch {
      showToast("Network error during provider action", "error");
    } finally {
      setProviderIds((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  async function runBulkVerify() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { showToast("Select domains first", "info"); return; }
    let success = 0, fail = 0;
    for (const id of ids) {
      setCheckingIds((prev) => new Set(prev).add(id));
      try {
        const res = await fetch("/api/enterprise/domains/check", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domainId: id }),
        });
        const data = await res.json();
        if (res.ok && data.ok) success++; else fail++;
      } catch { fail++; }
      setCheckingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
    showToast(`${success} verified, ${fail} failed`, fail > 0 ? "error" : "success");
    setSelectedIds(new Set());
  }

  async function exportCsv() {
    const headers = ["domain", "status", "ssl_status", "routing_mode", "domain_type", "is_primary", "organization", "created_at", "verified_at"];
    const rows = domains.map((d) => {
      const org = orgMap.get(d.organization_id as string);
      return [d.domain, d.status, d.ssl_status, d.routing_mode, d.domain_type, d.is_primary ? "yes" : "no", org?.name ?? "", d.created_at, d.verified_at].map((v) => `"${v ?? ""}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `domains-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported", "success");
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{module.title}</h1>
          <p className="text-sm text-muted-foreground">{module.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="neutral" className="text-xs">{module.slug}</Badge>
          <Badge variant={stats.failedCount > 0 ? "error" : stats.pendingCount > 0 ? "info" : "success"}>
            {stats.failedCount > 0 ? `${stats.failedCount} issues` : stats.pendingCount > 0 ? `${stats.pendingCount} pending` : "All good"}
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</span></div>
          <span className="text-2xl font-black">{stats.domainCount}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Verified</span></div>
          <span className="text-2xl font-black text-green-600">{stats.verifiedCount}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending</span></div>
          <span className="text-2xl font-black text-amber-600">{stats.pendingCount}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2"><XCircle className="h-4 w-4 text-red-600" /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Failed</span></div>
          <span className="text-2xl font-black text-red-600">{stats.failedCount}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2"><Flag className="h-4 w-4 text-purple-600" /><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary</span></div>
          <span className="text-2xl font-black text-purple-600">{stats.primaryCount}</span>
        </Card>
      </div>

      {/* Charts Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status Distribution</p>
          <div className="space-y-1.5">
            {[
              { label: "Verified", count: stats.verifiedCount, color: "bg-green-500" },
              { label: "Pending", count: stats.pendingCount, color: "bg-amber-500" },
              { label: "Failed", count: stats.failedCount, color: "bg-red-500" },
              { label: "Disabled", count: stats.domainCount - stats.verifiedCount - stats.pendingCount - stats.failedCount, color: "bg-gray-400" },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-muted-foreground">{b.label}</span>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${stats.domainCount > 0 ? (b.count / stats.domainCount) * 100 : 0}%` }} />
                </div>
                <span className="w-8 text-right font-bold">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">SSL Health</p>
          <div className="space-y-1.5">
            {["issued", "managed_by_vercel", "pending", "failed", "not_applicable"].map((ssl) => {
              const count = domains.filter((d) => (d.ssl_status as string) === ssl).length;
              return (
                <div key={ssl} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 text-muted-foreground truncate">{ssl}</span>
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${ssl === "failed" ? "bg-red-500" : ssl === "pending" ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${domains.length > 0 ? (count / domains.length) * 100 : 0}%` }} />
                  </div>
                  <span className="w-8 text-right font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Health Score Distribution</p>
          {(["Healthy", "Degraded", "Critical", "Down"] as const).map((label) => {
            const count = Array.from(computedHealthScores.values()).filter((h) => h.label === label).length;
            const color = label === "Healthy" ? "bg-green-500" : label === "Degraded" ? "bg-amber-500" : label === "Critical" ? "bg-orange-500" : "bg-red-500";
            return (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${computedHealthScores.size > 0 ? (count / computedHealthScores.size) * 100 : 0}%` }} />
                </div>
                <span className="w-8 text-right font-bold">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search domains..." value={query} onChange={(e) => setQueryAndReset(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusAndReset(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="failed">Failed</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50">
          <span className="text-sm font-semibold">{selectedIds.size} selected</span>
          <Button size="sm" variant="secondary" onClick={runBulkVerify} disabled={checkingIds.size > 0}>
            {checkingIds.size > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Verify DNS
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setShowAddDomain(true)}><Globe2 className="h-4 w-4 mr-1" />Add Domain</Button>
        <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
        {selectedIds.size > 0 && (
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant="secondary" onClick={runBulkVerify}><RefreshCw className="h-4 w-4 mr-1" />Verify ({selectedIds.size})</Button>
            <div className="relative" onFocus={(e) => { const t = e.currentTarget.querySelector<HTMLSelectElement>("select"); if (t) t.size = 4; }} onBlur={(e) => { const t = e.currentTarget.querySelector<HTMLSelectElement>("select"); if (t) t.size = 1; }}>
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer" onChange={async (e) => {
                const val = e.target.value; e.target.value = "";
                if (!val || selectedIds.size === 0) return;
                if (val === "transfer") { setShowTransfer(Array.from(selectedIds)[0]!); return; }
                if (val === "export") { exportCsv(); return; }
                if (val.startsWith("routing:")) {
                  const mode = val.split(":")[1];
                  await fetch("/api/enterprise/domains/bulk-routing", {
                    method: "PATCH", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ domainIds: Array.from(selectedIds), routingMode: mode }),
                  });
                  showToast(`Routing updated to ${mode}`, "success");
                  setSelectedIds(new Set());
                }
              }}>
                <option value="">Bulk actions...</option>
                <option value="transfer">Transfer selected</option>
                <option value="export">Export selected</option>
                <option value="routing:organization">Set routing: Org</option>
                <option value="routing:branch">Set routing: Branch</option>
                <option value="routing:gym">Set routing: Gym</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Domain Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="p-3 text-left w-10">
                <input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? new Set(domains.map((d) => d.id as string)) : new Set())} checked={selectedIds.size === domains.length && domains.length > 0} className="rounded" />
              </th>
              <th className="p-3 text-left font-semibold cursor-pointer hover:text-foreground/80 select-none" onClick={() => toggleSort("domain")}>Domain<SortIcon column="domain" /></th>
              <th className="p-3 text-left font-semibold cursor-pointer hover:text-foreground/80 select-none hidden sm:table-cell" onClick={() => toggleSort("domain_type")}>Type<SortIcon column="domain_type" /></th>
              <th className="p-3 text-left font-semibold cursor-pointer hover:text-foreground/80 select-none hidden md:table-cell" onClick={() => toggleSort("routing_mode")}>Routing<SortIcon column="routing_mode" /></th>
              <th className="p-3 text-left font-semibold cursor-pointer hover:text-foreground/80 select-none" onClick={() => toggleSort("status")}>Status<SortIcon column="status" /></th>
              <th className="p-3 text-left font-semibold cursor-pointer hover:text-foreground/80 select-none hidden lg:table-cell" onClick={() => toggleSort("ssl_status")}>SSL<SortIcon column="ssl_status" /></th>
              <th className="p-3 text-left font-semibold cursor-pointer hover:text-foreground/80 select-none hidden 2xl:table-cell" onClick={() => toggleSort("health")}>Health<SortIcon column="health" /></th>
              <th className="p-3 text-left font-semibold hidden xl:table-cell">Org</th>
              <th className="p-3 text-left font-semibold cursor-pointer hover:text-foreground/80 select-none hidden lg:table-cell" onClick={() => toggleSort("last_checked_at")}>Checked<SortIcon column="last_checked_at" /></th>
              <th className="p-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedDomains.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No domains found.</td></tr>
            ) : (
              pagedDomains.map((domain) => {
                const did = domain.id as string;
                const check = checksByDomain.get(did);
                const providerEv = providerByDomain.get(did);
                const org = orgMap.get(domain.organization_id as string);
                const tone = dnsTone(domain.status as string, domain.ssl_status as string);
                const isChecking = checkingIds.has(did);
                const isProvisioning = providerIds.has(`${did}:add`) || providerIds.has(`${did}:sync`);

                return (
                  <tr key={did} className={`border-b border-border hover:bg-muted/30 cursor-pointer transition-colors ${selectedId === did ? "bg-muted/50" : ""}`} onClick={() => setSelectedId(did)}>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(did)} onChange={(e) => setSelectedIds((prev) => { const n = new Set(prev); e.target.checked ? n.add(did) : n.delete(did); return n; })} className="rounded" />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-mono text-xs font-bold truncate max-w-[200px]">{domain.domain as string}</span>
                        {(domain.is_primary as boolean) && <Badge variant="premium" className="text-[10px] px-1 py-0">Primary</Badge>}
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell"><span className="text-xs">{domain.domain_type as string}</span></td>
                    <td className="p-3 hidden md:table-cell">
                      {editingRouting === did ? (
                        <select className="text-xs border border-input rounded px-1 py-0.5" autoFocus value={domain.routing_mode as string} onChange={async (e) => {
                          const mode = e.target.value;
                          await fetch("/api/enterprise/domains/bulk-routing", {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ domainIds: [did], routingMode: mode }),
                          });
                          setEditingRouting(null);
                          showToast(`Routing set to ${mode}`, "success");
                        }} onBlur={() => setEditingRouting(null)}>
                          <option value="organization">Org</option>
                          <option value="branch">Branch</option>
                          <option value="gym">Gym</option>
                        </select>
                      ) : (
                        <button className="text-xs border-b border-dashed border-muted-foreground/30 hover:border-foreground/50 transition-colors cursor-pointer" onClick={() => setEditingRouting(did)} title="Click to change routing">
                          {domain.routing_mode as string}
                        </button>
                      )}
                    </td>
                    <td className="p-3"><StatusBadge status={domain.status as string} /></td>
                    <td className="p-3 hidden lg:table-cell"><StatusBadge status={domain.ssl_status as string} /></td>
                    <td className="p-3 hidden 2xl:table-cell">
                      {(() => {
                        const h = computedHealthScores.get(did);
                        if (!h) return <span className="text-xs text-muted-foreground">—</span>;
                        const color = h.score >= 90 ? "text-green-600" : h.score >= 70 ? "text-amber-600" : h.score >= 40 ? "text-orange-600" : "text-red-600";
                        return <span className={`text-xs font-bold ${color}`}>{h.score}%</span>;
                      })()}
                    </td>
                    <td className="p-3 hidden xl:table-cell"><span className="text-xs truncate max-w-[150px] block">{org?.name as string ?? "—"}</span></td>
                    <td className="p-3 hidden lg:table-cell"><span className="text-xs text-muted-foreground">{formatDate(domain.last_checked_at as string | null)}</span></td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => runCheck(did)} disabled={isChecking} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50" title="Check DNS & SSL">
                          {isChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => runProviderAction(did, "add")} disabled={isProvisioning} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50" title="Add to Vercel">
                          {isProvisioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudCog className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => runProviderAction(did, "verify")} disabled={providerIds.has(`${did}:verify`)} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50" title="Verify with Vercel">
                          {providerIds.has(`${did}:verify`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{sorted.length} domain{sorted.length !== 1 ? "s" : ""} · Page {page + 1} of {totalPages}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors">Previous</button>
          {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
            const startPage = Math.max(0, Math.min(page - 3, totalPages - 7));
            const p = startPage + i;
            if (p >= totalPages) return null;
            return (
              <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>
                {p + 1}
              </button>
            );
          })}
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors">Next</button>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedDomain && (
        <DomainDetailPanel
          domain={selectedDomain}
          check={checksByDomain.get(selectedDomain.id as string) ?? null}
          providerEvent={providerByDomain.get(selectedDomain.id as string) ?? null}
          orgName={(orgMap.get(selectedDomain.organization_id as string)?.name as string) ?? null}
                    onCheck={() => runCheck(selectedDomain.id as string)}
                    onProviderAction={(action) => runProviderAction(selectedDomain.id as string, action)}
                    onViewHistory={() => setShowHistory(selectedDomain.id as string)}
                    onTransfer={() => setShowTransfer(selectedDomain.id as string)}
                    isChecking={checkingIds.has(selectedDomain.id as string)}
          isProvisioning={providerIds.has(`${selectedDomain.id as string}:add`) || providerIds.has(`${selectedDomain.id as string}:sync`)}
        />
      )}

      {/* History Modal */}
      {showHistory && (
        <HistoryModal domainId={showHistory} onClose={() => setShowHistory(null)} />
      )}

      {/* Transfer Dialog */}
      {showTransfer && (
        <TransferDialog domainId={showTransfer} organizations={organizations} onClose={() => { setShowTransfer(null); setTransferOrgId(""); }} />
      )}

      {/* Add Domain Modal */}
      {showAddDomain && (
        <AddDomainModal organizations={organizations} onClose={() => setShowAddDomain(false)} />
      )}
    </div>
  );
}

function DomainDetailPanel({
  domain, check, providerEvent, orgName, onCheck, onProviderAction, onViewHistory, onTransfer, isChecking, isProvisioning,
}: {
  domain: DomainRow;
  check: CheckRow | null;
  providerEvent: ProviderEventRow | null;
  orgName: string | null;
  onCheck: () => void;
  onProviderAction: (action: string) => void;
  onViewHistory: () => void;
  onTransfer: () => void;
  isChecking: boolean;
  isProvisioning: boolean;
}) {
  const [registrar, setRegistrar] = useState<Registrar>("other");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"dns" | "ssl" | "provider" | "health">("dns");

  const records = useMemo(() => {
    const domainName = domain.domain as string;
    const token = domain.verification_token as string;
    const txtHost = `_apex-verify.${domainName}`;
    const txtValue = `apex-verify=${token}`;
    const cnameTarget = `cname.${domainName}`;
    const aRecord = "76.76.21.21";
    return [
      { type: "A", host: "@", value: aRecord, purpose: "traffic" as const },
      { type: "CNAME", host: "www", value: `${domainName}.`, purpose: "traffic" as const },
      { type: "TXT", host: txtHost, value: txtValue, purpose: "ownership" as const },
    ];
  }, [domain]);

  async function handleCopy(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const checkError = check?.error_message as string | null;
  const providerError = providerEvent?.error_message as string | null;
  const providerStatus = providerEvent?.operation_status as string | null;

  return (
    <Card className="p-4 sm:p-6">
      {/* Domain Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Globe2 className="h-5 w-5" />
            <h2 className="text-lg font-bold font-mono">{domain.domain as string}</h2>
            <StatusBadge status={domain.status as string} />
            <StatusBadge status={domain.ssl_status as string} />
            {(domain.is_primary as boolean) && <Badge variant="premium">Primary</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {orgName ?? "Unknown"} · {domain.routing_mode as string} routing · {domain.domain_type as string}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={onCheck} disabled={isChecking}>
            {isChecking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Check Now
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onProviderAction("add")} disabled={isProvisioning}>
            {isProvisioning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CloudCog className="h-4 w-4 mr-1" />}
            Add to Vercel
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onProviderAction("verify")} disabled={providerEvent?.operation_status === "pending"}>
            <ShieldCheck className="h-4 w-4 mr-1" />Verify
          </Button>
          <Button size="sm" variant="ghost" onClick={onViewHistory}><FileText className="h-4 w-4 mr-1" />History</Button>
          <Button size="sm" variant="ghost" onClick={onTransfer}><Globe2 className="h-4 w-4 mr-1" />Transfer</Button>
        </div>
      </div>

      {/* Error Messages */}
      {checkError && <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2"><XCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{checkError}</span></div>}
      {providerError && <div className="mb-4 p-3 rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-700 flex items-start gap-2"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{providerError}</span></div>}

      {/* Detail Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 mb-4 overflow-x-auto">
        {(["dns", "ssl", "provider", "health"] as const).map((tab) => (
          <button key={tab} onClick={() => setDetailTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${detailTab === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === "dns" ? "DNS Configuration" : tab === "ssl" ? "SSL/TLS" : tab === "provider" ? "Provider" : "Health"}
          </button>
        ))}
      </div>

      {/* DNS Configuration Tab */}
      {detailTab === "dns" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm font-semibold">Add these DNS records at your domain registrar:</p>
            <div className="flex items-center gap-2">
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={registrar} onChange={(e) => setRegistrar(e.target.value as Registrar)}>
                <option value="cloudflare">Cloudflare</option>
                <option value="godaddy">GoDaddy</option>
                <option value="namecheap">Namecheap</option>
                <option value="aws">AWS Route53</option>
                <option value="other">Other</option>
              </select>
              <a href={`/api/enterprise/domains/zone-export?domainId=${domain.id as string}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Button size="sm" variant="ghost" type="button"><FileText className="h-4 w-4 mr-1" />Zone File</Button>
              </a>
            </div>
          </div>

          {registrar !== "other" && (
            <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-800">
              <p className="font-semibold">Instructions for {registrar}:</p>
              <ol className="list-decimal ml-4 mt-1 space-y-1 text-xs">
                <li>Log into <a href={REGISTRAR_LINKS[registrar]} target="_blank" rel="noopener noreferrer" className="underline">{registrar}</a></li>
                <li>Navigate to your domain's DNS settings</li>
                <li>Add the A record pointing to {records[0]!.value}</li>
                <li>Add the CNAME record for www subdomain</li>
                <li>Add the TXT verification record</li>
                <li>Return here and click "Check Now" to verify</li>
              </ol>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((rec) => (
              <div key={rec.type + rec.host} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={rec.purpose === "ownership" ? "info" : "neutral"}>{rec.type}</Badge>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rec.purpose}</span>
                </div>
                <div className="space-y-1.5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Host</p>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 block text-xs font-mono bg-muted rounded px-1.5 py-0.5 truncate">{rec.host}</code>
                      <button onClick={() => handleCopy(rec.host, `${rec.type}-host`)} className="shrink-0 p-1 rounded hover:bg-muted transition-colors">
                        {copiedField === `${rec.type}-host` ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Value</p>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 block text-xs font-mono bg-muted rounded px-1.5 py-0.5 truncate">{rec.value}</code>
                      <button onClick={() => handleCopy(rec.value, `${rec.type}-value`)} className="shrink-0 p-1 rounded hover:bg-muted transition-colors">
                        {copiedField === `${rec.type}-value` ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>DNS propagation can take 5 minutes to 48 hours. After adding records, click "Check Now" to verify. If verification fails, check that records exactly match the values above.</span>
          </div>
        </div>
      )}

      {/* SSL/TLS Tab */}
      {detailTab === "ssl" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-md border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
              <p className="text-sm font-bold mt-1"><StatusBadge status={domain.ssl_status as string} /></p>
            </div>
            <div className="p-3 rounded-md border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Provider</p>
              <p className="text-sm font-bold mt-1">{domain.routing_mode as string === "organization" ? "Vercel (Let's Encrypt)" : "System"}</p>
            </div>
            <div className="p-3 rounded-md border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Last Checked</p>
              <p className="text-sm font-bold mt-1">{formatDate(domain.last_checked_at as string | null)}</p>
            </div>
            <div className="p-3 rounded-md border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Verified At</p>
              <p className="text-sm font-bold mt-1">{formatDate(domain.verified_at as string | null)}</p>
            </div>
          </div>

          {/* Enhanced SSL Certificate Card */}
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Certificate Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground text-xs">Issuer</span><p className="font-mono text-xs font-bold">Let's Encrypt Authority X3</p></div>
              <div><span className="text-muted-foreground text-xs">Subject</span><p className="font-mono text-xs font-bold truncate">{domain.domain as string}</p></div>
              <div><span className="text-muted-foreground text-xs">Valid From</span><p className="font-bold text-xs">{formatDate(domain.verified_at as string | null)}</p></div>
              <div>
                <span className="text-muted-foreground text-xs">Auto-Renewal</span>
                <p className="font-bold text-xs flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${domain.ssl_status === "failed" ? "bg-red-500" : "bg-green-500"} inline-block`} />
                  {domain.ssl_status === "failed" ? "Not renewing (failed)" : domain.ssl_status === "pending" ? "Pending" : "Active — auto-renewed by Vercel"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xs text-muted-foreground">Days Until Expiry</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${domain.ssl_status === "failed" ? "bg-red-500" : domain.ssl_status === "pending" ? "bg-amber-500" : "bg-green-500"}`} style={{ width: domain.ssl_status === "issued" || domain.ssl_status === "managed_by_vercel" ? "90%" : "10%" }} />
                </div>
                <span className="text-xs font-bold shrink-0">{domain.ssl_status === "issued" || domain.ssl_status === "managed_by_vercel" ? "Auto-renewing" : "—"}</span>
              </div>
            </div>
          </div>

          {domain.ssl_status === "failed" && (
            <div className="p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div><p className="font-semibold">SSL certificate issuance failed.</p><p className="text-xs mt-1">Common causes: DNS records not propagated, CA validation failed, domain not reachable. Click "Check Now" to retry after DNS updates.</p></div>
            </div>
          )}

          <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>SSL is managed automatically by Vercel via Let's Encrypt. Certificates are issued within minutes of DNS propagation and auto-renew before expiry. No manual renewal required.</span>
          </div>
        </div>
      )}

      {/* Provider Tab */}
      {detailTab === "provider" && (
        <div className="space-y-4">
          {providerEvent ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="p-3 rounded-md border border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Last Operation</p>
                <p className="text-sm font-bold mt-1">{providerEvent.operation as string}</p>
              </div>
              <div className="p-3 rounded-md border border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                <p className="text-sm font-bold mt-1"><StatusBadge status={providerEvent.operation_status as string} /></p>
              </div>
              <div className="p-3 rounded-md border border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</p>
                <p className="text-sm font-bold mt-1">{formatDate(providerEvent.created_at as string | null)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No provider events recorded. Use "Add to Vercel" to register this domain with the CDN provider.</p>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => onProviderAction("add")} disabled={isProvisioning}>
              {isProvisioning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CloudCog className="h-4 w-4 mr-1" />}Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onProviderAction("sync")}>
              <RefreshCw className="h-4 w-4 mr-1" />Sync
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onProviderAction("verify")}>
              <ShieldCheck className="h-4 w-4 mr-1" />Verify
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onProviderAction("remove")}>
              <Trash2 className="h-4 w-4 mr-1" />Remove
            </Button>
          </div>
        </div>
      )}

      {/* Health Tab */}
      {detailTab === "health" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-md border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">DNS Health</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`h-2.5 w-2.5 rounded-full ${(check?.dns_status as string) === "passed" ? "bg-green-500" : (check?.dns_status as string) === "failed" ? "bg-red-500" : "bg-amber-500"}`} />
                <span className="text-sm font-bold">{((check?.dns_status as string) ?? "unknown")}</span>
              </div>
            </div>
            <div className="p-3 rounded-md border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SSL Health</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`h-2.5 w-2.5 rounded-full ${(check?.tls_status as string) === "passed" ? "bg-green-500" : "bg-amber-500"}`} />
                <span className="text-sm font-bold">{((check?.tls_status as string) ?? "unknown")}</span>
              </div>
            </div>
            <div className="p-3 rounded-md border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ownership</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`h-2.5 w-2.5 rounded-full ${(check?.ownership_status as string) === "passed" ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm font-bold">{((check?.ownership_status as string) ?? "unknown")}</span>
              </div>
            </div>
            <div className="p-3 rounded-md border border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overall</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`h-2.5 w-2.5 rounded-full ${(check?.check_status as string) === "passed" ? "bg-green-500" : (check?.check_status as string) === "failed" ? "bg-red-500" : "bg-amber-500"}`} />
                <span className="text-sm font-bold">{((check?.check_status as string) ?? "No checks")}</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-md bg-muted/50">
            <p className="text-xs font-semibold mb-3">Health Timeline</p>
            <div className="space-y-2">
               {!!(domain.created_at as string) && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-muted-foreground w-28 shrink-0">{formatDate(domain.created_at as string)}</span>
                  <span>Domain registered</span>
                </div>
              )}
              {!!(domain.verified_at as string) && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-muted-foreground w-28 shrink-0">{formatDate(domain.verified_at as string)}</span>
                  <span>Domain verified</span>
                </div>
              )}
              {!!(domain.last_checked_at as string) && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-muted-foreground w-28 shrink-0">{formatDate(domain.last_checked_at as string)}</span>
                  <span>Last health check</span>
                </div>
              )}
              {check && (
                <div className="flex items-center gap-3 text-xs">
                  <div className={`h-2 w-2 rounded-full ${check.check_status === "passed" ? "bg-green-500" : "bg-red-500"} shrink-0`} />
                  <span className="text-muted-foreground w-28 shrink-0">{formatDate(check.checked_at as string)}</span>
                  <span>Check: {check.check_status as string} (DNS: {check.dns_status as string}, TLS: {check.tls_status as string})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </Card>
  );
}

function HistoryModal({ domainId, onClose }: { domainId: string; onClose: () => void }) {
  const [data, setData] = useState<{ checks: Array<Record<string, unknown>>; providerEvents: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/enterprise/domains/history?domainId=${domainId}`)
      .then((r) => r.json())
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [domainId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[70vh] overflow-y-auto rounded-lg bg-background shadow-xl border border-border p-4 sm:p-6 mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Verification History</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><XCircle className="h-5 w-5" /></button>
        </div>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />)}</div>
        ) : data ? (
          <div className="space-y-4">
            {data.checks.length === 0 && data.providerEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history recorded yet.</p>
            ) : (
              <>
                {data.checks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">DNS &amp; SSL Checks</p>
                    <div className="space-y-1">
                      {data.checks.map((c) => (
                        <div key={c.id as string} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 text-xs">
                          <StatusBadge status={c.check_status as string} />
                          <span className="text-muted-foreground">DNS: <StatusBadge status={c.dns_status as string} /> SSL: <StatusBadge status={c.tls_status as string} /> Owner: <StatusBadge status={c.ownership_status as string} /></span>
                          <span className="ml-auto text-muted-foreground">{formatDate(c.checked_at as string)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.providerEvents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Provider Events</p>
                    <div className="space-y-1">
                      {data.providerEvents.map((e) => (
                        <div key={e.id as string} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 text-xs">
                          <span className="font-mono font-bold">{e.operation as string}</span>
                          <StatusBadge status={e.operation_status as string} />
                          {!!(e.error_message as string) && <span className="text-red-600 truncate max-w-[200px]">{e.error_message as string}</span>}
                          <span className="ml-auto text-muted-foreground">{formatDate(e.created_at as string)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-red-600">Failed to load history.</p>
        )}
      </div>
    </div>
  );
}

function TransferDialog({ domainId, organizations, onClose }: { domainId: string; organizations: OrgRow[]; onClose: () => void }) {
  const [target, setTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleTransfer() {
    if (!target) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/enterprise/domains/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, targetOrganizationId: target }),
      });
      const data = await res.json();
      setResult(data.message ?? data.error ?? "Transfer completed");
      if (data.ok) setTimeout(onClose, 1500);
    } catch {
      setResult("Transfer failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-background shadow-xl border border-border p-4 sm:p-6 mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">Transfer Domain</h3>
        <p className="text-sm text-muted-foreground mb-4">Select the target organization to transfer this domain to.</p>
        <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mb-3" value={target} onChange={(e) => setTarget(e.target.value)} disabled={submitting}>
          <option value="">Select organization...</option>
          {organizations.map((o) => <option key={o.id as string} value={o.id as string}>{o.name as string}</option>)}
        </select>
        <div className="flex gap-2">
          <Button onClick={handleTransfer} disabled={!target || submitting} size="sm">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Transfer</Button>
          <Button onClick={onClose} variant="ghost" size="sm">Cancel</Button>
        </div>
        {result && <p className="mt-3 text-sm font-semibold">{result}</p>}
      </div>
    </div>
  );
}

function AddDomainModal({ organizations, onClose }: { organizations: OrgRow[]; onClose: () => void }) {
  const [orgId, setOrgId] = useState("");
  const [domain, setDomain] = useState("");
  const [routing, setRouting] = useState("organization");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleCreate() {
    if (!orgId || !domain) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/enterprise/domains/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: "new", action: "add", domain, organizationId: orgId, routingMode: routing }),
      });
      const data = await res.json();
      setResult(data.message ?? data.error ?? "Domain added");
      if (data.ok) setTimeout(onClose, 1500);
    } catch {
      setResult("Failed to add domain");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-background shadow-xl border border-border p-4 sm:p-6 mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Add Domain</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1">Organization</p>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={submitting}>
              <option value="">Select organization...</option>
              {organizations.map((o) => <option key={o.id as string} value={o.id as string}>{o.name as string}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Domain</p>
            <input className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-mono" placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} disabled={submitting} />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1">Routing Mode</p>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={routing} onChange={(e) => setRouting(e.target.value)} disabled={submitting}>
              <option value="organization">Organization</option>
              <option value="branch">Branch</option>
              <option value="gym">Gym</option>
            </select>
          </div>
          <Button onClick={handleCreate} disabled={!orgId || !domain || submitting} className="w-full">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Add Domain</Button>
          {result && <p className="text-sm font-semibold">{result}</p>}
        </div>
      </div>
    </div>
  );
}
