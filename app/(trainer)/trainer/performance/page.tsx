import type { Metadata } from "next";
import { DollarSign, Star, UsersRound, Dumbbell, TrendingUp, Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { StatCard } from "@/components/ui/stat-card";
import { getTrainerCommissionSummary, getTrainerPerformanceMetrics } from "@/features/training/services/training-service";
import { requireTrainerPortalAccess } from "@/features/trainer/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "My Performance",
  description: "Track your coaching performance metrics, revenue, and commission earnings.",
  path: "/trainer/performance",
});

export default async function TrainerPerformancePage() {
  const context = await requireTrainerPortalAccess("/trainer/performance");
  const [metrics, commissions] = await Promise.all([
    getTrainerPerformanceMetrics(context.userId ?? ""),
    getTrainerCommissionSummary(context.userId ?? ""),
  ]);

  const isEmpty = metrics.assignedMembers === 0 && metrics.totalSessions === 0 && metrics.averageRating === 0 && metrics.totalRevenue === 0;

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainer" }, { label: "Performance" }]} />
      <div className="animate-fade-in-up">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Analytics</p>
        <h2 className="mt-2 text-3xl font-black">My Performance</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Track your coaching impact, session completion rates, member satisfaction, and earnings.
        </p>
      </div>

      {isEmpty && (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-12 text-center">
          <BarChart3 className="mx-auto size-12 text-muted-foreground/50" />
          <p className="mt-4 text-lg font-black text-muted-foreground">No performance data yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Start coaching sessions and completing member feedback to see your metrics appear here.</p>
        </div>
      )}

      {!isEmpty && (<>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Active coaching assignments" icon={<UsersRound className="size-5" />} label="Assigned Members" value={String(metrics.assignedMembers)} />
        <StatCard detail={`${metrics.completionRate}% completion rate`} icon={<TrendingUp className="size-5" />} label="Completed Sessions" value={String(metrics.completedSessions)} />
        <StatCard detail="Average member rating" icon={<Star className="size-5" />} label="Avg Rating" value={String(metrics.averageRating)} />
        <StatCard detail="Revenue from PT packages" icon={<DollarSign className="size-5" />} label="Total Revenue" value={`₹${(metrics.totalRevenue / 100).toLocaleString()}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Sessions completed vs total" icon={<Activity className="size-5" />} label="Session Completion Rate" value={`${metrics.completionRate}%`} />
        <StatCard detail="Active workout programs" icon={<Dumbbell className="size-5" />} label="Active Programs" value={String(metrics.activePrograms)} />
        <StatCard detail="Pending commission payout" icon={<DollarSign className="size-5" />} label="Pending Commission" value={`₹${(commissions.totalPending / 100).toLocaleString()}`} />
        <StatCard detail="Total paid commissions" icon={<DollarSign className="size-5" />} label="Paid Commission" value={`₹${(commissions.totalPaid / 100).toLocaleString()}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-accent to-purple-600 text-white shadow-glow">
                <DollarSign className="size-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black">Commission Summary</h3>
                <p className="text-xs font-semibold text-muted-foreground">Your earnings at a glance</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                <p className="text-2xl font-black text-accent">₹{(commissions.totalPending / 100).toLocaleString()}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                <p className="text-2xl font-black text-success">₹{(commissions.totalPaid / 100).toLocaleString()}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Paid</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                <p className="text-2xl font-black text-muted-foreground">{commissions.recentCount}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Total Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-glow">
                <Star className="size-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black">Coaching Impact</h3>
                <p className="text-xs font-semibold text-muted-foreground">Your coaching influence</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                <p className="text-2xl font-black">{metrics.averageRating}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Avg Rating / 5</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                <p className="text-2xl font-black">{metrics.totalSessions}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </>)}
    </div>
  );
}
