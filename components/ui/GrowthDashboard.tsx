"use client";

import { BarChart3, Gift, Mail, MessageSquare, Phone, Target, TrendingUp, Users } from "lucide-react";

type DashboardProps = {
  analytics: {
    campaigns: { total: number; active: number; totalSpend: number; totalBudget: number };
    leads: { total: number; converted: number };
    referrals: { total: number; awarded: number; converted: number };
  };
};

export function GrowthDashboard({ analytics }: DashboardProps) {
  const conversionRate = analytics.leads.total > 0
    ? Math.round((analytics.leads.converted / analytics.leads.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Leads"
          value={analytics.leads.total}
          icon={<Users className="size-5" />}
          color="blue"
        />
        <KPICard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          icon={<Target className="size-5" />}
          color="green"
        />
        <KPICard
          title="Active Campaigns"
          value={analytics.campaigns.active}
          icon={<TrendingUp className="size-5" />}
          color="purple"
        />
        <KPICard
          title="Referrals"
          value={analytics.referrals.total}
          icon={<Gift className="size-5" />}
          color="amber"
        />
      </div>

      {/* Channels */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h3 className="mb-4 font-black">Marketing Channels</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { name: "WhatsApp", icon: <MessageSquare className="size-5" />, desc: "Lead follow-up, reminders, offers", color: "text-green-600 bg-green-50" },
            { name: "Email", icon: <Mail className="size-5" />, desc: "Campaigns, automation, nurturing", color: "text-blue-600 bg-blue-50" },
            { name: "Phone/SMS", icon: <Phone className="size-5" />, desc: "Call follow-ups, trial confirmations", color: "text-purple-600 bg-purple-50" },
          ].map((ch) => (
            <div key={ch.name} className={`rounded-lg border border-border p-4 ${ch.color}`}>
              <div className="flex items-center gap-2">
                {ch.icon}
                <span className="font-bold">{ch.name}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{ch.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Campaign & Referral Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="mb-3 font-black">Campaign Spend</h3>
          <p className="text-3xl font-black">₹{(analytics.campaigns.totalSpend / 100).toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">
            of ₹{(analytics.campaigns.totalBudget / 100).toLocaleString()} budget
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${analytics.campaigns.totalBudget > 0 ? Math.min((analytics.campaigns.totalSpend / analytics.campaigns.totalBudget) * 100, 100) : 0}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="mb-3 font-black">Referral Program</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-black">{analytics.referrals.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-2xl font-black">{analytics.referrals.awarded}</p>
              <p className="text-xs text-muted-foreground">Rewarded</p>
            </div>
            <div>
              <p className="text-2xl font-black">{analytics.referrals.converted}</p>
              <p className="text-xs text-muted-foreground">Converted</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-green-200 bg-green-50 text-green-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] ?? ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider">{title}</p>
          <p className="mt-1 text-3xl font-black">{value}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}
