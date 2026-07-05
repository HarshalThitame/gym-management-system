import { Suspense } from "react";
import type { Metadata } from "next";
import { Activity, AlertTriangle, Clock, DoorOpen, UsersRound } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { AttendanceDesk } from "@/features/attendance/components/attendance-desk";
import { ErrorBoundary } from "@/features/attendance/components/error-boundary";
import { Phase2AttendanceHub } from "@/features/attendance/components/phase2-attendance-hub";
import { OccupancyDashboard } from "@/features/attendance/components/occupancy-dashboard";
import { SyncInactivityAlertsForm } from "@/features/attendance/components/attendance-forms";
import { listAccessDevices, getAttendanceDashboard } from "@/features/attendance/services/attendance-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Attendance and Access Control",
  description: "Reception check-in, QR validation, live occupancy, access alerts, and attendance analytics.",
  path: "/admin/attendance"
});

export default async function AdminAttendancePage() {
  const scope = await requireGymAdminScope("/admin/attendance");
  const gymId = scope.gymId;
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "attendance_reports", actionName: "admin.attendance.read" });

  const [dashboard, devices, planContext] = await Promise.all([
    getAttendanceDashboard(gymId),
    listAccessDevices(gymId),
    organizationId ? getOrgPlanContext(organizationId) : null
  ]);

  const biometricEnabled = planContext?.features.biometricAttendanceEnabled === true;
  const rfidEnabled = planContext?.features.rfidAttendanceEnabled === true;

  return (
    <div className="space-y-10">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Access Control</p>
          <h2 className="mt-2 text-3xl font-black">Attendance, QR check-in, and live occupancy</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Validate memberships before entry, track visits from check-in to checkout, monitor incidents, and review analytics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/api/attendance/reports?type=daily" variant="secondary">Daily CSV</ButtonLink>
          <ButtonLink href="/api/attendance/reports?type=weekly&format=excel" variant="secondary">Weekly Excel</ButtonLink>
          <ButtonLink href="/api/attendance/reports?type=monthly&format=pdf" variant="secondary">Monthly PDF</ButtonLink>
          <ButtonLink href="/api/attendance/reports?type=exceptions&format=pdf" variant="secondary">Exceptions PDF</ButtonLink>
          <ButtonLink href="/reception/attendance/kiosk" variant="secondary">Kiosk mode</ButtonLink>
        </div>
      </div>

      {/* ═══ KPI Grid ═══ */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Validated member entries today" icon={<DoorOpen className="size-5" />} label="Today's Check-ins" value={String(dashboard.metrics.todayCheckIns)} />
        <StatCard detail={`${dashboard.metrics.capacityPercentage}% of configured capacity`} icon={<UsersRound className="size-5" />} label="Currently Inside" value={String(dashboard.metrics.currentInside)} />
        <StatCard detail={`${dashboard.metrics.weeklyAttendance} visits this week`} icon={<Activity className="size-5" />} label="Monthly Visits" value={String(dashboard.metrics.monthlyAttendance)} />
        <StatCard detail={dashboard.metrics.peakHour === null ? "No peak data yet" : `${String(dashboard.metrics.peakHour).padStart(2, "0")}:00 peak`} icon={<Clock className="size-5" />} label="Avg Duration" value={`${dashboard.metrics.averageDuration}m`} />
      </div>

      {/* ═══ Unified Attendance Desk ═══ */}
      <ErrorBoundary>
        <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-muted p-20" />}>
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Front Desk</h3>
              <p className="text-sm leading-6 text-muted-foreground">Search members, check in, scan QR, and manage active sessions.</p>
            </CardHeader>
            <CardContent>
              <AttendanceDesk
                currentSessions={dashboard.currentSessions}
                devices={devices}
                gymId={gymId}
                metrics={{
                  currentInside: dashboard.metrics.currentInside,
                  todayCheckIns: dashboard.metrics.todayCheckIns,
                  capacityPercentage: dashboard.metrics.capacityPercentage,
                }}
              />
            </CardContent>
          </Card>
        </Suspense>
      </ErrorBoundary>

      {/* ═══ Occupancy Dashboard ═══ */}
      <ErrorBoundary>
        <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-muted p-20" />}>
          <OccupancyDashboard
            currentSessions={dashboard.currentSessions}
            dailyTrend={dashboard.dailyTrend}
            hourlyTraffic={dashboard.hourlyTraffic}
            metrics={{
              currentInside: dashboard.metrics.currentInside,
              todayCheckIns: dashboard.metrics.todayCheckIns,
              capacityPercentage: dashboard.metrics.capacityPercentage,
              averageDuration: dashboard.metrics.averageDuration,
              peakHour: dashboard.metrics.peakHour,
            }}
          />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary>
        <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-muted p-20" />}>
          <Phase2AttendanceHub gymId={gymId} branchId={scope.branchId} />
        </Suspense>
      </ErrorBoundary>

      {/* ═══ Access Alerts ═══ */}
      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Recent Visits</h3>
            <p className="text-sm leading-6 text-muted-foreground">Latest attendance sessions. Use the Organization Owner panel for full history with filtering and reversal.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentSessions.map((session) => (
              <div className="grid gap-2 rounded-md border border-border bg-surface-muted p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center" key={session.id}>
                <div>
                  <p className="font-bold">{session.member?.full_name ?? "Member"}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{session.member?.member_code ?? ""}</p>
                </div>
                <p className="font-semibold">{new Date(session.check_in_at).toLocaleString("en-IN")}</p>
                <p className="font-black">{session.duration_minutes ?? 0}m</p>
              </div>
            ))}
            {dashboard.recentSessions.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No recent visits.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Access Alerts</h3>
            <p className="text-sm leading-6 text-muted-foreground">Track entry incidents and generate absence alerts for retention follow-up.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMetric label="7 days" value={String(dashboard.metrics.inactive7Days)} />
              <MiniMetric label="15 days" value={String(dashboard.metrics.inactive15Days)} />
              <MiniMetric label="30 days" value={String(dashboard.metrics.inactive30Days)} />
            </div>
            <SyncInactivityAlertsForm />
            {dashboard.alerts.map((alert) => (
              <div className="rounded-md border border-warning/25 bg-warning/10 p-3" key={alert.id}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  <p className="font-bold">{alert.alert_type.replaceAll("_", " ")}</p>
                </div>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{alert.severity} · {alert.message}</p>
              </div>
            ))}
            {dashboard.alerts.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No open access alerts.</p> : null}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Hardware ═══ */}
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Devices & Hardware</h3>
          <p className="text-sm leading-6 text-muted-foreground">Registered access devices and available hardware integrations.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <div className="rounded-md border border-border bg-surface-muted p-3" key={device.id}>
                <p className="font-bold">{device.name}</p>
                <p className="text-xs font-semibold text-muted-foreground">{device.device_code} · {device.device_type.replaceAll("_", " ")} · {device.status}</p>
              </div>
            ))}
            {devices.length === 0 && <p className="text-sm font-semibold text-muted-foreground">No devices registered yet.</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {biometricEnabled ? null : <FeatureLocked compact featureName="Biometric Attendance" requiredPlan="Standard" />}
            {rfidEnabled ? null : <FeatureLocked compact featureName="RFID Attendance" requiredPlan="Premium" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
