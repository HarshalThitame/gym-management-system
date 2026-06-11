import type { Metadata } from "next";
import { Activity, AlertTriangle, Clock, DoorOpen, QrCode, UsersRound } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { listMembers } from "@/features/memberships/services/membership-service";
import { AccessDeviceForm, CheckOutForm, ManualCheckInForm, QrScanForm, SyncInactivityAlertsForm } from "@/features/attendance/components/attendance-forms";
import { AttendanceStatusBadge } from "@/features/attendance/components/attendance-status-badge";
import { DailyAttendanceChart, HourlyTrafficChart } from "@/features/attendance/components/lazy-attendance-charts";
import { getAttendanceDashboard, listAccessDevices } from "@/features/attendance/services/attendance-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

type AdminAttendancePageProps = {
  searchParams: Promise<{ memberQuery?: string; token?: string }>;
};

export const metadata: Metadata = createMetadata({
  title: "Attendance and Access Control",
  description: "Reception check-in, QR validation, live occupancy, access alerts, and attendance analytics.",
  path: "/admin/attendance"
});

export default async function AdminAttendancePage({ searchParams }: AdminAttendancePageProps) {
  const scope = await requireGymAdminScope("/admin/attendance");
  const params = await searchParams;
  const gymId = scope.gymId;
  const memberQuery = params.memberQuery?.trim() ?? "";
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  const [dashboard, membersResult, devices, planContext] = await Promise.all([
    getAttendanceDashboard(gymId),
    listMembers({ gymId, pageSize: 100, query: memberQuery || undefined }),
    listAccessDevices(gymId),
    organizationId ? getOrgPlanContext(organizationId) : null
  ]);
  const biometricEnabled = planContext?.features.biometricAttendanceEnabled === true;
  const rfidEnabled = planContext?.features.rfidAttendanceEnabled === true;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Access Control</p>
          <h2 className="mt-2 text-3xl font-black">Attendance, QR check-in, and live occupancy</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Validate memberships before entry, track visits from check-in to checkout, monitor incidents, and prepare for hardware integrations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/api/attendance/reports?type=daily" variant="secondary">Daily CSV</ButtonLink>
          <ButtonLink href="/api/attendance/reports?type=weekly&format=excel" variant="secondary">Weekly Excel</ButtonLink>
          <ButtonLink href="/api/attendance/reports?type=monthly&format=pdf" variant="secondary">Monthly PDF</ButtonLink>
          <ButtonLink href="/api/attendance/reports?type=exceptions&format=pdf" variant="secondary">Exceptions PDF</ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Validated member entries today" icon={<DoorOpen className="size-5" />} label="Today's Check-ins" value={String(dashboard.metrics.todayCheckIns)} />
        <StatCard detail={`${dashboard.metrics.capacityPercentage}% of configured capacity`} icon={<UsersRound className="size-5" />} label="Currently Inside" value={String(dashboard.metrics.currentInside)} />
        <StatCard detail={`${dashboard.metrics.weeklyAttendance} visits this week`} icon={<Activity className="size-5" />} label="Monthly Visits" value={String(dashboard.metrics.monthlyAttendance)} />
        <StatCard detail={dashboard.metrics.peakHour === null ? "No peak data yet" : `${String(dashboard.metrics.peakHour).padStart(2, "0")}:00 peak`} icon={<Clock className="size-5" />} label="Avg Duration" value={`${dashboard.metrics.averageDuration}m`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Reception Check-In</h3>
            <p className="text-sm leading-6 text-muted-foreground">Search-driven manual entry with membership validation, duplicate protection, and audit logging.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action="/admin/attendance" className="grid gap-3 md:grid-cols-[1fr_auto]">
              {params.token ? <input name="token" type="hidden" value={params.token} /> : null}
              <Input
                aria-label="Search the full member directory"
                defaultValue={memberQuery}
                name="memberQuery"
                placeholder="Search all members by name, phone, email, or member ID"
              />
              <button className="h-11 rounded-md border border-border bg-surface px-4 text-sm font-bold hover:bg-surface-muted" type="submit">
                Search Members
              </button>
            </form>
            <p className="text-xs font-semibold text-muted-foreground">
              Showing {membersResult.members.length} of {membersResult.total} matching members for front-desk entry.
            </p>
            <ManualCheckInForm devices={devices} members={membersResult.members} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <QrCode className="size-5" />
              <h3 className="text-2xl font-black">QR Scan</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Paste the scanned QR payload or open this page with a token query parameter from a scanner workflow.</p>
          </CardHeader>
          <CardContent>
            <QrScanForm defaultToken={params.token ?? ""} devices={devices} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Live Occupancy</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.currentSessions.map((session) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={session.id}>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{session.member?.full_name ?? "Member"}</p>
                      <AttendanceStatusBadge status={session.status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{session.member?.member_code ?? ""} · checked in {new Date(session.check_in_at).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="w-full max-w-xs">
                    <CheckOutForm devices={devices} session={session} />
                  </div>
                </div>
              </div>
            ))}
            {dashboard.currentSessions.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No members are currently checked in.</div> : null}
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

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Peak Hour Traffic</h3>
          </CardHeader>
          <CardContent>
            <HourlyTrafficChart data={dashboard.hourlyTraffic} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Attendance Trend</h3>
          </CardHeader>
          <CardContent>
            <DailyAttendanceChart data={dashboard.dailyTrend} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Recent Visits</h3>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Hardware Access Preparation</h3>
            <p className="text-sm leading-6 text-muted-foreground">Register future scanners, turnstiles, biometric readers, RFID readers, kiosks, or API devices.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessDeviceForm />
            <div className="grid gap-3 md:grid-cols-2">
              {biometricEnabled ? null : (
                <FeatureLocked
                  compact
                  featureName="Biometric Attendance"
                  requiredPlan="Standard"
                />
              )}
              {rfidEnabled ? null : (
                <FeatureLocked
                  compact
                  featureName="RFID Attendance"
                  requiredPlan="Premium"
                />
              )}
            </div>
            <div className="space-y-2">
              {devices.map((device) => (
                <div className="rounded-md border border-border bg-surface-muted p-3" key={device.id}>
                  <p className="font-bold">{device.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{device.device_code} · {device.device_type.replaceAll("_", " ")} · {device.status}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
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
