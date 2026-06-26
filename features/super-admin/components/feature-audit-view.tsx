"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Wrench,
  Download,
  Search,
  Filter,
  Activity,
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { FeatureAuditRow, PlanAudit, FeatureAuditReport } from "../services/feature-audit-types";

type SortColumn = "featureCode" | "category" | "status" | "gapSeverity" | "planValue";
type SortDirection = "asc" | "desc";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  FULLY_IMPLEMENTED:  { label: "Implemented",  color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="size-3.5" /> },
  PARTIAL:            { label: "Partial",       color: "bg-amber-50 text-amber-700 border-amber-200",      icon: <AlertTriangle className="size-3.5" /> },
  CONFIGURED_ONLY:    { label: "Configured",    color: "bg-orange-50 text-orange-700 border-orange-200",    icon: <AlertCircle className="size-3.5" /> },
  NOT_IMPLEMENTED:    { label: "Not Built",     color: "bg-red-50 text-red-700 border-red-200",            icon: <XCircle className="size-3.5" /> },
  SERVICE_OR_INFRA:   { label: "Service",       color: "bg-gray-50 text-gray-500 border-gray-200",         icon: <Wrench className="size-3.5" /> },
};
const DEFAULT_STATUS_CONFIG = {
  label: "Not Built",
  color: "bg-red-50 text-red-700 border-red-200",
  icon: <XCircle className="size-3.5" />,
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  "P0":  { label: "P0", color: "bg-red-50 text-red-700" },
  "P1":  { label: "P1", color: "bg-orange-50 text-orange-700" },
  "P2":  { label: "P2", color: "bg-yellow-50 text-yellow-700" },
  "N/A": { label: "-",  color: "bg-gray-50 text-gray-400" },
};
const DEFAULT_SEVERITY_CONFIG = { label: "-", color: "bg-gray-50 text-gray-400" };

type FilterStatus = "all" | "FULLY_IMPLEMENTED" | "PARTIAL" | "CONFIGURED_ONLY" | "NOT_IMPLEMENTED" | "SERVICE_OR_INFRA";
type FilterSeverity = "all" | "P0" | "P1" | "P2" | "N/A";

const ALL_CATEGORIES = "all";
const ALL_STATUSES: FilterStatus[] = ["all", "FULLY_IMPLEMENTED", "PARTIAL", "CONFIGURED_ONLY", "NOT_IMPLEMENTED", "SERVICE_OR_INFRA"];
const ALL_SEVERITIES: FilterSeverity[] = ["all", "P0", "P1", "P2", "N/A"];

