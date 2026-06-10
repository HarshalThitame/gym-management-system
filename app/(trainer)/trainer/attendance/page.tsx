import type { Metadata } from "next";
import { Activity, Clock, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { HourlyTrafficChart } from "@/features/attendance/components/attendance-charts";
import { getTrainerAttendanceView } from "@/features/attendance/services/attendance-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Trainer Attendance",
  description: "Assigned member attendance trends, visit frequency, and inactivity coaching signals.",
  path: "/trainer/attendance"
});

export default async function TrainerAttendancePage() {
  const context = await requireRole(["trainer", "gym_admin", "super_admin"], "/trainer/attendance");
  const view = await getTrainerAttendanceView(context.userId ?? "", context.profile?.gym_id ?? null);
  const inactiveMembers = view.assignedMembers.filter((member) => member.inactiveDays >= 7);
  const averageDuration = view.assignedMembers.length > 0
    ? Math.round(view.assignedMembers.reduce((total, member) => total + member.averageDuration, 0) / view.assignedMembers.length)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Trainer Attendance</p>
        <h2 className="mt-2 text-3xl font-black">Assigned member visit trends</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Use attendance frequency, last visit, and workout duration to guide coaching follow-ups.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Members currently assigned to you" icon={<UsersRound className="size-5" />} label="Assigned Members" value={String(view.assignedMembers.length)} />
        <StatCard detail="No visit for 7 or more days" icon={<Activity className="size-5" />} label="Inactive" value={String(inactiveMembers.length)} />
        <StatCard detail="Across assigned member visits" icon={<Clock className="size-5" />} label="Avg Duration" value={`${averageDuration}m`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Assigned Member Attendance</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {view.assignedMembers.map((member) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={member.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-bold">{member.full_name}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{member.member_code} · {member.phone}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <Metric label="Visits" value={String(member.visitCount)} />
                    <Metric label="Avg" value={`${member.averageDuration}m`} />
                    <Metric label="Inactive" value={`${member.inactiveDays >= 999 ? "-" : member.inactiveDays}d`} />
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">Last visit: {member.lastVisitAt ? new Date(member.lastVisitAt).toLocaleString("en-IN") : "No visits recorded"}</p>
              </div>
            ))}
            {view.assignedMembers.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No assigned member attendance records yet.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Assigned Member Peak Hours</h3>
          </CardHeader>
          <CardContent>
            <HourlyTrafficChart data={view.hourlyTraffic} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
