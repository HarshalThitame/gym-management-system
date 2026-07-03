"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useMemo, useState, useActionState } from "react";
import { CalendarDays, Download, Edit3, Eye, Globe, Mail, MessageSquare, Plus, Send } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveCampaignAction, sendCampaignAction } from "@/features/organization-owner/actions/communication-actions";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { useHasFeature } from "@/features/organization-owner/entitlements";
import { NetworkCampaignPanel } from "@/features/organization-owner/components/modules/NetworkCampaignPanel";
import { NPSSurveyPanel } from "@/features/organization-owner/components/modules/NPSSurveyPanel";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import { EmailSettingsPanel } from "@/features/organization-owner/components/modules/EmailSettingsPanel";

type CommunicationsEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type CommsTab = "campaigns" | "network" | "nps" | "email-settings";

const CHART_COLORS = ["#0891b2", "#16a34a", "#f59e0b", "#8b5cf6"];
const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function CommunicationsEnterpriseModule({ dashboard, moduleData }: CommunicationsEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<CampaignRow | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<CampaignRow | null>(null);
  const [state, formAction] = useActionState(saveCampaignAction, initialAuthActionState);
  const [activeTab, setActiveTab] = useState<CommsTab>("campaigns");
  const hasNetworkCampaigns = useHasFeature("network_wide_campaign_manager");
  const hasNpsSurveys = useHasFeature("member_nps_surveys");
  const hasCustomEmailDomain = useHasFeature("custom_email_domain");

  const campaigns = (moduleData?.items ?? dashboard.campaigns) as CampaignRow[];
  const notifications = dashboard.notifications;

  const openCreate = useCallback(() => { setEditingCampaign(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((c: CampaignRow) => { setEditingCampaign(c); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingCampaign(null); }, []);
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status, campaignType: f.campaignType }); }, [navigate]);

  const handleSend = useCallback(async (campaignId: string) => {
    const fd = new FormData(); fd.set("campaignId", campaignId);
    const r = await sendCampaignAction({ status: "idle", message: null } as never, fd);
    showToast(r.message || (r.status === "success" ? "Campaign sent" : "Failed"), r.status === "success" ? "success" : "error");
  }, []);

  // ── KPIs ──
  const draftCount = campaigns.filter((c) => c.status === "draft").length;
  const runningCount = campaigns.filter((c) => c.status === "running" || c.status === "scheduled").length;
  const completedCount = campaigns.filter((c) => c.status === "completed").length;
  const unreadNotif = notifications.filter((n) => n.status === "unread").length;

  // ── Channel distribution ──
  const channelDist = useMemo(() => {
    const types = ["email", "whatsapp", "sms"] as const;
    return types.map((t) => ({ name: t, count: campaigns.filter((c) => c.campaign_type === t).length }));
  }, [campaigns]);

  // ── Campaigns by month ──
  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const c of campaigns) {
      const m = c.created_at.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
    }
    return Array.from(byMonth.entries()).slice(-12).map(([date, count]) => ({ date, count }));
  }, [campaigns]);

  const items = campaigns.map((c) => {
    const gym = c.gym_id ? dashboard.gyms.find((g) => g.id === c.gym_id) : null;
    const isScheduled = c.status === "scheduled" && c.scheduled_for;
    const scheduledDate = isScheduled ? new Date(c.scheduled_for!).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;

    return {
      id: c.id,
      title: c.name,
      subtitle: `${formatEnterpriseLabel(c.campaign_type)} · ${gym?.name ?? "All gyms"}`,
      meta: `${formatEnterpriseLabel(c.category)} · Segment: ${c.segment_key}${scheduledDate ? ` · Scheduled: ${scheduledDate}` : ""} · ${new Date(c.created_at).toLocaleDateString("en-IN")}`,
      badge: c.status,
      badgeVariant: (c.status === "running" ? "success" : c.status === "completed" ? "info" : c.status === "scheduled" ? "info" : "neutral") as "success" | "info" | "neutral",
      status: c.status,
      sections: [
        { label: "Channel", value: formatEnterpriseLabel(c.campaign_type) },
        { label: "Category", value: formatEnterpriseLabel(c.category) },
        { label: "Segment", value: c.segment_key },
        { label: "Status", value: c.status },
      ],
      actions: [
        { label: "Details", onClick: () => setDetailCampaign(c), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
        ...(c.status === "draft" || c.status === "scheduled"
          ? [{ label: "Edit", onClick: () => openEdit(c), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
             { label: "Send Now", onClick: () => handleSend(c.id), variant: "primary" as const, icon: <Send className="size-3.5" /> }]
          : [])
      ]
    };
  });

  const totalItems = moduleData?.items?.length ?? campaigns.length;

  return (
    <div className="space-y-6">
      {/* ═══ SUB-TABS ═══ */}
      {hasNetworkCampaigns || hasNpsSurveys || hasCustomEmailDomain ? (
        <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-1">
          <button
            onClick={() => setActiveTab("campaigns")}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
              activeTab === "campaigns"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            type="button"
          >
            <Mail className="size-4" />
            Campaigns
          </button>
          {hasNetworkCampaigns ? (
            <button
              onClick={() => setActiveTab("network")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
                activeTab === "network"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              type="button"
            >
              <Globe className="size-4" />
              Network Campaigns
            </button>
          ) : null}
          {hasNpsSurveys ? (
            <button
              onClick={() => setActiveTab("nps")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
                activeTab === "nps"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              type="button"
            >
              <MessageSquare className="size-4" />
              NPS Surveys
            </button>
          ) : null}
          {hasCustomEmailDomain ? (
            <button
              onClick={() => setActiveTab("email-settings")}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
                activeTab === "email-settings"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              type="button"
            >
              <Mail className="size-4" />
              Email Settings
            </button>
          ) : null}
        </div>
      ) : null}

      {activeTab === "network" ? <NetworkCampaignPanel dashboard={dashboard} /> : activeTab === "nps" ? <NPSSurveyPanel dashboard={dashboard} /> : activeTab === "email-settings" ? <EmailSettingsPanel dashboard={dashboard} /> : (
        <>
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total notifications in the system" icon={<MessageSquare className="size-5" />} label="Notifications" value={formatCompactNumber(notifications.length)} />
        <StatCard detail="Unread notifications" icon={<MessageSquare className="size-5" />} label="Unread" value={formatCompactNumber(unreadNotif)} />
        <StatCard detail="Marketing campaigns" icon={<Mail className="size-5" />} label="Campaigns" value={formatCompactNumber(campaigns.length)} />
        <StatCard detail="Active or scheduled campaigns" icon={<CalendarDays className="size-5" />} label="Running" value={String(runningCount)} />
        <StatCard detail="Completed campaigns" icon={<MessageSquare className="size-5" />} label="Completed" value={formatCompactNumber(completedCount)} />
        <StatCard detail="Draft campaigns ready to send" icon={<MessageSquare className="size-5" />} label="Drafts" value={formatCompactNumber(draftCount)} />
      </section>

      {/* ═══ CHARTS ═══ */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Channels</p><h3 className="text-2xl font-black">Channel Distribution</h3></CardHeader>
          <CardContent>
            {channelDist.every((d) => d.count === 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No campaigns yet.</p>
            ) : (
              <div className="space-y-4">
                {channelDist.map((ch, i) => {
                  const pct = campaigns.length > 0 ? Math.round((ch.count / campaigns.length) * 100) : 0;
                  return (
                    <div key={ch.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold capitalize">{ch.name}</span>
                        <span className="font-semibold text-muted-foreground">{ch.count} ({pct}%)</span>
                      </div>
                      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-surface-muted">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Activity</p><h3 className="text-2xl font-black">Campaigns Over Time</h3></CardHeader>
          <CardContent>
            {monthlyTrend.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No campaign data yet.</p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrend}>
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {monthlyTrend.map((_, i) => <Cell key={i} {...{ fill: CHART_COLORS[i % CHART_COLORS.length] } as any} />)}
                    </Bar>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} allowDecimals={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ FILTERS + DATA LIST ═══ */}
      <FilterBar
        filterGroups={[
          { key: "status", label: "Status", options: [
            { value: "draft", label: "Draft" }, { value: "scheduled", label: "Scheduled" },
            { value: "running", label: "Running" }, { value: "completed", label: "Completed" }
          ]},
          { key: "campaignType", label: "Channel", options: [
            { value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }, { value: "sms", label: "SMS" }
          ]}
        ]}
        searchPlaceholder="Search campaigns by name or segment..."
        onApply={handleApply}
        activeFilters={filters as unknown as Record<string, string>}
      />

      <DataList
        selectable
        bulkActions={[
          { label: "Send Selected", onClick: async (ids) => { for (const id of ids) await handleSend(id); showToast(`${ids.length} campaign(s) sent`, "success"); }, variant: "primary" as const, icon: <Send className="size-3.5" /> },
          { label: "Export CSV", onClick: (ids) => { const data = campaigns.filter((c) => ids.includes(c.id)).map((c) => ({ name: c.name, type: c.campaign_type, category: c.category, status: c.status, segment: c.segment_key, created: c.created_at })); exportToCSV(data, "campaigns-selected"); }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        onExportCSV={() => exportToCSV(campaigns.map((c) => ({ name: c.name, type: c.campaign_type, category: c.category, status: c.status, segment: c.segment_key, created: c.created_at, gym_id: c.gym_id })), "all-campaigns")}
        headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Create Campaign</Button>}
        headerTitle="Campaigns" items={items}
        totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))}
        currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer description={editingCampaign ? `Editing ${editingCampaign.name}` : "Create a new campaign"} onClose={closeDrawer} open={drawerOpen} title={editingCampaign ? "Edit Campaign" : "Create Campaign"} size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingCampaign ? <input name="campaignId" type="hidden" value={editingCampaign.id} /> : null}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required>
              <select className={selectClass} defaultValue={editingCampaign?.gym_id ?? ""} name="gymId" required>
                <option value="">Select gym</option>{dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Campaign Name" required>
              <input className={selectClass} defaultValue={editingCampaign?.name ?? ""} name="name" required type="text" placeholder="Summer Promotion 2025" />
            </DrawerField>
            <DrawerField label="Channel" required>
              <select className={selectClass} defaultValue={editingCampaign?.campaign_type ?? "email"} name="campaignType" required>
                <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option>
              </select>
            </DrawerField>
            <DrawerField label="Category">
              <select className={selectClass} defaultValue={editingCampaign?.category ?? "promotions"} name="category">
                <option value="membership">Membership</option><option value="payments">Payments</option>
                <option value="promotions">Promotions</option><option value="attendance">Attendance</option>
                <option value="classes">Classes</option><option value="system">System</option>
              </select>
            </DrawerField>
            <DrawerField label="Segment Key">
              <select className={selectClass} defaultValue={editingCampaign?.segment_key ?? "all"} name="segmentKey">
                <option value="all">All Members</option><option value="active">Active Members</option>
                <option value="inactive">Inactive Members</option><option value="expiring">Expiring Soon</option>
              </select>
            </DrawerField>
            <DrawerField label="Schedule Send">
              <input className={selectClass} defaultValue={editingCampaign?.scheduled_for?.slice(0, 16) ?? ""} name="scheduledFor" type="datetime-local" />
            </DrawerField>
          </div>
          <DrawerField label="Subject">
            <input className={selectClass} defaultValue={(editingCampaign as Record<string, unknown>)?.subject as string ?? ""} name="subject" type="text" placeholder="Subject line for your campaign" />
          </DrawerField>
          <DrawerField label="Content">
            <textarea className={`${selectClass} min-h-[120px]`} defaultValue={(editingCampaign as Record<string, unknown>)?.content as string ?? ""} name="content" placeholder="Your message content..." rows={5} />
          </DrawerField>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingCampaign ? "Update" : "Create Campaign"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ DETAIL PANEL ═══ */}
      {detailCampaign ? <CampaignDetailPanel campaign={detailCampaign} dashboard={dashboard} onClose={() => setDetailCampaign(null)} /> : null}
        </>
      )}
    </div>
  );
}

function CampaignDetailPanel({ campaign, dashboard, onClose }: { campaign: CampaignRow; dashboard: OrganizationOwnerDashboard; onClose: () => void }) {
  const gym = campaign.gym_id ? dashboard.gyms.find((g) => g.id === campaign.gym_id) : null;
  const content = (campaign as unknown as Record<string, string>)?.content ?? "";
  const subject = (campaign as unknown as Record<string, string>)?.subject ?? "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Campaign details">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black truncate">{campaign.name}</h2>
              <EnterpriseStatusBadge status={campaign.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{formatEnterpriseLabel(campaign.campaign_type)} · {gym?.name ?? "All gyms"}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><MessageSquare className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Card>
            <CardHeader><h3 className="text-lg font-black">Details</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Channel</p><p className="text-sm font-bold capitalize">{campaign.campaign_type}</p></div>
              <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm font-bold">{formatEnterpriseLabel(campaign.category)}</p></div>
              <div><p className="text-xs text-muted-foreground">Segment</p><p className="text-sm font-bold">{campaign.segment_key}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={campaign.status} /></div>
              <div><p className="text-xs text-muted-foreground">Created</p><p className="text-sm font-bold">{new Date(campaign.created_at).toLocaleString("en-IN")}</p></div>
              {campaign.scheduled_for ? <div><p className="text-xs text-muted-foreground">Scheduled</p><p className="text-sm font-bold">{new Date(campaign.scheduled_for).toLocaleString("en-IN")}</p></div> : null}
              {campaign.started_at ? <div><p className="text-xs text-muted-foreground">Sent</p><p className="text-sm font-bold">{new Date(campaign.started_at).toLocaleString("en-IN")}</p></div> : null}
            </CardContent>
          </Card>
          {subject ? (
            <Card>
              <CardHeader><h3 className="text-lg font-black">Subject</h3></CardHeader>
              <CardContent><p className="text-sm font-medium">{subject}</p></CardContent>
            </Card>
          ) : null}
          {content ? (
            <Card>
              <CardHeader><h3 className="text-lg font-black">Content Preview</h3></CardHeader>
              <CardContent><div className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm">{content}</div></CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
