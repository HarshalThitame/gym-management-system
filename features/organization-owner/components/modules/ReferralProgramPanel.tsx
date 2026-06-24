"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, BarChart3, Download, Gift, Settings, TrendingUp, UserRoundPlus, UsersRound, X } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import type { Database } from "@/types/database";

type ReferralConfig = Database["public"]["Tables"]["referral_program_config"]["Row"];

type ReferralReward = {
  id: string;
  referrerId: string;
  referrerName: string;
  referredMemberId: string;
  referredName: string;
  rewardType: string;
  rewardValue: number;
  status: string;
  earnedAt: string | null;
  paidAt: string | null;
  expiryDate: string | null;
  membershipId: string | null;
  notes: string | null;
  createdAt: string;
};

type ReferralStats = {
  totalReferrals: number;
  totalRewardsEarned: number;
  totalRewardsPaid: number;
  topReferrers: { member_id: string; full_name: string; referral_count: number; rewards_earned: number }[];
  recentReferrals: { id: string; referrerName: string; referredName: string; date: string; status: string; rewardType: string; rewardValue: number }[];
  config: ReferralConfig | null;
};

type ReferralProgramPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ReferralProgramPanel({ dashboard, hasFeature }: ReferralProgramPanelProps) {
  const [tab, setTab] = useState<"dashboard" | "config" | "referrals">("dashboard");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Config form state
  const [rewardType, setRewardType] = useState("discount");
  const [rewardValue, setRewardValue] = useState(10);
  const [minMembershipDays, setMinMembershipDays] = useState(30);
  const [maxRewards, setMaxRewards] = useState(0);
  const [savingConfig, setSavingConfig] = useState(false);

  // Referral list state
  const [referrals, setReferrals] = useState<ReferralReward[]>([]);
  const [referralTotal, setReferralTotal] = useState(0);
  const [filters, setFilters] = useState<{ status: string; referrerId: string; dateFrom: string; dateTo: string; page: number }>({ status: "", referrerId: "", dateFrom: "", dateTo: "", page: 1 });
  const [loadingReferrals, setLoadingReferrals] = useState(false);

  const pageSize = 20;

  const loadStats = useCallback(async () => {
    if (!hasFeature) return;
    setLoading(true);
    try {
      const { getReferralStats } = await import("@/features/organization-owner/actions/referral-actions");
      const data = await getReferralStats(dashboard.organization.id);
      setStats(data);

      // Populate config form
      if (data.config) {
        setRewardType(data.config.reward_type);
        setRewardValue(data.config.reward_value);
        setMinMembershipDays(data.config.min_membership_days);
        setMaxRewards(data.config.max_rewards_per_referrer);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load referral stats.", "error");
    } finally {
      setLoading(false);
    }
  }, [hasFeature, dashboard.organization.id]);

  const loadReferrals = useCallback(async () => {
    if (!hasFeature) return;
    setLoadingReferrals(true);
    try {
      const { getReferralList } = await import("@/features/organization-owner/actions/referral-actions");
      const result = await getReferralList(dashboard.organization.id, {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.referrerId ? { referrerId: filters.referrerId } : {}),
        ...(filters.dateFrom ? { dateFrom: new Date(filters.dateFrom).toISOString() } : {}),
        ...(filters.dateTo ? { dateTo: new Date(filters.dateTo).toISOString() } : {}),
        page: filters.page,
        pageSize,
      });
      setReferrals(result.referrals);
      setReferralTotal(result.total);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load referrals.", "error");
    } finally {
      setLoadingReferrals(false);
    }
  }, [hasFeature, dashboard.organization.id, filters]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (tab === "referrals") loadReferrals(); }, [tab, loadReferrals]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const { saveReferralConfig } = await import("@/features/organization-owner/actions/referral-actions");
      await saveReferralConfig(dashboard.organization.id, {
        rewardType,
        rewardValue,
        minMembershipDays,
        maxRewards,
      });
      showToast("Referral config saved.", "success");
      loadStats();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save config.", "error");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleMarkPaid = async (rewardId: string) => {
    try {
      const { markRewardPaid } = await import("@/features/organization-owner/actions/referral-actions");
      await markRewardPaid(dashboard.organization.id, rewardId);
      showToast("Reward marked as paid.", "success");
      loadStats();
      loadReferrals();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to mark reward as paid.", "error");
    }
  };

  const handleExportCSV = () => {
    const data = referrals.map((r) => ({
      referrer: r.referrerName,
      referred: r.referredName,
      date: r.createdAt,
      rewardType: r.rewardType,
      rewardValue: r.rewardValue,
      status: r.status,
      earnedAt: r.earnedAt ?? "",
      paidAt: r.paidAt ?? "",
      expiryDate: r.expiryDate ?? "",
    }));
    exportToCSV(data, "referral-rewards");
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-gray-100 text-gray-600",
      earned: "bg-green-100 text-green-700",
      paid: "bg-blue-100 text-blue-700",
      expired: "bg-red-100 text-red-500",
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${colors[status] ?? "bg-gray-100 text-gray-500"}`}>
        {status}
      </span>
    );
  };

  if (!hasFeature) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Gift className="size-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Referral Program is available on the Enterprise plan.</p>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading referral data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ TAB BAR ═══ */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1">
        <button
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition-all ${tab === "dashboard" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("dashboard")}
          type="button"
        >
          <BarChart3 className="size-4" /> Dashboard
        </button>
        <button
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition-all ${tab === "config" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("config")}
          type="button"
        >
          <Settings className="size-4" /> Configuration
        </button>
        <button
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition-all ${tab === "referrals" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setTab("referrals")}
          type="button"
        >
          <UsersRound className="size-4" /> All Referrals
        </button>
      </div>

      {/* ═══ DASHBOARD TAB ═══ */}
      {tab === "dashboard" && stats ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard detail="Total successful referrals" icon={<UsersRound className="size-5" />} label="Total Referrals" value={String(stats.totalReferrals)} />
            <StatCard detail="Rewards earned and awaiting payout" icon={<Award className="size-5" />} label="Rewards Earned" value={String(stats.totalRewardsEarned)} />
            <StatCard detail="Rewards paid out" icon={<TrendingUp className="size-5" />} label="Rewards Paid" value={String(stats.totalRewardsPaid)} />
            <StatCard detail="Pending reward payouts" icon={<Gift className="size-5" />} label="Pending Payouts" value={String(stats.totalRewardsEarned - stats.totalRewardsPaid)} />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Top Referrers */}
            <Card>
              <CardHeader><h3 className="text-lg font-black">Top Referrers</h3></CardHeader>
              <CardContent>
                {stats.topReferrers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No referrals yet.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topReferrers.map((tr, i) => (
                      <div key={tr.member_id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-7 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-bold">{tr.full_name}</p>
                            <p className="text-xs text-muted-foreground">{tr.referral_count} referral{tr.referral_count !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <span className="text-sm font-black text-green-600">{tr.rewards_earned} earned</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Referrals */}
            <Card>
              <CardHeader><h3 className="text-lg font-black">Recent Referrals</h3></CardHeader>
              <CardContent>
                {stats.recentReferrals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent referrals.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recentReferrals.map((rr) => (
                      <div key={rr.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                        <div>
                          <p className="text-sm font-bold">{rr.referrerName} → {rr.referredName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(rr.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {rr.rewardType} ({rr.rewardValue}{rr.rewardType === "discount" ? "%" : ""})
                          </p>
                        </div>
                        {statusBadge(rr.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* ═══ CONFIG TAB ═══ */}
      {tab === "config" ? (
        <Card>
          <CardHeader><h3 className="text-lg font-black">Reward Configuration</h3></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-black text-muted-foreground">Reward Type</label>
                <select className={selectClass} value={rewardType} onChange={(e) => setRewardType(e.target.value)}>
                  <option value="discount">Discount on renewal (%)</option>
                  <option value="credit">Account credit (₹)</option>
                  <option value="free_month">Free month(s)</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-black text-muted-foreground">
                  Reward Value {rewardType === "discount" ? "(%)" : rewardType === "credit" ? "(paise)" : "(months)"}
                </label>
                <input
                  className={selectClass}
                  type="number"
                  min={1}
                  value={rewardValue}
                  onChange={(e) => setRewardValue(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-black text-muted-foreground">Min Membership Days</label>
                <input
                  className={selectClass}
                  type="number"
                  min={1}
                  value={minMembershipDays}
                  onChange={(e) => setMinMembershipDays(Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-muted-foreground">Days referred member must stay before reward is earned.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-black text-muted-foreground">Max Rewards per Referrer</label>
                <input
                  className={selectClass}
                  type="number"
                  min={0}
                  value={maxRewards}
                  onChange={(e) => setMaxRewards(Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-muted-foreground">0 = unlimited.</p>
              </div>
            </div>
            <div className="flex justify-end border-t border-border pt-5">
              <Button onClick={handleSaveConfig} disabled={savingConfig} size="sm" variant="primary">
                {savingConfig ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ═══ ALL REFERRALS TAB ═══ */}
      {tab === "referrals" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black">All Referrals ({referralTotal})</h3>
              <div className="flex items-center gap-2">
                <Button onClick={handleExportCSV} size="sm" variant="secondary" disabled={referrals.length === 0}>
                  <Download className="size-4" /> Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select
                className={`${selectClass} h-9 w-36`}
                value={filters.referrerId}
                onChange={(e) => setFilters((f) => ({ ...f, referrerId: e.target.value, page: 1 }))}
              >
                <option value="">All referrers</option>
                {dashboard.members.filter((m) => m.referral_code).map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
              <select
                className={`${selectClass} h-9 w-36`}
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="earned">Earned</option>
                <option value="paid">Paid</option>
                <option value="expired">Expired</option>
              </select>
              <input
                className={`${selectClass} h-9 w-40`}
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))}
                placeholder="From date"
              />
              <input
                className={`${selectClass} h-9 w-40`}
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))}
                placeholder="To date"
              />
              {(filters.status || filters.referrerId || filters.dateFrom || filters.dateTo) ? (
                <button
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                  onClick={() => setFilters({ status: "", referrerId: "", dateFrom: "", dateTo: "", page: 1 })}
                  type="button"
                >
                  <X className="size-3" /> Clear
                </button>
              ) : null}
            </div>

            {loadingReferrals ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading referrals...</p>
              </div>
            ) : referrals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <UserRoundPlus className="size-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No referral records found.</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Referrer</th>
                      <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Referred</th>
                      <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Reward</th>
                      <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                      <th className="px-4 py-2 text-right text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.id} className="border-b border-border/50 transition-colors hover:bg-surface-muted">
                        <td className="px-4 py-2.5"><p className="text-sm font-bold">{r.referrerName}</p></td>
                        <td className="px-4 py-2.5"><p className="text-sm">{r.referredName}</p></td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          {r.rewardType === "discount" ? `${r.rewardValue}% discount` : r.rewardType === "credit" ? `₹${r.rewardValue / 100}` : `${r.rewardValue} month${r.rewardValue !== 1 ? "s" : ""}`}
                        </td>
                        <td className="px-4 py-2.5">{statusBadge(r.status)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {r.status === "earned" ? (
                            <Button onClick={() => handleMarkPaid(r.id)} size="sm" variant="secondary">
                              Mark Paid
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {referralTotal > pageSize ? (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Showing {(filters.page - 1) * pageSize + 1}–{Math.min(filters.page * pageSize, referralTotal)} of {referralTotal}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        disabled={filters.page <= 1}
                        onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                        size="sm"
                        variant="secondary"
                      >
                        Previous
                      </Button>
                      <Button
                        disabled={filters.page * pageSize >= referralTotal}
                        onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                        size="sm"
                        variant="secondary"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
