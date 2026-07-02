import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  Download,
  Dumbbell,
  FileSpreadsheet,
  LineChart,
  RefreshCcw,
  Target,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricTile } from "@/components/ui/metric-tile";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AttendanceHeatmap,
  ClassUtilizationAnalyticsChart,
  LeadFunnelChart,
  MembershipTrendChart,
  RevenueTrendChart,
  TrainerUtilizationChart
} from "@/features/analytics/components/lazy-analytics-charts";
import {
  DashboardConfigForm,
  ForecastModelForm,
  InsightStatusForm,
  ReportExportForm,
  SavedReportForm
} from "@/features/analytics/components/analytics-forms";
import { AnalyticsStatusBadge, KpiStatusBadge } from "@/features/analytics/components/analytics-status-badge";
import { formatAnalyticsLabel, formatCurrency } from "@/features/analytics/lib/business-rules";
import { getExecutiveAnalyticsDashboard } from "@/features/analytics/services/analytics-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { canAny } from "@/lib/rbac";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import type { KpiCard } from "@/types/analytics";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import { CustomReportBuilder } from "@/features/custom-reports/components/custom-report-builder";
import { ScheduledReportsManager } from "@/features/scheduled-reports/components/scheduled-reports-manager";

export const metadata: Metadata = createMetadata({
  title: "Analytics and Reporting Center",
  description: "Executive dashboards, KPI monitoring, analytics, forecasts, reports, and export controls for gym management.",
  path: "/admin/reports"
});

const legacyReports = [
  { label: "Membership Report", href: "/api/memberships/reports?format=csv", detail: "Plans, renewals, active members, and expiry queues." },
  { label: "Attendance Report", href: "/api/attendance/reports?format=csv", detail: "Check-ins, live occupancy, peak hours, and inactive members." },
  { label: "Class Report", href: "/api/classes/reports?format=csv", detail: "Bookings, attendance, no-shows, waitlists, and utilization." },
  { label: "Fitness Report", href: "/api/fitness/reports?format=csv", detail: "Goals, workouts, measurements, nutrition, and progress outcomes." },
  { label: "Trainer Report", href: "/api/training/reports?format=csv", detail: "Assignments, PT sessions, revenue, ratings, and staff activity." }
] as const;