function exportToCsv(plan: PlanAudit) {
  const headers = ["Feature Code", "Category", "Plan Value", "In FEATURE_KEYS", "Module Map", "Sidebar", "Route", "Actions", "UI", "Status", "Gap Severity"];
  const rows = plan.features.map((f) => [
    f.featureCode,
    f.category,
    f.planValue,
    f.inFeatureKeys ? "Yes" : "No",
    f.hasModuleMap ?? "-",
    f.hasSidebar ?? "-",
    f.hasRoute ? "Yes" : "No",
    f.hasActions ? "Yes" : "No",
    f.hasUI ? "Yes" : "No",
    STATUS_CONFIG[f.status]?.label ?? f.status,
    f.gapSeverity,
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${plan.packageSlug}-feature-audit.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, count, color, icon }: { label: string; count: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
      <div className={`flex items-center justify-center size-10 rounded-full ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold">{count}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function FeatureAuditView({ report }: { report: FeatureAuditReport }) {
  const [activePlanIdx, setActivePlanIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("featureCode");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const activePlan = report.plans[activePlanIdx];

  const allCategories = useMemo(() => {
    if (!activePlan) return [];
    const cats = new Set(activePlan.features.map((f) => f.category));
    return [ALL_CATEGORIES, ...Array.from(cats).sort()];
  }, [activePlan]);

  const filteredFeatures = useMemo(() => {
    if (!activePlan) return [];
    const filtered = activePlan.features.filter((f) => {
      if (search && !f.featureCode.toLowerCase().includes(search.toLowerCase()) && !f.category.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (severityFilter !== "all" && f.gapSeverity !== severityFilter) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (showGapsOnly && f.status === "FULLY_IMPLEMENTED") return false;
      return true;
    });

    const severityOrder: Record<string, number> = { "P0": 0, "P1": 1, "P2": 2, "N/A": 3 };
    const statusOrder: Record<string, number> = {
      "FULLY_IMPLEMENTED": 0, "PARTIAL": 1, "CONFIGURED_ONLY": 2, "NOT_IMPLEMENTED": 3, "SERVICE_OR_INFRA": 4
    };

    filtered.sort((a, b) => {
      let cmp = 0;
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortColumn) {
        case "featureCode":
          cmp = a.featureCode.localeCompare(b.featureCode);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category) || a.featureCode.localeCompare(b.featureCode);
          break;
        case "status":
          cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99) || a.featureCode.localeCompare(b.featureCode);
          break;
        case "gapSeverity":
          cmp = (severityOrder[a.gapSeverity] ?? 99) - (severityOrder[b.gapSeverity] ?? 99) || a.featureCode.localeCompare(b.featureCode);
          break;
        case "planValue":
          cmp = a.planValue.localeCompare(b.planValue) || a.featureCode.localeCompare(b.featureCode);
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });

    return filtered;
  }, [activePlan, search, statusFilter, severityFilter, categoryFilter, showGapsOnly, sortColumn, sortDirection]);

  if (!activePlan) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
        <AlertCircle className="size-12 mb-4" />
        <p className="text-lg font-medium">No audit data available</p>
        <p className="text-sm">No active packages found with feature data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="size-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Feature Availability Audit</h1>
        </div>
        <p className="text-muted-foreground">
          Compare what each plan promises in <code className="text-xs bg-muted px-1 py-0.5 rounded">package_features</code> against what is actually implemented in the application code.
        </p>
      </div>

      {/* Plan Tabs */}
      <div className="flex gap-1 border-b">
        {report.plans.map((plan, idx) => (
          <button
            key={plan.packageId}
            onClick={() => setActivePlanIdx(idx)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
              idx === activePlanIdx
                ? "bg-background text-foreground border-border"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {plan.packageName}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total Features" count={activePlan.summary.totalFeatures} color="bg-blue-50 text-blue-600" icon={<Activity className="size-4" />} />
        <SummaryCard label="Implemented" count={activePlan.summary.fullyImplemented} color="bg-emerald-50 text-emerald-600" icon={<CheckCircle2 className="size-4" />} />
        <SummaryCard label="Partial" count={activePlan.summary.partial} color="bg-amber-50 text-amber-600" icon={<AlertTriangle className="size-4" />} />
        <SummaryCard label="Configured Only" count={activePlan.summary.configuredOnly} color="bg-orange-50 text-orange-600" icon={<AlertCircle className="size-4" />} />
        <SummaryCard label="Not Built" count={activePlan.summary.notImplemented} color="bg-red-50 text-red-600" icon={<XCircle className="size-4" />} />
        <SummaryCard label="Service/Infra" count={activePlan.summary.serviceInfra} color="bg-gray-50 text-gray-500" icon={<Wrench className="size-4" />} />
      </div>

      {/* Implementation Rate Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Implementation Rate</span>
          <span className="text-sm font-bold">{activePlan.summary.implementationRate}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${activePlan.summary.implementationRate}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Based on {(activePlan.summary.totalFeatures - activePlan.summary.serviceInfra)} trackable features (service/infrastructure features excluded). Partially implemented features count as 50%.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          className="px-3 py-2 text-sm border rounded-md bg-background"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Statuses" : STATUS_CONFIG[s]?.label ?? s}</option>
          ))}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as FilterSeverity)}
          className="px-3 py-2 text-sm border rounded-md bg-background"
        >
          {ALL_SEVERITIES.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Severities" : s}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-md bg-background"
        >
          {allCategories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showGapsOnly}
            onChange={(e) => setShowGapsOnly(e.target.checked)}
            className="size-4 rounded border-muted-foreground"
          />
          Gaps only
        </label>

        <button
          onClick={() => exportToCsv(activePlan)}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md bg-background hover:bg-muted transition-colors"
        >
          <Download className="size-4" />
          Export CSV
        </button>
      </div>

      {/* Feature Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                {([
                  { col: "featureCode" as SortColumn, label: "Feature Code", align: "text-left" },
                  { col: "category" as SortColumn, label: "Category", align: "text-left" },
                  { col: "planValue" as SortColumn, label: "Plan Value", align: "text-left" },
                ]).map(({ col, label, align }) => (
                  <th key={col} className={`${align} p-3 font-semibold cursor-pointer select-none hover:bg-muted/80 transition-colors`} onClick={() => toggleSort(col)}>
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortColumn === col
                        ? (sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)
                        : <ArrowUpDown className="size-3.5 text-muted-foreground/40" />
                      }
                    </span>
                  </th>
                ))}
                <th className="text-center p-3 font-semibold">Sidebar</th>
                <th className="text-center p-3 font-semibold">Route</th>
                <th className="text-center p-3 font-semibold">Actions</th>
                <th className="text-center p-3 font-semibold">UI</th>
                {([
                  { col: "status" as SortColumn, label: "Status" },
                  { col: "gapSeverity" as SortColumn, label: "Gap" },
                ]).map(({ col, label }) => (
                  <th key={col} className="text-center p-3 font-semibold cursor-pointer select-none hover:bg-muted/80 transition-colors" onClick={() => toggleSort(col)}>
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortColumn === col
                        ? (sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)
                        : <ArrowUpDown className="size-3.5 text-muted-foreground/40" />
                      }
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFeatures.map((row) => {
                const statusCfg = STATUS_CONFIG[row.status] ?? DEFAULT_STATUS_CONFIG;
                const severityCfg = SEVERITY_CONFIG[row.gapSeverity] ?? DEFAULT_SEVERITY_CONFIG;
                return (
                  <tr key={row.featureCode} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">{row.featureCode}</td>
                    <td className="p-3 text-muted-foreground">{row.category}</td>
                    <td className="p-3 font-mono text-xs">{row.planValue}</td>
                    <td className="p-3 text-center">
                      {row.hasSidebar ? (
                        <span className="text-xs text-emerald-600 font-medium">{row.hasSidebar}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.hasRoute ? (
                        <CheckCircle2 className="size-4 text-emerald-500 inline" />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.hasActions ? (
                        <CheckCircle2 className="size-4 text-emerald-500 inline" />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.hasUI ? (
                        <CheckCircle2 className="size-4 text-emerald-500 inline" />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${severityCfg.color}`}>
                        {severityCfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredFeatures.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <Filter className="size-5 inline mr-2" />
                    No features match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overall Summary */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Overall Platform Summary</h3>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Features</span>
            <div className="font-bold">{report.summary.totalFeatures}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Implemented</span>
            <div className="font-bold text-emerald-600">{report.summary.implemented}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Partial</span>
            <div className="font-bold text-amber-600">{report.summary.partial}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Configured</span>
            <div className="font-bold text-orange-600">{report.summary.configured}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Not Built</span>
            <div className="font-bold text-red-600">{report.summary.notImplemented}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Overall Rate</span>
            <div className="font-bold">{report.summary.implementationRate}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
