import type { Metadata } from "next";
import { Bell, Mail, Megaphone, MessageSquare, Send, UsersRound, Workflow } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { listMembers } from "@/features/memberships/services/membership-service";
import { listActiveTrainers } from "@/features/training/services/training-service";
import { CampaignPerformanceChart, ChannelVolumeChart } from "@/features/communications/components/lazy-communication-charts";
import {
  AnnouncementForm,
  AutomationRuleForm,
  AutomationRunForm,
  CampaignDispatchForm,
  CampaignForm,
  CommunicationSegmentForm,
  DirectNotificationForm,
  NotificationTemplateForm
} from "@/features/communications/components/communication-forms";
import { CommunicationStatusBadge } from "@/features/communications/components/communication-status-badge";
import { formatCommunicationLabel } from "@/features/communications/lib/business-rules";
import { getCommunicationDashboard } from "@/features/communications/services/communication-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { hasRequiredRole } from "@/lib/rbac";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

export const metadata: Metadata = createMetadata({
  title: "Communication Hub",
  description: "In-app notifications, email, WhatsApp architecture, SMS, announcements, campaigns, and engagement automation.",
  path: "/admin/communications"
});

export default async function AdminCommunicationsPage() {
  const scope = await requireGymAdminScope("/admin/communications");
  const gymId = scope.gymId;
  const canManageCommunications = hasRequiredRole(scope.roles, ["super_admin", "gym_admin"]);
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  const [dashboard, membersResult, trainers, planContext] = await Promise.all([
    getCommunicationDashboard(gymId),
    listMembers({ gymId, pageSize: 120 }),
    listActiveTrainers(gymId),
    organizationId ? getOrgPlanContext(organizationId) : null
  ]);
  const communicationsEnabled = planContext?.features.communicationsEnabled === true;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Communication Hub</p>
        <h2 className="mt-2 text-3xl font-black">Notifications, campaigns, and retention automation</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Manage in-app notifications, Resend email workflows, provider-ready WhatsApp/SMS queues, targeted announcements, member segments, and engagement automations from one audit-friendly system.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Email history rows created today" icon={<Mail className="size-5" />} label="Emails Today" value={String(dashboard.metrics.emailsToday)} />
        <StatCard detail="Provider-ready WhatsApp queue volume" icon={<MessageSquare className="size-5" />} label="WhatsApp Today" value={String(dashboard.metrics.whatsappToday)} />
        <StatCard detail="Unread in-app notifications" icon={<Bell className="size-5" />} label="Unread" value={String(dashboard.metrics.unreadNotifications)} />
        <StatCard detail={`${dashboard.metrics.activeAutomations} active workflows`} icon={<Workflow className="size-5" />} label="Campaigns" value={String(dashboard.metrics.activeCampaigns)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Channel Volume</h3>
            <p className="text-sm leading-6 text-muted-foreground">Daily communication history by channel. WhatsApp and SMS are queued through provider-agnostic logs for future Meta, Twilio, MSG91, Gupshup, or Interakt integration.</p>
          </CardHeader>
          <CardContent><ChannelVolumeChart data={dashboard.channelSummary} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Campaign Performance</h3>
            <p className="text-sm leading-6 text-muted-foreground">Delivery, open, and click rates calculated from campaign recipient state transitions.</p>
          </CardHeader>
          <CardContent><CampaignPerformanceChart data={dashboard.campaignPerformance} /></CardContent>
        </Card>
      </div>

      {canManageCommunications && communicationsEnabled ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Campaign Management</h3>
              <p className="text-sm leading-6 text-muted-foreground">Create email, WhatsApp, SMS, or multi-channel campaigns against dynamic member segments.</p>
            </CardHeader>
            <CardContent><CampaignForm campaigns={dashboard.campaigns} segments={dashboard.segments} templates={dashboard.templates} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Send className="size-5" />
                <h3 className="text-2xl font-black">Dispatch Queue</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.campaigns.slice(0, 8).map((campaign) => (
                <div className="rounded-lg border border-border bg-surface-muted p-4" key={campaign.id}>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{campaign.name}</p>
                        <CommunicationStatusBadge status={campaign.status} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatCommunicationLabel(campaign.campaign_type)} · {formatCommunicationLabel(campaign.category)} · {campaign.segment_key}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <CampaignDispatchForm campaign={campaign} />
                  </div>
                </div>
              ))}
              {dashboard.campaigns.length === 0 ? <EmptyState text="No campaigns created yet." /> : null}
            </CardContent>
          </Card>
        </div>
      ) : canManageCommunications ? (
        <FeatureLocked
          description="Campaign creation and dispatch queues are available on Standard and higher plans."
          featureName="Campaign Management"
          requiredPlan="Standard"
        />
      ) : null}

      {canManageCommunications && communicationsEnabled ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Template Engine</h3>
              <p className="text-sm leading-6 text-muted-foreground">Templates support variable placeholders, channel-specific content, and active/draft/archive lifecycle states.</p>
            </CardHeader>
            <CardContent><NotificationTemplateForm templates={dashboard.templates} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Announcement System</h3>
              <p className="text-sm leading-6 text-muted-foreground">Publish gym notices, holiday hours, maintenance updates, events, and promotions with segment targeting.</p>
            </CardHeader>
            <CardContent><AnnouncementForm announcements={dashboard.announcements} segments={dashboard.segments} /></CardContent>
          </Card>
        </div>
      ) : canManageCommunications ? (
        <FeatureLocked
          description="Templates and segmented announcements are available on Standard and higher plans."
          featureName="Bulk Announcements"
          requiredPlan="Standard"
        />
      ) : null}

      {canManageCommunications && communicationsEnabled ? (
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UsersRound className="size-5" />
                <h3 className="text-2xl font-black">Member Segments</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CommunicationSegmentForm segments={dashboard.segments} />
              <div className="grid gap-2 sm:grid-cols-2">
                {dashboard.segments.slice(0, 8).map((segment) => (
                  <div className="rounded-md border border-border bg-surface-muted p-3" key={segment.id}>
                    <p className="font-bold">{segment.name}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{segment.segment_key}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Workflow className="size-5" />
                <h3 className="text-2xl font-black">Retention Automation</h3>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">Queue renewal reminders, attendance nudges, class reminders, PT session reminders, workout streak recovery, and achievement messages.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <AutomationRuleForm rules={dashboard.automationRules} segments={dashboard.segments} templates={dashboard.templates} />
              <div className="space-y-3">
                {dashboard.automationRules.slice(0, 6).map((rule) => (
                  <div className="rounded-md border border-border bg-surface-muted p-3" key={rule.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{rule.name}</p>
                      <CommunicationStatusBadge status={rule.status} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatCommunicationLabel(rule.trigger_key)} · {formatCommunicationLabel(rule.channel)} · {rule.segment_key}</p>
                    <div className="mt-3">
                      <AutomationRunForm rule={rule} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : canManageCommunications ? (
        <FeatureLocked
          description="Member segmentation and retention automation are available on Standard and higher plans."
          featureName="Communication Automation"
          requiredPlan="Standard"
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Megaphone className="size-5" />
              <h3 className="text-2xl font-black">Direct Communication</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Queue targeted in-app, email, WhatsApp, SMS, or push notifications to members and staff.</p>
          </CardHeader>
          <CardContent><DirectNotificationForm members={membersResult.members} templates={dashboard.templates} trainers={trainers} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Communication History</h3>
            <p className="text-sm leading-6 text-muted-foreground">Audit trail across channels, campaigns, automations, and direct staff communication.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentHistory.map((history) => (
              <div className="grid gap-2 rounded-md border border-border bg-surface-muted p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center" key={history.id}>
                <div>
                  <p className="font-bold">{history.subject ?? formatCommunicationLabel(history.category)}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-muted-foreground">{history.body}</p>
                </div>
                <CommunicationStatusBadge status={history.status} />
                <p className="text-xs font-bold text-muted-foreground">{formatCommunicationLabel(history.channel)}</p>
              </div>
            ))}
            {dashboard.recentHistory.length === 0 ? <EmptyState text="No communication history has been recorded yet." /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
