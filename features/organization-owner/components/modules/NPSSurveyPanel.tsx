"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download, Edit3, HelpCircle, Loader2, Mail, MessageSquare,
  Plus, Send, Smartphone, Trash2, TrendingUp, Users,
} from "lucide-react";
import {
  Bar, BarChart, Cell, Line, LineChart, Pie, PieChart as RePie,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import {
  getSurveys, createSurvey, updateSurvey, deleteSurvey,
  getNPSDashboard, processAutoSurveys, getSurveyNpsScores,
  type NPSSurvey, type NPSDashboard, type NPSSurveyInput,
} from "@/features/organization-owner/actions/nps-actions";

type NPSTab = "surveys" | "dashboard";

const selectClass =
  "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function NPSSurveyPanel({
  dashboard,
}: {
  dashboard: OrganizationOwnerDashboard;
}) {
  const organizationId = dashboard.organization.id;
  const [activeTab, setActiveTab] = useState<NPSTab>("surveys");
  const [surveys, setSurveys] = useState<NPSSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<NPSSurvey | null>(null);
  const [saving, setSaving] = useState(false);
  const [dashboardData, setDashboardData] = useState<NPSDashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [surveyNpsMap, setSurveyNpsMap] = useState<Record<string, number | null>>({});
  const [drawerTriggerType, setDrawerTriggerType] = useState<string>("manual");

  const refreshSurveys = useCallback(async () => {
    setLoading(true);
    const [list, npsScores] = await Promise.all([
      getSurveys(organizationId),
      getSurveyNpsScores(organizationId),
    ]);
    setSurveys(list);
    setSurveyNpsMap(npsScores);
    setLoading(false);
  }, [organizationId]);

  const refreshDashboard = useCallback(async () => {
    setDashLoading(true);
    const data = await getNPSDashboard(
      organizationId,
      selectedSurveyId ? { surveyId: selectedSurveyId } : undefined,
    );
    setDashboardData(data);
    setDashLoading(false);
  }, [organizationId, selectedSurveyId]);

  useEffect(() => { refreshSurveys(); }, [refreshSurveys]);
  useEffect(() => {
    if (activeTab === "dashboard") refreshDashboard();
  }, [activeTab, refreshDashboard]);

  const openCreate = () => { setEditingSurvey(null); setDrawerTriggerType("manual"); setDrawerOpen(true); };
  const openEdit = (s: NPSSurvey) => { setEditingSurvey(s); setDrawerTriggerType(s.trigger_type); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingSurvey(null); };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const data: NPSSurveyInput = {
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
      question: (fd.get("question") as string) || undefined,
      thankYouMessage: (fd.get("thankYouMessage") as string) || undefined,
      triggerType: fd.get("triggerType") as NPSSurveyInput["triggerType"],
      triggerDays: Number(fd.get("triggerDays")) || 0,
      channel: (fd.get("channel") as NPSSurveyInput["channel"]) || "email",
      isActive: fd.get("isActive") === "true",
    };
    try {
      let targetSegment: Record<string, unknown> = {};
      const segmentRaw = fd.get("targetSegment") as string;
      try { if (segmentRaw) targetSegment = JSON.parse(segmentRaw); } catch { /* ignore */ }
      data.targetSegment = targetSegment;
    } catch { /* ignore */ }

    if (editingSurvey) {
      const result = await updateSurvey(organizationId, editingSurvey.id, data);
      if (result) showToast("Survey updated", "success");
      else showToast("Failed to update survey", "error");
    } else {
      const result = await createSurvey(organizationId, data);
      if (result) showToast("Survey created", "success");
      else showToast("Failed to create survey", "error");
    }
    setSaving(false);
    closeDrawer();
    refreshSurveys();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteSurvey(organizationId, id);
    if (result.success) showToast("Survey deleted", "success");
    else showToast("Failed to delete survey", "error");
    refreshSurveys();
  };

  const handleSendNow = async (surveyId: string) => {
    setProcessingId(surveyId);
    const result = await processAutoSurveys(organizationId, surveyId);
    showToast(
      `Sent to ${result.sent} members, ${result.skipped} skipped`,
      "success",
    );
    setProcessingId(null);
    refreshSurveys();
  };

  const handleProcessAll = async () => {
    const result = await processAutoSurveys(organizationId);
    showToast(
      `Processed ${result.processed}: ${result.sent} sent, ${result.skipped} skipped`,
      "success",
    );
    refreshSurveys();
  };

  return (
    <div className="space-y-6">
      {/* ═══ SUB-TABS ═══ */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface-muted p-1">
        <button
          onClick={() => setActiveTab("surveys")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
            activeTab === "surveys"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          type="button"
        >
          <Mail className="size-4" />
          Surveys
        </button>
        <button
          onClick={() => setActiveTab("dashboard")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-all",
            activeTab === "dashboard"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          type="button"
        >
          <TrendingUp className="size-4" />
          Dashboard
        </button>
      </div>

      {activeTab === "dashboard" ? (
        <NPSDashboardView
          dashboard={dashboardData}
          loading={dashLoading}
          surveys={surveys}
          selectedSurveyId={selectedSurveyId}
          onSelectSurvey={setSelectedSurveyId}
        />
      ) : (
        <>
          {/* ═══ KPI GRID ═══ */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              detail="Total NPS surveys created"
              icon={<HelpCircle className="size-5" />}
              label="Surveys"
              value={formatCompactNumber(surveys.length)}
            />
            <StatCard
              detail="Active surveys collecting responses"
              icon={<Send className="size-5" />}
              label="Active"
              value={formatCompactNumber(surveys.filter((s) => s.is_active).length)}
            />
            <StatCard
              detail="Total responses received"
              icon={<Users className="size-5" />}
              label="Responses"
              value={formatCompactNumber(surveys.reduce((a, s) => a + s.response_count, 0))}
            />
            <StatCard
              detail="Total surveys sent"
              icon={<Mail className="size-5" />}
              label="Sent"
              value={formatCompactNumber(surveys.reduce((a, s) => a + s.sent_count, 0))}
            />
          </section>

          {/* ═══ ACTION BAR ═══ */}
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-black">NPS Surveys</h3>
            <div className="flex items-center gap-2">
              <Button onClick={handleProcessAll} size="sm" variant="secondary">
                <Send className="size-4" /> Process All
              </Button>
              <Button onClick={openCreate} size="sm" variant="primary">
                <Plus className="size-4" /> Create Survey
              </Button>
            </div>
          </div>

          {/* ═══ SURVEY LIST ═══ */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : surveys.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No surveys yet. Create your first NPS survey to start measuring member satisfaction.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-black text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-black text-muted-foreground">Trigger</th>
                    <th className="px-4 py-3 text-left font-black text-muted-foreground">Channel</th>
                    <th className="px-4 py-3 text-right font-black text-muted-foreground">Sent</th>
                    <th className="px-4 py-3 text-right font-black text-muted-foreground">Responses</th>
                    <th className="px-4 py-3 text-right font-black text-muted-foreground">NPS</th>
                    <th className="px-4 py-3 text-center font-black text-muted-foreground">Active</th>
                    <th className="px-4 py-3 text-right font-black text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {surveys.map((s) => (
                    <tr key={s.id} className="border-b border-border hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-bold">
                        <button
                          type="button"
                          className="text-left hover:text-primary"
                          onClick={() => {
                            setSelectedSurveyId(s.id);
                            setActiveTab("dashboard");
                          }}
                        >
                          {s.name}
                        </button>
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {s.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-bold capitalize">
                          {s.trigger_type.replace(/_/g, " ")}
                        </span>
                        {s.trigger_days > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (+{s.trigger_days}d)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold capitalize">
                          {s.channel === "email" ? (
                            <Mail className="size-3" />
                          ) : s.channel === "whatsapp" ? (
                            <Smartphone className="size-3" />
                          ) : s.channel === "sms" ? (
                            <MessageSquare className="size-3" />
                          ) : (
                            <Users className="size-3" />
                          )}
                          {s.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatCompactNumber(s.sent_count)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">
                        {formatCompactNumber(s.response_count)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(() => {
                          const nps = surveyNpsMap[s.id];
                          if (nps === null || nps === undefined) {
                            return s.response_count === 0 ? (
                              <span className="text-muted-foreground">N/A</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            );
                          }
                          return (
                            <span
                              className={cn(
                                "font-bold",
                                nps > 50 ? "text-green-600" : nps >= 0 ? "text-amber-500" : "text-red-600",
                              )}
                            >
                              {nps >= 0 ? `+${nps}` : nps}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-block size-2 rounded-full",
                            s.is_active ? "bg-green-500" : "bg-muted-foreground/30",
                          )}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSendNow(s.id)}
                            disabled={processingId === s.id}
                          >
                            {processingId === s.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Send className="size-3.5" />
                            )}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(s.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ═══ CREATE/EDIT DRAWER ═══ */}
          {drawerOpen ? (
            <div
              className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm"
              onClick={closeDrawer}
            >
              <div
                className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={editingSurvey ? "Edit Survey" : "Create Survey"}
              >
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                  <div>
                    <h2 className="text-xl font-black">
                      {editingSurvey ? "Edit Survey" : "Create Survey"}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {editingSurvey
                        ? `Editing ${editingSurvey.name}`
                        : "Create a new NPS survey"}
                    </p>
                  </div>
                  <button
                    className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    onClick={closeDrawer}
                    type="button"
                    aria-label="Close"
                  >
                    <MessageSquare className="size-5" />
                  </button>
                </div>
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">Survey Name</label>
                    <input
                      className={selectClass}
                      name="name"
                      required
                      defaultValue={editingSurvey?.name ?? ""}
                      placeholder="Monthly Member Satisfaction"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">Description</label>
                    <textarea
                      className={`${selectClass} min-h-[60px]`}
                      name="description"
                      defaultValue={editingSurvey?.description ?? ""}
                      placeholder="A short description of what this survey measures"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">Question</label>
                    <textarea
                      className={`${selectClass} min-h-[60px]`}
                      name="question"
                      defaultValue={
                        editingSurvey?.question ??
                        "How likely are you to recommend our gym to a friend or colleague?"
                      }
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">Thank You Message</label>
                    <textarea
                      className={`${selectClass} min-h-[60px]`}
                      name="thankYouMessage"
                      defaultValue={editingSurvey?.thank_you_message ?? "Thank you for your feedback!"}
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">Trigger Type</label>
                      <select
                        className={selectClass}
                        name="triggerType"
                        defaultValue={editingSurvey?.trigger_type ?? "manual"}
                        onChange={(e) => setDrawerTriggerType(e.target.value)}
                      >
                        <option value="manual">Manual</option>
                        <option value="after_join">After joining</option>
                        <option value="after_class">After class</option>
                        <option value="after_renewal">After renewal</option>
                        <option value="days_since_join">Days since join</option>
                        <option value="scheduled">Scheduled</option>
                      </select>
                    </div>
                    {drawerTriggerType === "manual" ? (
                      <div />
                    ) : (
                      <div className="space-y-2">
                        <label className="text-sm font-bold">Trigger Days</label>
                        <input
                          className={selectClass}
                          name="triggerDays"
                          type="number"
                          min={0}
                          defaultValue={editingSurvey?.trigger_days ?? (drawerTriggerType === "scheduled" ? 30 : 0)}
                          placeholder={drawerTriggerType === "scheduled" ? "30" : "7"}
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">Channel</label>
                      <select
                        className={selectClass}
                        name="channel"
                        defaultValue={editingSurvey?.channel ?? "email"}
                      >
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="in_app">In-App</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">Active</label>
                      <select
                        className={selectClass}
                        name="isActive"
                        defaultValue={editingSurvey?.is_active ? "true" : "false"}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold">
                      Target Segment (JSON, optional)
                    </label>
                    <textarea
                      className={`${selectClass} min-h-[80px] font-mono text-xs`}
                      name="targetSegment"
                      defaultValue={
                        editingSurvey?.target_segment
                          ? JSON.stringify(editingSurvey.target_segment, null, 2)
                          : '{\n  "status": ["active"]\n}'
                      }
                      placeholder='{"status": ["active"], "plan_types": ["monthly"]}'
                      rows={4}
                    />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-border pt-6">
                    <button
                      className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong"
                      onClick={closeDrawer}
                      type="button"
                    >
                      Cancel
                    </button>
                    <Button type="submit" variant="primary" disabled={saving}>
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : editingSurvey ? (
                        "Update"
                      ) : (
                        "Create Survey"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function NPSDashboardView({
  dashboard,
  loading,
  surveys,
  selectedSurveyId,
  onSelectSurvey,
}: {
  dashboard: NPSDashboard | null;
  loading: boolean;
  surveys: NPSSurvey[];
  selectedSurveyId: string;
  onSelectSurvey: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Failed to load NPS dashboard.
        </CardContent>
      </Card>
    );
  }

  if (dashboard.totalResponses === 0 && !selectedSurveyId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No responses yet. Send surveys to start collecting NPS data.
        </CardContent>
      </Card>
    );
  }

  const npsVal = dashboard.overallNPS;
  const npsDisplay = npsVal !== null ? (npsVal >= 0 ? `+${npsVal}` : `${npsVal}`) : "N/A";

  const pieData = [
    { name: "Promoters", value: dashboard.promoters.count, fill: "#16a34a" },
    { name: "Passives", value: dashboard.passives.count, fill: "#f59e0b" },
    { name: "Detractors", value: dashboard.detractors.count, fill: "#ef4444" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Survey selector */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-bold">Filter by Survey:</label>
          <select
            className={`${selectClass} max-w-xs`}
            value={selectedSurveyId}
            onChange={(e) => onSelectSurvey(e.target.value)}
          >
            <option value="">All Surveys</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            exportToCSV(
              dashboard.recentResponses.map((r) => ({
                Member: r.member_name,
                Score: r.score,
                Category: r.nps_category,
                Feedback: r.feedback ?? "",
                Date: new Date(r.responded_at).toLocaleDateString("en-IN"),
              })),
              `nps-responses-${new Date().toISOString().slice(0, 10)}`,
            );
            showToast("Exported CSV", "success");
          }}
        >
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* NPS Score Card */}
      <Card>
        <CardContent className="flex items-center gap-6 py-8">
          <div
            className={cn(
              "flex size-24 items-center justify-center rounded-full text-2xl font-black",
              npsVal !== null && npsVal > 50
                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                : npsVal !== null && npsVal >= 0
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
            )}
            style={npsVal === null ? { backgroundColor: "#f5f5f5", color: "#999" } : undefined}
          >
            {npsDisplay}
          </div>
          <div>
            <h3 className="text-2xl font-black">Net Promoter Score</h3>
            <p className="text-sm text-muted-foreground">
              Based on {dashboard.totalResponses} total response{dashboard.totalResponses !== 1 ? "s" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Category Stats */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          detail={`${dashboard.promoters.percentage}% of responses`}
          icon={<TrendingUp className="size-5 text-green-600" />}
          label="Promoters (9-10)"
          value={formatCompactNumber(dashboard.promoters.count)}
        />
        <StatCard
          detail={`${dashboard.passives.percentage}% of responses`}
          icon={<TrendingUp className="size-5 text-amber-500" />}
          label="Passives (7-8)"
          value={formatCompactNumber(dashboard.passives.count)}
        />
        <StatCard
          detail={`${dashboard.detractors.percentage}% of responses`}
          icon={<TrendingUp className="size-5 text-red-600" />}
          label="Detractors (0-6)"
          value={formatCompactNumber(dashboard.detractors.count)}
        />
      </section>

      {/* Charts Row */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Trend Line Chart */}
        <Card>
          <CardHeader>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
              Trend
            </p>
            <h3 className="text-2xl font-black">NPS Over Time</h3>
          </CardHeader>
          <CardContent>
            {dashboard.trend.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Not enough data for trend.
              </p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.trend}>
                    <Tooltip />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      domain={[-100, 100]}
                    />
                    <Line
                      type="monotone"
                      dataKey="nps"
                      stroke="#0891b2"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="NPS"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Survey Bar Chart */}
        <Card>
          <CardHeader>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
              By Survey
            </p>
            <h3 className="text-2xl font-black">NPS per Survey</h3>
          </CardHeader>
          <CardContent>
            {dashboard.bySurvey.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No survey data available.
              </p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.bySurvey} layout="vertical">
                    <Tooltip />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      domain={[-100, 100]}
                    />
                    <YAxis
                      dataKey="surveyName"
                      type="category"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      width={120}
                    />
                    <Bar dataKey="nps" radius={[0, 4, 4, 0]}>
                      {dashboard.bySurvey.map((item, i) => (
                        <Cell
                          key={i}
                          fill={item.nps > 50 ? "#16a34a" : item.nps >= 0 ? "#f59e0b" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Pie Chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
              Distribution
            </p>
            <h3 className="text-2xl font-black">Promoter / Passive / Detractor Split</h3>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RePie>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) =>
                      `${name}: ${value}`
                    }
                  >
                    {pieData.map((item, i) => (
                      <Cell key={i} fill={item.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Responses */}
      <Card>
        <CardHeader>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            Responses
          </p>
          <h3 className="text-2xl font-black">Recent Responses</h3>
        </CardHeader>
        <CardContent>
          {dashboard.recentResponses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No responses recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-3 py-2 text-left font-black text-muted-foreground">Member</th>
                    <th className="px-3 py-2 text-center font-black text-muted-foreground">Score</th>
                    <th className="px-3 py-2 text-left font-black text-muted-foreground">Category</th>
                    <th className="px-3 py-2 text-left font-black text-muted-foreground">Feedback</th>
                    <th className="px-3 py-2 text-right font-black text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentResponses.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-surface-muted/50">
                      <td className="px-3 py-3 font-bold">{r.member_name || "Unknown"}</td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex size-7 items-center justify-center rounded-full text-xs font-black",
                            r.score >= 9
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : r.score >= 7
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                          )}
                        >
                          {r.score}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-bold capitalize",
                            r.nps_category === "promoter"
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : r.nps_category === "passive"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                          )}
                        >
                          {r.nps_category}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[200px] truncate">
                        {r.feedback || "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {new Date(r.responded_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Word Cloud (simple list) */}
      {dashboard.feedbackWordCloud.length > 0 && (
        <Card>
          <CardHeader>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
              Common Themes
            </p>
            <h3 className="text-2xl font-black">Feedback Word Cloud</h3>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dashboard.feedbackWordCloud.slice(0, 30).map(({ word, count }) => (
                <span
                  key={word}
                  className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 text-sm font-bold"
                  style={{
                    fontSize: `${Math.max(0.75, Math.min(1.5, 0.75 + count * 0.05))}rem`,
                  }}
                >
                  {word}
                  <span className="ml-1 text-xs text-muted-foreground">({count})</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
