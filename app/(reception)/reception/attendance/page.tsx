import type { Metadata } from "next";
import { Activity, CalendarCheck, QrCode, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { CheckOutForm, ManualCheckInForm, QrScanForm } from "@/features/attendance/components/attendance-forms";
import { getAttendanceDashboard, listAccessDevices } from "@/features/attendance/services/attendance-service";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Reception Attendance",
  description: "Reception attendance and check-in workspace for assigned branch front desk operations.",
  path: "/reception/attendance"
});

type ReceptionAttendancePageProps = {
  searchParams: Promise<{ memberQuery?: string; token?: string }>;
};

export default async function ReceptionAttendancePage({ searchParams }: ReceptionAttendancePageProps) {
  const scope = await requireReceptionScope("/reception/attendance");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "manual_attendance", actionName: "reception.attendance.read" });
  const params = await searchParams;
  const memberQuery = params.memberQuery?.trim() ?? "";
  const [dashboard, membersResult, devices] = await Promise.all([
    getAttendanceDashboard(scope.gymId),
    listMembers({ gymId: scope.gymId, pageSize: 80, query: memberQuery || undefined }),
    listAccessDevices(scope.gymId)
  ]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Attendance</p>
        <h2 className="mt-2 text-3xl font-black">Attendance desk</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Run assigned branch QR check-ins, manual check-ins, checkout, duplicate prevention, and visit tracking from the front desk.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Validated member entries today" icon={<CalendarCheck className="size-5" />} label="Today's Check-Ins" value={String(dashboard.metrics.todayCheckIns)} />
        <StatCard detail={`${dashboard.metrics.capacityPercentage}% of capacity`} icon={<UsersRound className="size-5" />} label="Currently Inside" value={String(dashboard.metrics.currentInside)} />
        <StatCard detail={`${dashboard.metrics.weeklyAttendance} visits this week`} icon={<Activity className="size-5" />} label="Monthly Visits" value={String(dashboard.metrics.monthlyAttendance)} />
        <StatCard detail="Average completed visit duration" icon={<Activity className="size-5" />} label="Avg Duration" value={`${dashboard.metrics.averageDuration}m`} />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Manual Check-In</h3>
            <p className="text-sm leading-6 text-muted-foreground">Search by name, phone, email, or member ID, then validate membership before entry.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action="/reception/attendance" className="grid gap-3 md:grid-cols-[1fr_auto]">
              {params.token ? <input name="token" type="hidden" value={params.token} /> : null}
              <Input aria-label="Search members" defaultValue={memberQuery} name="memberQuery" placeholder="Search all members" />
              <button className="h-11 rounded-md border border-border bg-surface px-4 text-sm font-bold hover:bg-surface-muted" type="submit">Search Members</button>
            </form>
            <ManualCheckInForm devices={devices} members={membersResult.members} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><QrCode className="size-5" /><h3 className="text-2xl font-black">QR Check-In</h3></div>
            <p className="text-sm leading-6 text-muted-foreground">Paste a scanned QR payload or use the device camera where supported.</p>
          </CardHeader>
          <CardContent><QrScanForm defaultToken={params.token ?? ""} devices={devices} /></CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Live Checkout</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.currentSessions.map((session) => (
            <div className="grid gap-3 rounded-md border border-border bg-surface-muted p-4 md:grid-cols-[1fr_280px] md:items-center" key={session.id}>
              <div>
                <p className="font-black">{session.member?.full_name ?? "Member"}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Checked in {new Date(session.check_in_at).toLocaleString("en-IN")}</p>
              </div>
              <CheckOutForm devices={devices} session={session} />
            </div>
          ))}
          {dashboard.currentSessions.length === 0 ? <EmptyState text="No members are currently checked in." /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
