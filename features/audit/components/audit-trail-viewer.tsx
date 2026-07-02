"use client";

import { useState, useTransition } from "react";
import { useActionState, useEffect } from "react";
import {
  Search, Filter, Download, ChevronLeft, ChevronRight,
  User, Clock, Globe, Monitor, FileText, Activity,
  AlertCircle, CheckCircle, XCircle, Info, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  getAuditLogsAction,
  getAuditStatsAction,
  getAuditFilterOptionsAction,
  exportAuditLogsCsvAction
} from "../actions/audit-actions";
import type { AuditLogRow } from "../services/audit-service";

type AuditTrailViewerProps = {
  initialFilters?: {
    entityType?: string;
    entityId?: string;
  };
};

export function AuditTrailViewer({ initialFilters }: AuditTrailViewerProps) {
  const [filters, setFilters] = useState({
    search: "",
    action: "",
    entityType: initialFilters?.entityType ?? "",
    dateFrom: "",
    dateTo: ""
  });
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const [logsData, setLogsData] = useState<{
    logs: AuditLogRow[];
    total: number;
    totalPages: number;
  } | null>(null);

  const [stats, setStats] = useState<{
    totalLogs: number;
    todayLogs: number;
    weekLogs: number;
    topActions: Array<{ action: string; count: number }>;
    topEntities: Array<{ entityType: string; count: number }>;
  } | null>(null);

  const [filterOptions, setFilterOptions] = useState<{
    actions: string[];
    entityTypes: string[];
  }>({ actions: [], entityTypes: [] });

  useEffect(() => {
    startTransition(async () => {
      const [logsResult, statsResult, optionsResult] = await Promise.all([
        getAuditLogsAction(filters, page),
        getAuditStatsAction(),
        getAuditFilterOptionsAction()
      ]);

      setLogsData({
        logs: logsResult.logs,
        total: logsResult.total,
        totalPages: logsResult.totalPages
      });
      setStats(statsResult);
      setFilterOptions(optionsResult);
    });
  }, [page, filters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleExport = async () => {
    const csv = await exportAuditLogsCsvAction(filters);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionIcon = (action: string) => {
    if (action.includes("create") || action.includes("register")) return <CheckCircle className="size-4 text-green-500" />;
    if (action.includes("delete") || action.includes("remove")) return <XCircle className="size-4 text-red-500" />;
    if (action.includes("update") || action.includes("change")) return <Activity className="size-4 text-blue-500" />;
    if (action.includes("login") || action.includes("auth")) return <User className="size-4 text-purple-500" />;
    return <Info className="size-4 text-muted-foreground" />;
  };

  const getActionColor = (action: string): "success" | "error" | "warning" | "info" | "neutral" => {
    if (action.includes("failed") || action.includes("error")) return "error";
    if (action.includes("create") || action.includes("success")) return "success";
    if (action.includes("update") || action.includes("change")) return "warning";
    if (action.includes("login") || action.includes("auth")) return "info";
    return "neutral";
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Total Logs"
            value={stats.totalLogs.toLocaleString()}
            icon={<FileText className="size-5" />}
            detail="All time audit entries"
          />
          <StatCard
            label="Today"
            value={stats.todayLogs.toLocaleString()}
            icon={<Clock className="size-5" />}
            detail="Logs recorded today"
            status="good"
          />
          <StatCard
            label="This Week"
            value={stats.weekLogs.toLocaleString()}
            icon={<Activity className="size-5" />}
            detail="Logs in last 7 days"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>

            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
            >
              <option value="">All Actions</option>
              {filterOptions.actions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>

            <select
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
            >
              <option value="">All Entity Types</option>
              {filterOptions.entityTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-auto"
              placeholder="From"
            />

            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-auto"
              placeholder="To"
            />

            <Button type="submit" variant="secondary">
              <Filter className="size-4 mr-2" />
              Apply
            </Button>

            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="size-4 mr-2" />
              Export CSV
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                {logsData?.total.toLocaleString() ?? 0} entries found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : logsData?.logs.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto size-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">No audit logs found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logsData?.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface-muted transition-colors cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="shrink-0">
                    {getActionIcon(log.action)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionColor(log.action)} className="text-xs">
                        {log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {log.entity_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {log.actor_id && (
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {log.actor_id.slice(0, 8)}...
                        </span>
                      )}
                      {log.ip_address && (
                        <span className="flex items-center gap-1">
                          <Globe className="size-3" />
                          {String(log.ip_address)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </p>
                  </div>

                  <Eye className="size-4 text-muted-foreground/50" />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {logsData && logsData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {page} of {logsData.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(logsData.totalPages, page + 1))}
                  disabled={page === logsData.totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Audit Log Detail</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">ID</p>
                  <p className="text-sm font-mono">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm">{new Date(selectedLog.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Action</p>
                  <Badge variant={getActionColor(selectedLog.action)}>{selectedLog.action}</Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Entity</p>
                  <p className="text-sm">{selectedLog.entity_type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Actor ID</p>
                  <p className="text-sm font-mono">{selectedLog.actor_id ?? "System"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Entity ID</p>
                  <p className="text-sm font-mono">{selectedLog.entity_id ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">IP Address</p>
                  <p className="text-sm">{String(selectedLog.ip_address ?? "-")}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">User Agent</p>
                  <p className="text-xs truncate">{selectedLog.user_agent ?? "-"}</p>
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata as object).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Metadata</p>
                  <pre className="p-3 rounded-lg bg-surface-muted border border-border text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
