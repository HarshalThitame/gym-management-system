import type { Metadata } from "next";
import { Bell, CheckCircle2, Megaphone, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ArchiveNotificationForm, NotificationPreferencesForm, NotificationStateForm } from "@/features/communications/components/communication-forms";
import { CommunicationStatusBadge, PriorityBadge } from "@/features/communications/components/communication-status-badge";
import { formatCommunicationLabel } from "@/features/communications/lib/business-rules";
import { getMemberNotificationCenter } from "@/features/communications/services/communication-service";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection, AnimatedListSection, AnimatedListItem } from "@/features/member/components/page-wrappers";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Notifications",
  description: "Protected member notification center, preferences, announcements, and communication history.",
  path: "/member/notifications"
});

export default async function MemberNotificationsPage() {
  const context = await requireMemberPortalAccess("/member/notifications");
  const center = context.userId ? await getMemberNotificationCenter(context.userId) : null;

  if (!center) {
    return (
      <Card>
        <CardHeader><h2 className="text-2xl font-black">Notifications</h2></CardHeader>
        <CardContent><div className="rounded-md border border-warning/25 bg-warning/10 p-5 text-sm font-semibold text-warning">No member communication record is connected to this login yet.</div></CardContent>
      </Card>
    );
  }

  const unread = center.notifications.filter((notification) => notification.status === "unread");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Notification Center" title="Messages, reminders, and preferences" description="Control how Apex Performance Club reaches you for membership, classes, payments, attendance, workouts, nutrition, promotions, and system alerts." />

      <AnimatedCardSection>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard detail="Messages waiting for review" icon={<Bell className="size-5" />} label="Unread" value={String(center.metrics.unread)} />
          <StatCard detail="Pinned messages stay visible first" icon={<Megaphone className="size-5" />} label="Pinned" value={String(center.metrics.pinned)} />
          <StatCard detail="High or urgent unread alerts" icon={<ShieldCheck className="size-5" />} label="Priority" value={String(center.metrics.priority)} />
          <StatCard detail="Emails, WhatsApp, SMS, push, and in-app records" icon={<CheckCircle2 className="size-5" />} label="Timeline" value={String(center.metrics.totalHistory)} />
        </div>
      </AnimatedCardSection>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <AnimatedCardSection delay={0.1}>
          <Card variant="glass">
            <CardHeader>
              <h3 className="text-2xl font-black">Unread Notifications</h3>
              <p className="text-sm leading-6 text-muted-foreground">Membership renewals, payments, class reminders, trainer updates, workout nudges, achievements, and system notices appear here first.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <AnimatedListSection>
                {(unread.length > 0 ? unread : center.notifications.slice(0, 10)).map((notification) => (
                  <AnimatedListItem key={notification.id}>
                    <div className="rounded-xl border border-border bg-surface-muted p-4 card-hover">
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
                  </AnimatedListItem>
                ))}
              </AnimatedListSection>
              {center.notifications.length === 0 ? <EmptyState text="No notifications yet." /> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <AnimatedCardSection delay={0.15}>
          <Card variant="glow">
            <CardHeader>
              <h3 className="text-2xl font-black">Preferences</h3>
              <p className="text-sm leading-6 text-muted-foreground">Granular opt-in controls are respected before campaigns and automations are queued.</p>
            </CardHeader>
            <CardContent><NotificationPreferencesForm preferences={center.preferences} /></CardContent>
          </Card>
        </AnimatedCardSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1fr]">
        <AnimatedCardSection delay={0.2}>
          <Card variant="glass">
            <CardHeader>
              <h3 className="text-2xl font-black">Announcements</h3>
              <p className="text-sm leading-6 text-muted-foreground">Gym notices, holiday schedules, maintenance updates, events, and promotions.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {center.announcements.map((announcement) => (
                <div className="rounded-lg border border-border bg-surface-muted p-4 card-hover" key={announcement.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{announcement.title}</p>
                    <PriorityBadge priority={announcement.priority} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{announcement.body}</p>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatCommunicationLabel(announcement.category)}</p>
                </div>
              ))}
              {center.announcements.length === 0 ? <EmptyState text="No active announcements." /> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>

        <AnimatedCardSection delay={0.25}>
          <Card variant="glass">
            <CardHeader>
              <h3 className="text-2xl font-black">Communication Timeline</h3>
              <p className="text-sm leading-6 text-muted-foreground">A complete audit-friendly view of messages sent to your account across all supported channels.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {center.history.map((history) => (
                <div className="grid gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center card-hover" key={history.id}>
                  <div>
                    <p className="font-bold">{history.subject ?? formatCommunicationLabel(history.category)}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-muted-foreground">{history.body}</p>
                  </div>
                  <CommunicationStatusBadge status={history.status} />
                  <p className="text-xs font-bold text-muted-foreground">{formatCommunicationLabel(history.channel)}</p>
                </div>
              ))}
              {center.history.length === 0 ? <EmptyState text="No communication history yet." /> : null}
            </CardContent>
          </Card>
        </AnimatedCardSection>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
