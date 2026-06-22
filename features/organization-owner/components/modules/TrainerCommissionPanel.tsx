"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Check, Download, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import type { CommissionRow, CommissionResult } from "@/features/organization-owner/actions/commission-actions";
import { markCommissionPaid, cancelCommission } from "@/features/organization-owner/actions/commission-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { showToast } from "@/components/ui/toast";

type Props = {
  organizationId: string;
  trainers: Array<{ id: string; display_name: string }>;
};

const statusColors: Record<string, string> = {
  pending: "text-amber-600 border-amber-200 bg-amber-50",
  paid: "text-green-600 border-green-200 bg-green-50",
  cancelled: "text-gray-500 border-gray-200 bg-gray-50",
};

const selectClass = "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function TrainerCommissionPanel({ organizationId, trainers }: Props) {
  const [data, setData] = useState<CommissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ trainerId: "", status: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { getTrainerCommissions } = await import("@/features/organization-owner/actions/commission-actions");
      const result = await getTrainerCommissions(organizationId, {
        trainerId: filters.trainerId || undefined,
        status: filters.status || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page,
        pageSize: 12,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId, filters, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkPaid = async (commissionId: string) => {
    const fd = new FormData();
    fd.append("commissionId", commissionId);
    const result = await markCommissionPaid(initialAuthActionState, fd);
    if (result.status === "success") showToast("Commission marked as paid.", "success");
    else showToast(result.message ?? "Failed to mark as paid.", "error");
    fetchData();
  };

  const handleCancel = async (commissionId: string) => {
    const fd = new FormData();
    fd.append("commissionId", commissionId);
    const result = await cancelCommission(initialAuthActionState, fd);
    if (result.status === "success") showToast("Commission cancelled.", "success");
    else showToast(result.message ?? "Failed to cancel.", "error");
    fetchData();
  };

  const handleExportCSV = () => {
    if (!data?.commissions.length) return;
    const rows = data.commissions.map((c) => ({
      Trainer: c.trainer_name ?? "Unknown",
      Type: formatEnterpriseLabel(c.source_type),
      Description: c.description ?? "",
      Amount: c.amount,
      Rate: `${c.rate}%`,
      Date: new Date(c.calculated_at).toLocaleDateString("en-IN"),
      Status: c.status,
    }));
    exportToCSV(rows, "trainer-commissions");
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Pending commissions" icon={<Banknote className="size-5" />} label="Pending" value={formatCurrency(data?.summary.totalPending ?? 0)} />
        <StatCard detail="Paid commissions" icon={<Check className="size-5" />} label="Paid" value={formatCurrency(data?.summary.totalPaid ?? 0)} />
        <StatCard detail="Total commission amount" icon={<Banknote className="size-5" />} label="Total Commissions" value={formatCurrency(data?.summary.totalAmount ?? 0)} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black">Commission History</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <select className={selectClass} value={filters.trainerId} onChange={(e) => setFilters((f) => ({ ...f, trainerId: e.target.value }))}>
                  <option value="">All Trainers</option>
                  {trainers.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                </select>
                <select className={selectClass} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input type="date" className={selectClass} value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} placeholder="From" />
                <input type="date" className={selectClass} value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} placeholder="To" />
                <Button size="sm" variant="secondary" onClick={() => setFilters({ trainerId: "", status: "", dateFrom: "", dateTo: "" })}><X className="size-3.5" /> Clear</Button>
              </div>
              <Button size="sm" variant="secondary" onClick={handleExportCSV}><Download className="size-3.5" /> Export CSV</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading commissions...</div>
          ) : !data?.commissions.length ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No commissions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2.5 font-bold text-muted-foreground">Trainer</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground">Source</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground">Description</th>
                    <th className="px-3 py-2.5 text-right font-bold text-muted-foreground">Amount</th>
                    <th className="px-3 py-2.5 text-right font-bold text-muted-foreground">Rate</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground">Date</th>
                    <th className="px-3 py-2.5 font-bold text-muted-foreground">Status</th>
                    <th className="px-3 py-2.5 text-right font-bold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.commissions.map((c) => (
                    <tr key={c.id} className="border-b border-border hover:bg-surface-muted/50">
                      <td className="px-3 py-2.5 font-medium">{c.trainer_name ?? "Unknown"}</td>
                      <td className="px-3 py-2.5">{formatEnterpriseLabel(c.source_type)}</td>
                      <td className="px-3 py-2.5 max-w-[200px] truncate text-muted-foreground">{c.description ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{formatCurrency(c.amount)}</td>
                      <td className="px-3 py-2.5 text-right">{c.rate}%</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{new Date(c.calculated_at).toLocaleDateString("en-IN")}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${statusColors[c.status] ?? ""}`}>
                          {formatEnterpriseLabel(c.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {c.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleMarkPaid(c.id)}><Check className="size-3.5" /> Pay</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCancel(c.id)}><X className="size-3.5" /></Button>
                          </div>
                        ) : c.status === "paid" && c.paid_at ? (
                          (() => {
                            const paidTime = new Date(c.paid_at).getTime();
                            const hoursAgo = (Date.now() - paidTime) / (1000 * 60 * 60);
                            if (hoursAgo <= 24) {
                              return (
                                <Button size="sm" variant="ghost" onClick={() => handleCancel(c.id)}>
                                  <RotateCcw className="size-3.5" /> Undo
                                </Button>
                              );
                            }
                            return null;
                          })()
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.totalPages > 1 ? (
                <div className="flex items-center justify-between pt-3">
                  <span className="text-xs text-muted-foreground">Page {page} of {data.totalPages}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                    <Button size="sm" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
