"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { Banknote, Download, FileText, TrendingUp, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/features/enterprise/lib/business-rules";
import type { PayrollRecord } from "@/features/organization-owner/services/payroll-service";
import { showToast } from "@/components/ui/toast";

type Props = {
  organizationId: string;
};

const selectClass = "h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const months = [
  { value: "1", label: "January" }, { value: "2", label: "February" }, { value: "3", label: "March" },
  { value: "4", label: "April" }, { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" }, { value: "9", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

export function PayrollModule({ organizationId }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [summary, setSummary] = useState({ totalPayroll: 0, totalTrainers: 0, avgPerTrainer: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const { getMonthlyPayroll } = await import("@/features/organization-owner/actions/payroll-actions");
      const result = await getMonthlyPayroll(organizationId, month, year);
      setRecords(result.records);
      setSummary(result.summary);
    } catch {
      setRecords([]);
      setSummary({ totalPayroll: 0, totalTrainers: 0, avgPerTrainer: 0 });
    } finally {
      setLoading(false);
    }
  }, [organizationId, month, year]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  const handleExportCSV = async () => {
    try {
      const { exportPayrollCSV } = await import("@/features/organization-owner/actions/payroll-actions");
      const csv = await exportPayrollCSV(organizationId, month, year);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${year}-${month.padStart(2, "0")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Payroll CSV exported.", "success");
    } catch {
      showToast("Failed to export CSV.", "error");
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { exportPayrollPDF } = await import("@/features/organization-owner/actions/payroll-actions");
      const pdf = await exportPayrollPDF(organizationId, month, year);
      const blob = new Blob([pdf as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${year}-${month.padStart(2, "0")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Payroll PDF exported.", "success");
    } catch {
      showToast("Failed to export PDF.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Monthly Payroll</h3>
              <p className="text-sm text-muted-foreground">Base salary + commission summary for the selected month.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select className={`w-32 ${selectClass}`} value={month} onChange={(e) => setMonth(e.target.value)}>
                {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select className={`w-24 ${selectClass}`} value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button size="sm" variant="secondary" onClick={handleExportCSV}><Download className="size-3.5" /> CSV</Button>
              <Button size="sm" variant="primary" onClick={handleExportPDF} disabled={exporting}><FileText className="size-3.5" /> {exporting ? "Generating..." : "PDF"}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading payroll data...</div>
          ) : (
            <>
              <section className="mb-6 grid gap-4 md:grid-cols-3">
                <StatCard detail="Total net payable for the month" icon={<Banknote className="size-5" />} label="Total Payroll" value={formatCurrency(summary.totalPayroll)} />
                <StatCard detail="Trainers with earnings or salary" icon={<UsersRound className="size-5" />} label="Total Trainers" value={String(summary.totalTrainers)} />
                <StatCard detail="Average net pay per trainer" icon={<TrendingUp className="size-5" />} label="Avg per Trainer" value={formatCurrency(summary.avgPerTrainer)} />
              </section>

              {records.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No payroll data for {months.find((m) => m.value === month)?.label} {year}. Trainers may not have earned commissions or salaries in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-3 py-2.5 font-bold text-muted-foreground">Trainer Name</th>
                        <th className="px-3 py-2.5 text-right font-bold text-muted-foreground">Base Salary</th>
                        <th className="px-3 py-2.5 text-right font-bold text-muted-foreground">Commissions</th>
                        <th className="px-3 py-2.5 text-right font-bold text-muted-foreground">Deductions</th>
                        <th className="px-3 py-2.5 text-right font-bold text-muted-foreground">Net Payable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.trainerId} className="border-b border-border hover:bg-surface-muted/50">
                          <td className="px-3 py-2.5 font-medium">{r.trainerName}</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(r.baseSalary)}</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(r.totalCommissions)}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(r.deductions)}</td>
                          <td className="px-3 py-2.5 text-right text-base font-black text-foreground">{formatCurrency(r.netPayable)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border font-bold">
                        <td className="px-3 py-2.5">Total</td>
                        <td className="px-3 py-2.5 text-right">{formatCurrency(records.reduce((s, r) => s + r.baseSalary, 0))}</td>
                        <td className="px-3 py-2.5 text-right">{formatCurrency(records.reduce((s, r) => s + r.totalCommissions, 0))}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(records.reduce((s, r) => s + r.deductions, 0))}</td>
                        <td className="px-3 py-2.5 text-right text-base font-black">{formatCurrency(summary.totalPayroll)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
