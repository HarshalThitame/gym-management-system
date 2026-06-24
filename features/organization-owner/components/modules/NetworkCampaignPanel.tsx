"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckSquare, ChevronDown, ChevronRight, Eye, Loader2, Mail, MessageSquare, Phone, Plus, Search, SendHorizontal, Users } from "lucide-react";
import { PieChart as RePie, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { Database } from "@/types/database";
import type { CampaignAnalytics, MemberRecipient } from "@/features/organization-owner/actions/communication-actions";
import { resolveCampaignRecipientsAction, executeNetworkCampaignAction, getCampaignAnalyticsAction, saveNetworkCampaignAction, getCampaignDeliveriesAction } from "@/features/organization-owner/actions/communication-actions";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import { cn } from "@/lib/utils";

type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type NetworkTab = "builder" | "campaigns" | "analytics";

const CHART_COLORS = ["#0891b2", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6"];
const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function NetworkCampaignPanel({ dashboard }: { dashboard: OrganizationOwnerDashboard }) {
  const [activeTab, setActiveTab] = useState<NetworkTab>("builder");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRecipients, setPreviewRecipients] = useState<MemberRecipient[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [segmentExpanded, setSegmentExpanded] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [analyticsCampaignId, setAnalyticsCampaignId] = useState("");
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deliveryRows, setDeliveryRows] = useState<Array<{ id: string; recipient: string; channel: string; status: string; sent_at: string | null; error_message: string | null }>>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const campaigns = (dashboard.campaigns ?? []) as CampaignRow[];
  const networkCampaigns = campaigns.filter((c) => c.campaign_type === "multi_channel" || (c.target_gym_ids && c.target_gym_ids.length > 0));

  const loadAnalytics = useCallback(async (campaignId: string) => {
    if (!campaignId) { setAnalytics(null); setDeliveryRows([]); return; }
    setAnalyticsLoading(true);
    setDeliveriesLoading(true);
    try {
      const [result, deliveriesResult] = await Promise.all([
        getCampaignAnalyticsAction(dashboard.organization.id, campaignId),
        fetchRecentDeliveries(campaignId),
      ]);
      setAnalytics(result);
      setDeliveryRows(deliveriesResult);
    } catch (e) {
      showToast("Failed to load analytics", "error");
    } finally {
      setAnalyticsLoading(false);
      setDeliveriesLoading(false);
    }
  }, [dashboard.organization.id]);

  const fetchRecentDeliveries = useCallback(async (campaignId: string) => {
    return getCampaignDeliveriesAction(dashboard.organization.id, campaignId);
  }, [dashboard.organization.id]);

  const handlePreview = useCallback(async () => {
    const form = document.getElementById("network-campaign-form") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    const targetGymsRaw = fd.get("targetGymIds") as string;
    const segmentRaw = fd.get("segmentFilters") as string;
    if (!targetGymsRaw) { showToast("Select at least one target gym", "error"); return; }
    const targetGymIds = targetGymsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    let filters = {};
    try { filters = segmentRaw ? JSON.parse(segmentRaw) : {}; } catch { /* ignore */ }
    setPreviewLoading(true);
    try {
      const result = await resolveCampaignRecipientsAction(dashboard.organization.id, targetGymIds, filters);
      setPreviewRecipients(result.members.slice(0, 20));
      setPreviewTotal(result.total);
    } catch (e) {
      showToast("Failed to resolve recipients", "error");
    } finally {
      setPreviewLoading(false);
    }
  }, [dashboard.organization.id]);

  const handleSaveDraft = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const result = await saveNetworkCampaignAction({ status: "idle", message: null } as never, fd);
    showToast(result.message ?? "Saved", result.status === "success" ? "success" : "error");
    setSaving(false);
  }, []);

  const handleSend = useCallback(async (campaignId: string) => {
    setSendingId(campaignId);
    try {
      const r = await executeNetworkCampaignAction(dashboard.organization.id, campaignId);
      showToast(`Sent ${r.sent}, Failed ${r.failed}`, r.sent > 0 ? "success" : "error");
    } catch (e) {
      showToast("Failed to send campaign", "error");
    } finally {
      setSendingId(null);
    }
  }, [dashboard.organization.id]);

  useEffect(() => {
    if (analyticsCampaignId) loadAnalytics(analyticsCampaignId);
  }, [analyticsCampaignId, loadAnalytics]);

  const tabs = [
    { key: "builder" as const, label: "Campaign Builder", icon: <Plus className="size-4" /> },
    { key: "campaigns" as const, label: "Campaigns", icon: <SendHorizontal className="size-4" /> },
    { key: "analytics" as const, label: "Analytics", icon: <BarChart3 className="size-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ SUB-TABS ═══ */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            type="button"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: CAMPAIGN BUILDER ═══ */}
      {activeTab === "builder" ? (
        <form id="network-campaign-form" onSubmit={handleSaveDraft} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold">Campaign Name</label>
              <input className={selectClass} name="name" required placeholder="Summer Multi-Branch Campaign" type="text" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold">Category</label>
              <select className={selectClass} name="category" defaultValue="promotions">
                <option value="membership">Membership</option>
                <option value="payments">Payments</option>
                <option value="promotions">Promotions</option>
                <option value="attendance">Attendance</option>
                <option value="classes">Classes</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>

          {/* Channels */}
          <div>
            <label className="mb-1 block text-sm font-bold">Channels</label>
            <input name="channels" type="hidden" id="network-channels-hidden" />
            <ChannelMultiSelect />
          </div>

          {/* Target gyms */}
          <div>
            <label className="mb-1 block text-sm font-bold">Target Gyms</label>
            <input name="targetGymIds" type="hidden" id="network-gyms-hidden" />
            <GymMultiSelect gyms={dashboard.gyms} />
          </div>

          {/* Message content per channel */}
          <Card>
            <CardHeader><h3 className="text-lg font-black">Message Content</h3></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold">Email Subject</label>
                <input className={selectClass} name="emailSubject" placeholder="Special offer for you, {{name}}!" type="text" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">Email Body (HTML)</label>
                <textarea className={`${selectClass} min-h-[100px]`} name="emailBody" placeholder="<p>Hello {{name}},</p><p>Check out our latest offer...</p>" rows={4} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">SMS Message</label>
                <textarea className={`${selectClass} min-h-[80px]`} name="smsBody" placeholder="Hi {{name}}, check our new offer! Visit us today." rows={2} maxLength={160} />
                <input type="hidden" name="messageBody" id="network-message-body-hidden" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold">WhatsApp Message</label>
                <textarea className={`${selectClass} min-h-[80px]`} name="whatsappBody" placeholder="Hi {{name}}! We have an exciting offer for you..." rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Segment builder */}
          <Card>
            <CardHeader>
              <button
                type="button"
                onClick={() => setSegmentExpanded(!segmentExpanded)}
                className="flex w-full items-center justify-between"
              >
                <h3 className="text-lg font-black">Member Segment</h3>
                {segmentExpanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
              </button>
            </CardHeader>
            {segmentExpanded ? (
              <CardContent className="space-y-4">
                <input name="segmentFilters" type="hidden" id="network-segment-hidden" />
                <div>
                  <label className="mb-1 block text-sm font-bold">Member Status</label>
                  <select className={selectClass} name="segmentStatus" multiple defaultValue={["active"]}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Inactive For (days)</label>
                  <input className={selectClass} name="inactiveDays" type="number" min={0} defaultValue={0} placeholder="0 = all" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold">Plan Type</label>
                  <select className={selectClass} name="planType">
                    <option value="">All</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half_yearly">Half-Yearly</option>
                    <option value="annual">Annual</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </CardContent>
            ) : null}
          </Card>

          {/* Preview recipients */}
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={handlePreview} disabled={previewLoading}>
              {previewLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Preview Recipients
            </Button>
            {previewTotal > 0 ? (
              <span className="text-sm font-bold text-muted-foreground">
                {previewTotal} member(s) match your criteria
              </span>
            ) : previewTotal === 0 && !previewLoading ? (
              <span className="text-sm font-bold text-amber-500">
                0 recipients match — adjust your segment or gyms
              </span>
            ) : null}
          </div>
          {previewRecipients.length > 0 ? (
            <Card>
              <CardHeader><h3 className="text-lg font-black">Sample Recipients ({previewTotal} total)</h3></CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 font-bold">Name</th>
                        <th className="py-2 font-bold">Email</th>
                        <th className="py-2 font-bold">Phone</th>
                        <th className="py-2 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRecipients.map((m) => (
                        <tr key={m.id} className="border-b border-border/50">
                          <td className="py-1.5">{m.full_name}</td>
                          <td className="py-1.5 text-muted-foreground">{m.email ?? "-"}</td>
                          <td className="py-1.5 text-muted-foreground">{m.phone}</td>
                          <td className="py-1.5"><EnterpriseStatusBadge status={m.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Schedule */}
          <div>
            <label className="mb-1 block text-sm font-bold">Schedule</label>
            <input className={selectClass} name="scheduledFor" type="datetime-local" />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="secondary" onClick={() => {
              const form = document.getElementById("network-campaign-form") as HTMLFormElement;
              compileFormData(form);
              form.requestSubmit();
            }} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save as Draft
            </Button>
            <Button type="button" variant="primary" onClick={async () => {
              const form = document.getElementById("network-campaign-form") as HTMLFormElement;
              compileFormData(form);
              setSaving(true);
              const fd = new FormData(form);
              const result = await saveNetworkCampaignAction({ status: "idle", message: null } as never, fd);
              if (result.status !== "success") {
                showToast(result.message ?? "Failed to save", "error");
                setSaving(false);
                return;
              }
              setSaving(false);
              const campaignIdInput = form.querySelector("[name='campaignId']") as HTMLInputElement | null;
              const campaignId = campaignIdInput?.value;
              if (campaignId) {
                setSendingId(campaignId);
                try {
                  const r = await executeNetworkCampaignAction(dashboard.organization.id, campaignId);
                  showToast(`Sent ${r.sent}, Failed ${r.failed}`, r.sent > 0 ? "success" : "error");
                } catch (e) {
                  showToast("Failed to send campaign", "error");
                } finally { setSendingId(null); }
              } else {
                showToast("Campaign saved as draft. Find it in the Campaigns tab to send.", "info");
              }
            }} disabled={saving || sendingId !== null}>
              {(saving || sendingId !== null) ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
              Send Campaign
            </Button>
          </div>
        </form>
      ) : null}

      {/* ═══ TAB: CAMPAIGN LIST ═══ */}
      {activeTab === "campaigns" ? (
        <div className="space-y-4">
          {networkCampaigns.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No network-wide campaigns yet. Create one in the Campaign Builder tab.</p>
          ) : (
            networkCampaigns.map((c) => {
              const gymCount = c.target_gym_ids?.length ?? 0;
              const channelCount = c.channels?.length ?? 0;
              const channels = c.channels?.length ? c.channels : (c.campaign_type !== "multi_channel" ? [c.campaign_type] : []);
              return (
                <Card key={c.id}>
                  <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black truncate">{c.name}</h3>
                        <EnterpriseStatusBadge status={c.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {gymCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5 text-xs font-bold">
                            <Users className="size-3" /> {gymCount} branch{gymCount !== 1 ? "es" : ""}
                          </span>
                        ) : null}
                        {channels.map((ch) => (
                          <span key={ch} className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5 text-xs font-bold">
                            {ch === "email" ? <Mail className="size-3" /> : ch === "whatsapp" ? <MessageSquare className="size-3" /> : <Phone className="size-3" />}
                            {ch === "email" ? "Email" : ch === "whatsapp" ? "WhatsApp" : "SMS"}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>Sent: {c.sent_count ?? 0}</span>
                        <span>Delivered: {c.delivered_count ?? 0}</span>
                        <span>Opened: {c.opened_count ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(c.status === "draft" || c.status === "scheduled") ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleSend(c.id)}
                          disabled={sendingId === c.id}
                        >
                          {sendingId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
                          Send
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => { setAnalyticsCampaignId(c.id); setActiveTab("analytics"); }}
                      >
                        <Eye className="size-3.5" /> Analytics
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {/* ═══ TAB: ANALYTICS ═══ */}
      {activeTab === "analytics" ? (
        <div className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-bold">Select Campaign</label>
            <select
              className={selectClass}
              value={analyticsCampaignId}
              onChange={(e) => setAnalyticsCampaignId(e.target.value)}
            >
              <option value="">-- Select a campaign --</option>
              {networkCampaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
              ))}
            </select>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Engagement gauge */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Engagement Rate</h3></CardHeader>
                <CardContent className="flex items-center justify-center py-6">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative size-32">
                      <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-surface-muted, #e5e7eb)" strokeWidth="3" />
                        <circle
                          cx="18" cy="18" r="15.5"
                          fill="none"
                          stroke="#0891b2"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${analytics.engagementRate * 0.9739} 97.39`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-black">{analytics.engagementRate}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">(opened + clicked) / delivered</p>
                  </div>
                </CardContent>
              </Card>

              {/* Stats grid */}
              <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <StatCard detail="Total deliveries" icon={<SendHorizontal className="size-4" />} label="Sent" value={formatCompactNumber(analytics.deliveries.sent)} />
                <StatCard detail="Successfully delivered" icon={<CheckSquare className="size-4" />} label="Delivered" value={formatCompactNumber(analytics.deliveries.delivered)} />
                <StatCard detail="Opened by recipients" icon={<Eye className="size-4" />} label="Opened" value={formatCompactNumber(analytics.deliveries.opened)} />
                <StatCard detail="Clicked through" icon={<Eye className="size-4" />} label="Clicked" value={formatCompactNumber(analytics.deliveries.clicked)} />
                <StatCard detail="Failed deliveries" icon={<SendHorizontal className="size-4" />} label="Failed" value={formatCompactNumber(analytics.deliveries.failed)} />
                <StatCard detail="Bounced emails" icon={<SendHorizontal className="size-4" />} label="Bounced" value={formatCompactNumber(analytics.deliveries.bounced)} />
              </section>

              {/* Pie chart + channel breakdown */}
              <div className="grid gap-5 xl:grid-cols-2">
                <Card>
                  <CardHeader><h3 className="text-lg font-black">Delivery Status</h3></CardHeader>
                  <CardContent>
                    {analytics.deliveries.total === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">No deliveries yet.</p>
                    ) : (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RePie>
                            <Pie
                              data={[
                                { name: "Sent", value: Math.max(0, analytics.deliveries.sent - analytics.deliveries.delivered) },
                                { name: "Delivered", value: Math.max(0, analytics.deliveries.delivered - analytics.deliveries.opened) },
                                { name: "Opened", value: Math.max(0, analytics.deliveries.opened - analytics.deliveries.clicked) },
                                { name: "Clicked", value: analytics.deliveries.clicked },
                                { name: "Failed", value: analytics.deliveries.failed },
                                { name: "Bounced", value: analytics.deliveries.bounced },
                              ].filter((d) => d.value > 0)}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            >
                              {CHART_COLORS.map((color, i) => (
                                <Cell key={i} fill={color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </RePie>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><h3 className="text-lg font-black">Channel Breakdown</h3></CardHeader>
                  <CardContent className="space-y-4">
                    {(["email", "whatsapp", "sms"] as const).map((ch) => {
                      const stats = analytics.byChannel[ch] ?? { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
                      return (
                        <div key={ch}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-bold capitalize flex items-center gap-1">
                              {ch === "email" ? <Mail className="size-3.5" /> : ch === "whatsapp" ? <MessageSquare className="size-3.5" /> : <Phone className="size-3.5" />}
                              {ch}
                            </span>
                            <span className="text-muted-foreground">{stats.total} total</span>
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                            <span className="rounded bg-surface-muted px-2 py-1 text-center">Sent: {stats.sent}</span>
                            <span className="rounded bg-surface-muted px-2 py-1 text-center">Delivered: {stats.delivered}</span>
                            <span className="rounded bg-surface-muted px-2 py-1 text-center">Opened: {stats.opened}</span>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              {/* By Status breakdown */}
              {Object.keys(analytics.byStatus).length > 0 ? (
                <Card>
                  <CardHeader><h3 className="text-lg font-black">Status Breakdown</h3></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(analytics.byStatus).map(([status, count]) => (
                        <span key={status} className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-3 py-2 text-sm font-bold">
                          <span className="size-2 rounded-full" style={{ backgroundColor: status === "sent" ? "#0891b2" : status === "delivered" ? "#16a34a" : status === "opened" ? "#f59e0b" : status === "clicked" ? "#8b5cf6" : status === "failed" ? "#ef4444" : "#6b7280" }} />
                          {status}: {count}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Recent deliveries table */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Recent Deliveries</h3></CardHeader>
                <CardContent>
                  {deliveryRows.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No delivery records yet.</p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="py-2 font-bold">Recipient</th>
                            <th className="py-2 font-bold">Channel</th>
                            <th className="py-2 font-bold">Status</th>
                            <th className="py-2 font-bold">Sent At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveryRows.map((d) => (
                            <tr key={d.id} className="border-b border-border/50">
                              <td className="py-1.5 max-w-[200px] truncate" title={d.recipient}>{d.recipient}</td>
                              <td className="py-1.5 capitalize">{d.channel}</td>
                              <td className="py-1.5"><EnterpriseStatusBadge status={d.status} /></td>
                              <td className="py-1.5 text-muted-foreground">{d.sent_at ? new Date(d.sent_at).toLocaleString("en-IN") : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : analyticsCampaignId ? null : (
            <p className="py-12 text-center text-sm text-muted-foreground">Select a campaign to view analytics.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Helper: Channel multi-select with hidden input ────────────────────────

function ChannelMultiSelect() {
  const [channels, setChannels] = useState<Set<string>>(new Set(["email"]));

  const toggle = (ch: string) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) { if (next.size > 1) next.delete(ch); }
      else next.add(ch);
      return next;
    });
  };

  useEffect(() => {
    const el = document.getElementById("network-channels-hidden") as HTMLInputElement | null;
    if (el) el.value = Array.from(channels).join(",");
  }, [channels]);

  const options = [
    { key: "email", label: "Email", icon: <Mail className="size-4" /> },
    { key: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="size-4" /> },
    { key: "sms", label: "SMS", icon: <Phone className="size-4" /> },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => toggle(opt.key)}
          className={cn(
            "flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-bold transition-all",
            channels.has(opt.key)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-border-strong"
          )}
        >
          {opt.icon}
          {opt.label}
          {channels.has(opt.key) ? <CheckSquare className="size-3.5" /> : null}
        </button>
      ))}
    </div>
  );
}

// ── Helper: Gym multi-select with hidden input ────────────────────────────

function GymMultiSelect({ gyms }: { gyms: Array<{ id: string; name: string }> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(gyms.length > 0 && gyms[0] ? [gyms[0].id] : []));
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const el = document.getElementById("network-gyms-hidden") as HTMLInputElement | null;
    if (el) el.value = Array.from(selected).join(",");
  }, [selected]);

  const toggleAll = () => {
    if (selected.size === gyms.length) setSelected(new Set());
    else setSelected(new Set(gyms.map((g) => g.id)));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center justify-between rounded-md border border-border bg-surface px-3 text-sm shadow-sm"
      >
        <span className="font-bold truncate">
          {selected.size === 0 ? "Select gyms" : `${selected.size} gym(s) selected`}
        </span>
        <ChevronDown className={cn("size-4 transition", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
          <button
            type="button"
            onClick={toggleAll}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-sm font-bold hover:bg-surface-muted"
          >
            {selected.size === gyms.length ? <CheckSquare className="size-4" /> : <div className="size-4" />}
            {selected.size === gyms.length ? "Deselect All" : "Select All"}
          </button>
          <div className="max-h-48 overflow-y-auto">
            {gyms.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-muted"
              >
                {selected.has(g.id) ? <CheckSquare className="size-4 text-primary" /> : <div className="size-4" />}
                {g.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Helper: Compile form data into hidden inputs before submit ─────────────

function compileFormData(form: HTMLFormElement) {
  const messageBody: Record<string, string> = {};
  const emailSubject = (form.querySelector("[name='emailSubject']") as HTMLInputElement | null)?.value ?? "";
  const emailBody = (form.querySelector("[name='emailBody']") as HTMLTextAreaElement | null)?.value ?? "";
  const smsBody = (form.querySelector("[name='smsBody']") as HTMLTextAreaElement | null)?.value ?? "";
  const whatsappBody = (form.querySelector("[name='whatsappBody']") as HTMLTextAreaElement | null)?.value ?? "";

  messageBody["email_subject"] = emailSubject;
  messageBody["email"] = emailBody;
  messageBody["sms"] = smsBody;
  messageBody["whatsapp"] = whatsappBody;

  let msgEl = form.querySelector("#network-message-body-hidden") as HTMLInputElement | null;
  if (!msgEl) { msgEl = document.createElement("input"); msgEl.type = "hidden"; msgEl.id = "network-message-body-hidden"; msgEl.name = "messageBody"; form.appendChild(msgEl); }
  msgEl.value = JSON.stringify(messageBody);

  const status = (form.querySelector("[name='segmentStatus']") as HTMLSelectElement | null);
  const inactiveDays = (form.querySelector("[name='inactiveDays']") as HTMLInputElement | null);
  const planType = (form.querySelector("[name='planType']") as HTMLSelectElement | null);
  const segmentFilters: Record<string, unknown> = {};
  if (status?.selectedOptions.length) {
    segmentFilters["status"] = Array.from(status.selectedOptions).map((o) => o.value);
  }
  if (inactiveDays?.value) {
    segmentFilters["inactive_days"] = parseInt(inactiveDays.value, 10);
  }
  if (planType?.value) {
    segmentFilters["plan_type"] = [planType.value];
  }

  let segEl = form.querySelector("#network-segment-hidden") as HTMLInputElement | null;
  if (!segEl) { segEl = document.createElement("input"); segEl.type = "hidden"; segEl.id = "network-segment-hidden"; segEl.name = "segmentFilters"; form.appendChild(segEl); }
  segEl.value = JSON.stringify(segmentFilters);
}
