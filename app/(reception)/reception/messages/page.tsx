import type { Metadata } from "next";
import { Mail, MessageSquare, Send } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DirectNotificationForm } from "@/features/communications/components/communication-forms";
import { getCommunicationDashboard, listNotificationTemplates } from "@/features/communications/services/communication-service";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { listActiveTrainers } from "@/features/training/services/training-service";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Messages",
  description: "Reception reminder and front desk communication workspace for assigned branch operations.",
  path: "/reception/messages"
});

export default async function ReceptionMessagesPage() {
  const scope = await requireReceptionScope("/reception/messages");
  const [dashboard, membersResult, trainers, templates] = await Promise.all([
    getCommunicationDashboard(scope.gymId),
    listMembers({ gymId: scope.gymId, pageSize: 100 }),
    listActiveTrainers(scope.gymId),
    listNotificationTemplates(scope.gymId)
  ]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Messages</p>
        <h2 className="mt-2 text-3xl font-black">Front desk messages</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Send assigned branch renewal, payment, appointment, and support reminders through permitted communication channels.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Email logs recorded today" icon={<Mail className="size-5" />} label="Email" value={String(dashboard.metrics.emailsToday)} />
        <StatCard detail="WhatsApp logs recorded today" icon={<MessageSquare className="size-5" />} label="WhatsApp" value={String(dashboard.metrics.whatsappToday)} />
        <StatCard detail="SMS logs recorded today" icon={<Send className="size-5" />} label="SMS" value={String(dashboard.metrics.smsToday)} />
      </section>
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Send Member Reminder</h3>
        </CardHeader>
        <CardContent>
          <DirectNotificationForm members={membersResult.members} templates={templates} trainers={trainers} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Recent Communication History</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.recentHistory.slice(0, 10).map((item) => (
            <div className="rounded-md border border-border bg-surface-muted p-4" key={item.id}>
              <p className="font-black">{item.subject}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.channel} · {item.status} · {new Date(item.created_at).toLocaleString("en-IN")}</p>
            </div>
          ))}
          {dashboard.recentHistory.length === 0 ? <EmptyState text="No communication history has been recorded yet." /> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
