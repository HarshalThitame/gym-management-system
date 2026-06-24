"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, BarChart3, Download, Gift, Settings, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCurrency, formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import type { Database } from "@/types/database";

type LoyaltyConfig = Database["public"]["Tables"]["loyalty_points_config"]["Row"];

type PointsSummary = {
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  activePointsBalance: number;
  totalRedeemableValue: number;
  topEarners: { memberId: string; memberName: string; balance: number }[];
  recentActivity: { id: string; memberId: string; memberName: string; points: number; sourceType: string; description: string; createdAt: string }[];
  bySource: { check_in: number; renewal: number; referral: number; purchase: number; redemption: number };
  config: LoyaltyConfig | null;
  pointsRedemptionRate: number;
};

type Transaction = {
  id: string;
  memberId: string;
  memberName: string;
  points: number;
  sourceType: string;
  sourceId: string | null;
  description: string | null;
  createdAt: string;
};

type LoyaltyPointsPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const tabClass = (active: boolean) => `flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition-all ${active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;

export function LoyaltyPointsPanel({ dashboard, hasFeature }: LoyaltyPointsPanelProps) {
  const [tab, setTab] = useState<"dashboard" | "config" | "transactions">("dashboard");
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Config form
  const [pointsPerCheckIn, setPointsPerCheckIn] = useState(10);
  const [pointsPerRenewal, setPointsPerRenewal] = useState(5);
  const [pointsPerReferral, setPointsPerReferral] = useState(100);
  const [redemptionRate, setRedemptionRate] = useState(100);
  const [minPointsToRedeem, setMinPointsToRedeem] = useState(0);
  const [maxRedemptionPct, setMaxRedemptionPct] = useState(100);
  const [savingConfig, setSavingConfig] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [memberBalances, setMemberBalances] = useState<Record<string, number>>({});
  const [txFilters, setTxFilters] = useState({ memberId: "", sourceType: "", dateFrom: "", dateTo: "", page: 1 });
  const [loadingTx, setLoadingTx] = useState(false);
  const pageSize = 20;

  const members = dashboard.members;

  const loadSummary = useCallback(async () => {
    if (!hasFeature) return;
    setLoading(true);
    try {
      const { getPointsSummary } = await import("@/features/organization-owner/actions/loyalty-actions");
      const data = await getPointsSummary(dashboard.organization.id);
      setSummary(data);
      if (data.config) {
        setPointsPerCheckIn(data.config.points_per_check_in);
        setPointsPerRenewal(data.config.points_per_renewal_percentage);
        setPointsPerReferral(data.config.points_per_referral);
        setRedemptionRate(data.config.points_redemption_rate);
        setMinPointsToRedeem(data.config.min_points_to_redeem);
        setMaxRedemptionPct(data.config.max_redemption_percentage);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load loyalty summary.", "error");
    } finally {
      setLoading(false);
    }
  }, [hasFeature, dashboard.organization.id]);

  const loadTransactions = useCallback(async (f: typeof txFilters) => {
    if (!hasFeature) return;
    setLoadingTx(true);
    try {
      const { getPointsTransactionList } = await import("@/features/organization-owner/actions/loyalty-actions");
      const result = await getPointsTransactionList(dashboard.organization.id, {
        ...(f.memberId ? { memberId: f.memberId } : {}),
        ...(f.sourceType ? { sourceType: f.sourceType } : {}),
        ...(f.dateFrom ? { dateFrom: new Date(f.dateFrom).toISOString() } : {}),
        ...(f.dateTo ? { dateTo: new Date(f.dateTo).toISOString() } : {}),
        page: f.page,
        pageSize,
      });
      setTransactions(result.transactions);
      setTxTotal(result.total);
      setMemberBalances(result.memberBalances ?? {});
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load transactions.", "error");
    } finally {
      setLoadingTx(false);
    }
  }, [hasFeature, dashboard.organization.id]);

  const handleSaveConfig = useCallback(async () => {
    if (!hasFeature) return;
    setSavingConfig(true);
    try {
      const { saveLoyaltyConfig } = await import("@/features/organization-owner/actions/loyalty-actions");
      await saveLoyaltyConfig(dashboard.organization.id, {
        pointsPerCheckIn,
        pointsPerRenewalPercentage: pointsPerRenewal,
        pointsPerReferral,
        pointsRedemptionRate: redemptionRate,
        minPointsToRedeem,
        maxRedemptionPercentage: maxRedemptionPct,
      });
      showToast("Loyalty configuration saved.", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save config.", "error");
    } finally {
      setSavingConfig(false);
    }
  }, [hasFeature, dashboard.organization.id, pointsPerCheckIn, pointsPerRenewal, pointsPerReferral, redemptionRate, minPointsToRedeem, maxRedemptionPct]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, tab]);

  useEffect(() => {
    void loadTransactions(txFilters);
  }, [loadTransactions, txFilters, tab]);

  // Source type badge
  const sourceBadge = (type: string) => {
    const map: Record<string, { label: string; color: string }> = {
      check_in: { label: "Check-in", color: "bg-green-100 text-green-800" },
      renewal: { label: "Renewal", color: "bg-blue-100 text-blue-800" },
      referral: { label: "Referral", color: "bg-purple-100 text-purple-800" },
      purchase: { label: "Purchase", color: "bg-amber-100 text-amber-800" },
      redemption: { label: "Redemption", color: "bg-red-100 text-red-800" },
      adjustment: { label: "Adjustment", color: "bg-gray-100 text-gray-800" },
    };
    const b = map[type] ?? { label: type, color: "bg-gray-100 text-gray-800" };
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${b.color}`}>{b.label}</span>;
  };

  const totalTxPages = Math.ceil(txTotal / pageSize);

  // Build chart data for Points by Source
  const chartData = summary
    ? [
        { name: "Check-in", points: summary.bySource.check_in, fill: "#22c55e" },
        { name: "Renewal", points: summary.bySource.renewal, fill: "#3b82f6" },
        { name: "Referral", points: summary.bySource.referral, fill: "#a855f7" },
        { name: "Purchase", points: summary.bySource.purchase, fill: "#f59e0b" },
        { name: "Redemption", points: Math.abs(summary.bySource.redemption), fill: "#ef4444" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* ═══ TAB BAR ═══ */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1">
        <button className={tabClass(tab === "dashboard")} onClick={() => setTab("dashboard")} type="button">
          <BarChart3 className="size-4" /> Dashboard
        </button>
        <button className={tabClass(tab === "config")} onClick={() => setTab("config")} type="button">
          <Settings className="size-4" /> Config
        </button>
        <button className={tabClass(tab === "transactions")} onClick={() => setTab("transactions")} type="button">
          <Award className="size-4" /> Transactions
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading loyalty data...</p>
        </div>
      ) : tab === "dashboard" ? (
        <>
          {/* ═══ KPI GRID ═══ */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard detail="Total points earned across all sources" icon={<Award className="size-5" />} label="Total Points Earned" value={formatCompactNumber(summary?.totalPointsEarned ?? 0)} />
            <StatCard detail="Total points redeemed for discounts" icon={<Gift className="size-5" />} label="Total Points Redeemed" value={formatCompactNumber(Math.abs(summary?.totalPointsRedeemed ?? 0))} />
            <StatCard detail="Active points available for redemption" icon={<TrendingUp className="size-5" />} label="Active Balance" value={formatCompactNumber(summary?.activePointsBalance ?? 0)} />
            <StatCard detail={`${summary?.pointsRedemptionRate ?? 100} points = 1 INR discount`} icon={<TrendingUp className="size-5" />} label="Redeemable Value" value={formatCurrency(summary?.totalRedeemableValue ?? 0)} />
          </section>

          {/* ═══ POINTS BY SOURCE (Recharts) ═══ */}
          <Card>
            <CardHeader><h3 className="text-lg font-black">Points by Source</h3></CardHeader>
            <CardContent>
              {summary && chartData.length > 0 ? (
                <ResponsiveContainer height={250} width="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" fontSize={12} tick={{ fill: "var(--color-muted-foreground)" }} />
                    <YAxis fontSize={12} tick={{ fill: "var(--color-muted-foreground)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      formatter={(value: unknown) => [formatCompactNumber(Number(value ?? 0)), "Points"]}
                    />
                    <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell fill={entry.fill} key={`cell-${index}`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data available.</p>
              )}
            </CardContent>
          </Card>

          {/* ═══ TOP EARNERS + RECENT ═══ */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><h3 className="text-lg font-black">Top Earners</h3></CardHeader>
              <CardContent>
                {summary?.topEarners.length ? (
                  <div className="space-y-2">
                    {summary.topEarners.map((e, i) => (
                      <div key={e.memberId} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-muted-foreground w-6">#{i + 1}</span>
                          <span className="text-sm font-bold">{e.memberName}</span>
                        </div>
                        <span className="text-sm font-black">{formatCompactNumber(e.balance)} pts</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No earners yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h3 className="text-lg font-black">Recent Activity</h3></CardHeader>
              <CardContent>
                {summary?.recentActivity.length ? (
                  <div className="space-y-2">
                    {summary.recentActivity.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold truncate">{a.memberName}</span>
                            {sourceBadge(a.sourceType)}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{a.description}</p>
                        </div>
                        <span className={`text-sm font-black ml-3 shrink-0 ${a.points > 0 ? "text-green-600" : "text-red-600"}`}>
                          {a.points > 0 ? "+" : ""}{formatCompactNumber(a.points)} pts
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : tab === "config" ? (
        <Card>
          <CardHeader><h3 className="text-lg font-black">Loyalty Program Configuration</h3></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">Points per check-in</label>
                <input className={selectClass} min={0} onChange={(e) => setPointsPerCheckIn(Number(e.target.value))} type="number" value={pointsPerCheckIn} />
                <p className="text-xs text-muted-foreground mt-1">Points awarded for each daily check-in</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">Points per renewal (per 100 INR)</label>
                <input className={selectClass} min={0} onChange={(e) => setPointsPerRenewal(Number(e.target.value))} type="number" value={pointsPerRenewal} />
                <p className="text-xs text-muted-foreground mt-1">Points awarded per 100 INR spent on renewal</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">Points per referral</label>
                <input className={selectClass} min={0} onChange={(e) => setPointsPerReferral(Number(e.target.value))} type="number" value={pointsPerReferral} />
                <p className="text-xs text-muted-foreground mt-1">Points awarded for each successful referral</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">Redemption rate (points per 1 INR)</label>
                <input className={selectClass} min={1} onChange={(e) => setRedemptionRate(Number(e.target.value))} type="number" value={redemptionRate} />
                <p className="text-xs text-muted-foreground mt-1">How many points equal 1 INR discount</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">Minimum points to redeem</label>
                <input className={selectClass} min={0} onChange={(e) => setMinPointsToRedeem(Number(e.target.value))} type="number" value={minPointsToRedeem} />
                <p className="text-xs text-muted-foreground mt-1">Minimum balance required before redemption is allowed</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1.5">Max redemption (% of invoice)</label>
                <input className={selectClass} max={100} min={0} onChange={(e) => setMaxRedemptionPct(Number(e.target.value))} type="number" value={maxRedemptionPct} />
                <p className="text-xs text-muted-foreground mt-1">Maximum % of an invoice that can be paid with points</p>
              </div>
            </div>
            <div className="flex justify-end border-t border-border pt-5">
              <Button disabled={savingConfig} onClick={handleSaveConfig} variant="primary">
                {savingConfig ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ═══ FILTERS ═══ */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-muted p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Member</label>
              <select className={selectClass} onChange={(e) => setTxFilters((f) => ({ ...f, memberId: e.target.value, page: 1 }))} value={txFilters.memberId}>
                <option value="">All Members</option>
                {members.slice(0, 100).map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">Source Type</label>
              <select className={selectClass} onChange={(e) => setTxFilters((f) => ({ ...f, sourceType: e.target.value, page: 1 }))} value={txFilters.sourceType}>
                <option value="">All</option>
                <option value="check_in">Check-in</option>
                <option value="renewal">Renewal</option>
                <option value="referral">Referral</option>
                <option value="purchase">Purchase</option>
                <option value="redemption">Redemption</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">From</label>
              <input className={selectClass} onChange={(e) => setTxFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))} type="date" value={txFilters.dateFrom} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">To</label>
              <input className={selectClass} onChange={(e) => setTxFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))} type="date" value={txFilters.dateTo} />
            </div>
            <Button
              onClick={() => exportToCSV(transactions.map((t) => ({ memberName: t.memberName, balance: memberBalances[t.memberId] ?? 0, points: t.points, sourceType: t.sourceType, description: t.description, date: t.createdAt })), "loyalty-transactions")}
              size="sm"
              variant="secondary"
            >
              <Download className="size-4" /> Export CSV
            </Button>
          </div>

          {/* ═══ TRANSACTIONS TABLE ═══ */}
          <Card>
            <CardHeader><h3 className="text-lg font-black">Point Transactions ({txTotal})</h3></CardHeader>
            <CardContent>
              {loadingTx ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No transactions found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-3 font-black text-muted-foreground">Member</th>
                        <th className="pb-3 font-black text-muted-foreground">Balance</th>
                        <th className="pb-3 font-black text-muted-foreground">Points</th>
                        <th className="pb-3 font-black text-muted-foreground">Source</th>
                        <th className="pb-3 font-black text-muted-foreground">Description</th>
                        <th className="pb-3 font-black text-muted-foreground text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-border/50">
                          <td className="py-3 font-bold">{tx.memberName}</td>
                          <td className="py-3 font-bold text-muted-foreground">{formatCompactNumber(memberBalances[tx.memberId] ?? 0)}</td>
                          <td className={`py-3 font-black ${tx.points > 0 ? "text-green-600" : "text-red-600"}`}>
                            {tx.points > 0 ? "+" : ""}{formatCompactNumber(tx.points)}
                          </td>
                          <td className="py-3">{sourceBadge(tx.sourceType)}</td>
                          <td className="py-3 text-muted-foreground max-w-xs truncate">{tx.description ?? "—"}</td>
                          <td className="py-3 text-muted-foreground text-right">{new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ═══ PAGINATION ═══ */}
              {totalTxPages > 1 ? (
                <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                  <p className="text-xs text-muted-foreground">Page {txFilters.page} of {totalTxPages}</p>
                  <div className="flex items-center gap-2">
                    <Button disabled={txFilters.page <= 1} onClick={() => setTxFilters((f) => ({ ...f, page: f.page - 1 }))} size="sm" variant="secondary">Previous</Button>
                    <Button disabled={txFilters.page >= totalTxPages} onClick={() => setTxFilters((f) => ({ ...f, page: f.page + 1 }))} size="sm" variant="secondary">Next</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
