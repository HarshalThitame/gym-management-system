import type { Metadata } from "next";
import { Bell, Megaphone, MessageSquare, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { StatCard } from "@/components/ui/stat-card";
import { ArchiveNotificationForm, DirectNotificationForm, NotificationPreferencesForm, NotificationStateForm } from "@/features/communications/components/communication-forms";
import { CommunicationStatusBadge, PriorityBadge } from "@/features/communications/components/communication-status-badge";
import { formatCommunicationLabel } from "@/features/communications/lib/business-rules";
import { getTrainerNotificationCenter, listNotificationTemplates } from "@/features/communications/services/communication-service";
import { getTrainerAssignedMembers, getTrainerDashboard, getStaffChatMessages, listActiveTrainers } from "@/features/training/services/training-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTrainerPortalAccess } from "@/features/trainer/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { StaffChatSection } from "./client";

export const metadata: Metadata = createMetadata({
  title: "Trainer Communications",
  description: "Trainer notifications, member communication, staff notices, and message history.",
  path: "/trainer/communications"
});

export default async function TrainerCommunicationsPage() {
  const context = await requireTrainerPortalAccess("/trainer/communications");
  const gymId = context.profile?.gym_id ?? null;
  const supabase = await createSupabaseServerClient();
  const { data: trainerRow } = context.userId
    ? await supabase.from("trainers").select("id").eq("user_id", context.userId).maybeSingle()
    : { data: null };
  const trainerId = trainerRow?.id ?? "";
  const [center, assignedMembers, templates, dashboard, activeTrainers, chatMessages] = await Promise.all([
    context.userId ? getTrainerNotificationCenter(context.userId, gymId) : null,
    getTrainerAssignedMembers(context.userId ?? "", gymId),
    listNotificationTemplates(gymId),
    getTrainerDashboard(context.userId ?? "", gymId),
    listActiveTrainers(gymId),
    trainerId ? getStaffChatMessages(trainerId) : [],
  ]);

  if (!center) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Trainer Communications</h2>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No trainer communication record is connected to this login yet.</div>
        </CardContent>
      </Card>
    );
  }

  const unread = center.notifications.filter((notification) => notification.status === "unread");

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainer" }, { label: "Communications" }]} />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Trainer Communications</p>
        <h2 className="mt-2 text-3xl font-black">Member updates, reminders, and staff notices</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Send assigned-member reminders, review staff announcements, and keep an audit trail of coaching communication.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Unread trainer alerts" icon={<Bell className="size-5" />} label="Unread" value={String(center.metrics.unread)} />
        <StatCard detail="Members currently assigned" icon={<UsersRound className="size-5" />} label="Assigned Members" value={String(assignedMembers.length)} />
        <StatCard detail="Pinned or priority notices" icon={<Megaphone className="size-5" />} label="Pinned" value={String(center.metrics.pinned)} />
        <StatCard detail="Communication records visible to you" icon={<MessageSquare className="size-5" />} label="Timeline" value={String(center.metrics.totalHistory)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Notifications</h3>
            <p className="text-sm leading-6 text-muted-foreground">Trainer assignments, schedule changes, session reminders, class notices, and internal updates.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {(unread.length > 0 ? unread : center.notifications.slice(0, 10)).map((notification) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={notification.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black">{notification.title}</h4>
                      <CommunicationStatusBadge status={notification.status} />
                      <PriorityBadge priority={notification.priority} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{notification.body}</p>
                    <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatCommunicationLabel(notification.category)} · {new Date(notification.created_at).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <NotificationStateForm compact notification={notification} />
                    <ArchiveNotificationForm notification={notification} />
                  </div>
                </div>
              </div>
            ))}
            {center.notifications.length === 0 ? <EmptyState text="No trainer notifications yet." /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Message Assigned Members</h3>
            <p className="text-sm leading-6 text-muted-foreground">Trainer access is restricted to actively assigned members. Admins retain gym-wide visibility.</p>
          </CardHeader>
          <CardContent><DirectNotificationForm members={assignedMembers} templates={templates} trainers={[]} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Staff Announcements</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {center.announcements.map((announcement) => (
              <div className="rounded-md border border-border bg-surface-muted p-4" key={announcement.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{announcement.title}</p>
                  <PriorityBadge priority={announcement.priority} />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{announcement.body}</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatCommunicationLabel(announcement.category)}</p>
              </div>
            ))}
            {center.announcements.length === 0 ? <EmptyState text="No staff announcements are active." /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-glow">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black">Staff Chat</h3>
                <p className="text-xs font-semibold text-muted-foreground">Message other trainers</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <StaffChatSection
              trainers={activeTrainers}
              currentTrainerId={trainerId}
              messages={chatMessages}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Preferences and Timeline</h3>
            <p className="text-sm leading-6 text-muted-foreground">Update delivery preferences and review outbound/inbound communication history.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <NotificationPreferencesForm preferences={center.preferences} />
            <div className="space-y-3">
              {center.history.slice(0, 10).map((history) => (
                <div className="grid gap-2 rounded-md border border-border bg-surface-muted p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center" key={history.id}>
                  <div>
                    <p className="font-bold">{history.subject ?? formatCommunicationLabel(history.category)}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-muted-foreground">{history.body}</p>
                  </div>
                  <CommunicationStatusBadge status={history.status} />
                  <p className="text-xs font-bold text-muted-foreground">{formatCommunicationLabel(history.channel)}</p>
                </div>
              ))}
              {center.history.length === 0 ? <EmptyState text="No communication history yet." /> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