export default async function AdminReportsPage() {
  const scope = await requireGymAdminScope("/admin/reports");
  const gymId = scope.gymId;
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "advanced_reports", actionName: "admin.analytics.read" });
  const canRequestReports = canAny(scope.roles, "reports", "export");
  const [dashboard, planContext] = await Promise.all([
    getExecutiveAnalyticsDashboard(gymId),
    organizationId ? getOrgPlanContext(organizationId) : null
  ]);
  const advancedReportsEnabled = planContext?.features.advancedReportsEnabled === true;
  const canExportReports = canRequestReports && advancedReportsEnabled;

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Executive Intelligence</p>
          <h2 className="mt-2 text-3xl font-black">Analytics, reporting, and business insights</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Monitor revenue, memberships, attendance, trainers, classes, fitness outcomes, retention risk, sales conversion, forecasting baselines, and audit-ready exports from one management workspace.
          </p>
        </div>
        {canExportReports ? <div className="flex flex-wrap gap-2">
          <ButtonLink href="/api/analytics/reports?key=executive_kpi_snapshot&format=csv" variant="secondary">
            <Download className="size-4" />
            KPI CSV
          </ButtonLink>
          <ButtonLink href="/api/analytics/reports?key=revenue_sources&format=excel" variant="secondary">
            <FileSpreadsheet className="size-4" />
            Revenue Excel
          </ButtonLink>
          <ButtonLink href="/api/analytics/reports?key=sales_funnel&format=pdf" variant="accent">
            <BarChart3 className="size-4" />
            Sales PDF
          </ButtonLink>
        </div> : canRequestReports ? (
          <FeatureLocked compact featureName="Advanced Report Exports" requiredPlan="Standard" />
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.kpis.map((kpi) => <KpiMetricCard key={kpi.key} kpi={kpi} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Revenue Analytics</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Daily revenue split by memberships, renewals, personal training, and class fees.</p>
              </div>
              {canExportReports ? <ButtonLink href="/api/analytics/reports?key=revenue_sources&format=csv" size="sm" variant="secondary">Export</ButtonLink> : null}
            </div>
          </CardHeader>
          <CardContent><RevenueTrendChart data={dashboard.revenueTrend} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Revenue Sources</h3>
            <p className="text-sm leading-6 text-muted-foreground">Current month contribution by revenue stream.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.revenueSources.map((source) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={source.source}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{source.source}</p>
                  <p className="text-sm font-black">{source.percentage}%</p>
                </div>
                <p className="mt-2 text-2xl font-black">{formatCurrency(source.amount)}</p>
                <div className="mt-3 h-2 rounded-full bg-border">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(source.percentage, 100)}%` }} />
                </div>
              </div>
            ))}
            {dashboard.revenueSources.length === 0 ? <EmptyState text="No paid revenue has been recorded for the current month." /> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Membership Analytics</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">New members, renewals, and expiries across the last 30 days.</p>
              </div>
              {canExportReports ? <ButtonLink href="/api/analytics/reports?key=membership_retention&format=csv" size="sm" variant="secondary">Export</ButtonLink> : null}
            </div>
          </CardHeader>
          <CardContent><MembershipTrendChart data={dashboard.membershipTrend} /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Retention Intelligence</h3>
            <p className="text-sm leading-6 text-muted-foreground">Churn, inactive member risk, and lifetime value signals for renewal operations.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Retention Rate" value={`${dashboard.retention.retentionRate}%`} detail="Active share of membership base" />
            <MetricTile label="Churn Rate" value={`${dashboard.retention.churnRate}%`} detail="Expired and cancelled share" />
            <MetricTile label="Inactive Members" value={String(dashboard.retention.inactiveMembers)} detail="Members without recent visits" />
            <MetricTile label="Estimated LTV" value={formatCurrency(dashboard.retention.estimatedLifetimeValue)} detail={`${dashboard.retention.churnRiskMembers} members at risk`} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Attendance Heatmap</h3>
            <p className="text-sm leading-6 text-muted-foreground">Peak hour detection from validated gym entry sessions.</p>
          </CardHeader>
          <CardContent>
            {dashboard.attendanceHeatmap.length > 0 ? <AttendanceHeatmap data={dashboard.attendanceHeatmap} /> : <EmptyState text="Attendance heatmap will populate after check-ins are logged." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Sales Funnel</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Lead source and status conversion signals for marketing decisions.</p>
              </div>
              {canExportReports ? <ButtonLink href="/api/analytics/reports?key=sales_funnel&format=csv" size="sm" variant="secondary">Export</ButtonLink> : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[0.9fr_1fr]">
            <LeadFunnelChart data={dashboard.leadFunnel} />
            <div className="space-y-3">
              {dashboard.leadFunnel.slice(0, 8).map((row) => (
                <div className="rounded-md border border-border bg-surface-muted p-3" key={`${row.source}-${row.status}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{row.source}</p>
                    <p className="text-sm font-black">{row.leads}</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{row.status} · {row.conversionRate}% conversion</p>
                </div>
              ))}
              {dashboard.leadFunnel.length === 0 ? <EmptyState text="No lead activity is available for funnel analytics." /> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Trainer Performance</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Assigned members, completed sessions, PT revenue, ratings, and utilization.</p>
              </div>
              {canExportReports ? <ButtonLink href="/api/analytics/reports?key=trainer_scorecard&format=csv" size="sm" variant="secondary">Export</ButtonLink> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrainerUtilizationChart data={dashboard.trainerScorecards} />
            <div className="grid gap-3">
              {dashboard.trainerScorecards.slice(0, 5).map((trainer) => (
                <div className="grid gap-2 rounded-md border border-border bg-surface-muted p-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center" key={trainer.trainerId}>
                  <div>
                    <p className="font-black">{trainer.trainerName}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{trainer.assignedMembers} assigned · {trainer.completedSessions}/{trainer.scheduledSessions} sessions</p>
                  </div>
                  <p className="font-black">{formatCurrency(trainer.ptRevenue)}</p>
                  <p className="text-xs font-bold text-muted-foreground">{trainer.averageRating}/5 rating</p>
                </div>
              ))}
              {dashboard.trainerScorecards.length === 0 ? <EmptyState text="Trainer scorecards will appear after sessions, packages, or feedback exist." /> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Class Utilization</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Fill rate, bookings, capacity, and waitlist pressure across group sessions.</p>
              </div>
              {canExportReports ? <ButtonLink href="/api/analytics/reports?key=class_utilization&format=csv" size="sm" variant="secondary">Export</ButtonLink> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ClassUtilizationAnalyticsChart data={dashboard.classScorecards} />
            <div className="grid gap-3">
              {dashboard.classScorecards.slice(0, 5).map((item) => (
                <div className="rounded-md border border-border bg-surface-muted p-3" key={item.className}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">{item.className}</p>
                    <p className="text-sm font-black">{item.fillRate}%</p>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.booked}/{item.capacity} booked · {item.sessions} sessions · {item.waitlist} waitlisted</p>
                </div>
              ))}
              {dashboard.classScorecards.length === 0 ? <EmptyState text="Class utilization analytics will appear after scheduled class sessions exist." /> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Fitness Outcomes</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Goal completion, workout adherence, nutrition compliance, and progress engagement.</p>
              </div>
              {canExportReports ? <ButtonLink href="/api/analytics/reports?key=fitness_outcomes&format=csv" size="sm" variant="secondary">Export</ButtonLink> : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {dashboard.fitnessOutcomes.map((outcome) => <MetricTile detail={outcome.detail} key={outcome.label} label={outcome.label} value={`${outcome.value}%`} />)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Forecasting Foundation</h3>
            <p className="text-sm leading-6 text-muted-foreground">Baseline forecasts created from moving averages and operating signals. The model registry prepares the system for future AI forecasts.</p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {dashboard.forecasts.map((forecast) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={forecast.metricKey}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{formatAnalyticsLabel(forecast.confidence)} confidence</p>
                <p className="mt-2 font-black">{forecast.label}</p>
                <p className="mt-3 text-3xl font-black">{Math.round(forecast.forecastValue).toLocaleString("en-IN")}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{forecast.horizonDays}-day horizon</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5" />
              <h3 className="text-2xl font-black">Alerts and Actionable Insights</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Generated and stored alerts highlight revenue drops, attendance dips, churn risk, trainer underutilization, class underperformance, sales issues, and fitness adherence problems.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.insights.map((insight) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={insight.id}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{insight.title}</p>
                      <AnalyticsStatusBadge status={insight.severity} />
                      <AnalyticsStatusBadge status={insight.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight.description}</p>
                    <p className="mt-2 text-xs font-bold text-muted-foreground">{insight.recommendation}</p>
                  </div>
                  <div className="text-sm font-black text-foreground">{formatAnalyticsLabel(insight.insight_type)}</div>
                </div>
                {canExportReports ? (
                  <div className="mt-3">
                    <InsightStatusForm insight={insight} />
                  </div>
                ) : null}
              </div>
            ))}
            {dashboard.insights.length === 0 ? <EmptyState text="No open business insights need attention." /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Plan Popularity</h3>
            <p className="text-sm leading-6 text-muted-foreground">Active membership distribution and plan revenue concentration.</p>
          </CardHeader>
          <CardContent className="space-y-3">
             {(dashboard.membershipAnalytics.planPopularity ?? []).map((plan) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={plan.plan}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{plan.plan}</p>
                  <p className="text-sm font-bold text-muted-foreground">{plan.members} members</p>
                </div>
                <p className="mt-2 text-2xl font-black">{formatCurrency(plan.revenue)}</p>
              </div>
            ))}
            {(dashboard.membershipAnalytics.planPopularity ?? []).length === 0 ? <EmptyState text="Plan popularity will appear after active memberships are assigned." /> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Report Center</h3>
            <p className="text-sm leading-6 text-muted-foreground">Searchable report templates and export shortcuts for executive, financial, membership, attendance, trainer, class, fitness, retention, and sales analysis.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.savedReports.map((report) => (
              <div className="grid gap-3 rounded-md border border-border bg-surface-muted p-4 lg:grid-cols-[1fr_auto] lg:items-center" key={report.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{report.name}</p>
                    <AnalyticsStatusBadge status={report.status} />
                    <AnalyticsStatusBadge status={report.category} />
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{report.description ?? "Reusable analytics report template."}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">Last run: {report.last_run_at ? new Date(report.last_run_at).toLocaleString("en-IN") : "Not run yet"}</p>
                </div>
                {canExportReports ? <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/api/analytics/reports?key=${report.report_key}&format=csv`} size="sm" variant="secondary">CSV</ButtonLink>
                  <ButtonLink href={`/api/analytics/reports?key=${report.report_key}&format=excel`} size="sm" variant="secondary">Excel</ButtonLink>
                  <ButtonLink href={`/api/analytics/reports?key=${report.report_key}&format=pdf`} size="sm" variant="ghost">PDF</ButtonLink>
                </div> : null}
              </div>
            ))}
            {dashboard.savedReports.length === 0 ? <EmptyState text="No saved report templates are active yet." /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Operational Exports</h3>
            <p className="text-sm leading-6 text-muted-foreground">Existing module-level CSV exports remain available for operations teams.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {!advancedReportsEnabled && canRequestReports ? (
              <FeatureLocked compact featureName="Operational Exports" requiredPlan="Standard" />
            ) : null}
            {legacyReports.map((report) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={report.href}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">{report.label}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{report.detail}</p>
                  </div>
                  {canExportReports ? <ButtonLink href={report.href} size="sm" variant="secondary">CSV</ButtonLink> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {canExportReports ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Saved Report Builder</h3>
              <p className="text-sm leading-6 text-muted-foreground">Create reusable report templates with default filters, visible columns, category, and sharing scope.</p>
            </CardHeader>
            <CardContent><SavedReportForm reports={dashboard.savedReports} /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Export Queue</h3>
              <p className="text-sm leading-6 text-muted-foreground">Queue auditable exports and download generated analytics in CSV, Excel-compatible HTML, or PDF format.</p>
            </CardHeader>
            <CardContent><ReportExportForm reports={dashboard.savedReports} /></CardContent>
          </Card>
        </section>
      ) : canRequestReports ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <FeatureLocked
            description="Saved report builders and custom export queues are available on Standard and higher plans."
            featureName="Saved Report Builder"
            requiredPlan="Standard"
          />
          <FeatureLocked
            description="CSV, Excel, and PDF export queue management is available on Standard and higher plans."
            featureName="Export Queue"
            requiredPlan="Standard"
          />
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Dashboard Customization</h3>
            <p className="text-sm leading-6 text-muted-foreground">Save role-based dashboard layouts and widget lists for executive, admin, trainer, and member analytics views.</p>
          </CardHeader>
          <CardContent><DashboardConfigForm configs={dashboard.dashboardConfigs} /></CardContent>
        </Card>

        {canExportReports ? <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Forecast Model Registry</h3>
            <p className="text-sm leading-6 text-muted-foreground">Register moving average, linear trend, seasonal baseline, or manual forecast models with training windows and parameters.</p>
          </CardHeader>
          <CardContent><ForecastModelForm models={dashboard.forecastModels} /></CardContent>
        </Card> : canRequestReports ? (
          <FeatureLocked
            description="Forecast model configuration is part of advanced reporting and is available on Standard and higher plans."
            featureName="Forecast Models"
            requiredPlan="Standard"
          />
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Recent Export Audit</h3>
            <p className="text-sm leading-6 text-muted-foreground">Export requests are stored for traceability, status monitoring, and future background job processing.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.reportExports.map((item) => (
              <div className="grid gap-2 rounded-md border border-border bg-surface-muted p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center" key={item.id}>
                <div>
                  <p className="font-black">{formatAnalyticsLabel(item.report_key)}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatAnalyticsLabel(item.category)} · {new Date(item.created_at).toLocaleString("en-IN")}</p>
                </div>
                <AnalyticsStatusBadge status={item.status} />
                <p className="text-xs font-bold text-muted-foreground">{formatAnalyticsLabel(item.format)}</p>
              </div>
            ))}
            {dashboard.reportExports.length === 0 ? <EmptyState text="No report exports have been queued yet." /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Data Aggregation Layer</h3>
            <p className="text-sm leading-6 text-muted-foreground">Analytics tables, business metrics, snapshots, views, and materialized aggregation refresh functions keep dashboards fast as records grow.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            <MetricTile label="Business Metrics" value={String(dashboard.businessMetrics.length)} detail="Recent metric rows available to dashboards" />
            <MetricTile label="Saved Layouts" value={String(dashboard.dashboardConfigs.length)} detail="Role and gym dashboard configurations" />
            <MetricTile label="Forecast Models" value={String(dashboard.forecastModels.length)} detail="Active or paused forecasting definitions" />
          </CardContent>
        </Card>
      </section>

      {/* Custom Report Builder */}
      <section>
        <CustomReportBuilder />
      </section>

      {/* Scheduled Reports */}
      <section>
        <ScheduledReportsManager />
      </section>
    </div>
  );
}

function KpiMetricCard({ kpi }: { kpi: KpiCard }) {
  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{kpi.label}</p>
            <p className="mt-3 text-3xl font-black">{kpi.value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{kpi.detail} · {kpi.comparisonLabel}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <KpiStatusBadge status={kpi.status} />
              <span className="text-xs font-bold text-muted-foreground">{kpi.changePercentage}% change</span>
            </div>
          </div>
          <div className="rounded-md bg-accent/20 p-2 text-foreground">{kpiIcon(kpi.category)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function kpiIcon(category: KpiCard["category"]) {
  if (category === "revenue") {
    return <TrendingUp className="size-5" />;
  }
  if (category === "membership" || category === "retention" || category === "sales") {
    return <UsersRound className="size-5" />;
  }
  if (category === "attendance") {
    return <CalendarCheck className="size-5" />;
  }
  if (category === "trainer") {
    return <Dumbbell className="size-5" />;
  }
  if (category === "class") {
    return <Activity className="size-5" />;
  }
  if (category === "fitness") {
    return <Target className="size-5" />;
  }
  if (category === "operations") {
    return <RefreshCcw className="size-5" />;
  }
  return <LineChart className="size-5" />;
}
