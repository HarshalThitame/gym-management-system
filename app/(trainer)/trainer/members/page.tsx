import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrainerNoteForm } from "@/features/training/components/training-forms";
import { getTrainerDashboard } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Assigned Members",
  description: "Protected trainer assigned member list.",
  path: "/trainer/members"
});

export default async function TrainerMembersPage() {
  const context = await requireRole(["trainer"], "/trainer/members");
  const dashboard = await getTrainerDashboard(context.userId ?? "", context.profile?.gym_id ?? null);
  const trainerList = dashboard.trainer ? [dashboard.trainer] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Assigned Members</h2>
          <p className="text-sm leading-6 text-muted-foreground">View active coaching assignments and capture secure progress notes for each member.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {dashboard.assignedMembers.map((member) => (
            <div className="rounded-md border border-border bg-surface-muted p-4" key={member.id}>
              <p className="font-bold">{member.full_name}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{member.member_code} · {member.phone} · {member.email ?? "No email"}</p>
            </div>
          ))}
          {dashboard.assignedMembers.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No assigned members yet.</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Trainer Notes</h2>
        </CardHeader>
        <CardContent>
          <TrainerNoteForm members={dashboard.assignedMembers} trainers={trainerList} />
        </CardContent>
      </Card>
    </div>
  );
}
