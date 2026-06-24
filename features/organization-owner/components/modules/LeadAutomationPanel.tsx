"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Zap, Play, Plus, Trash2, X, Loader2, ToggleLeft, ToggleRight,
  CheckCircle2, AlertTriangle, Pencil, History,
} from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { showToast } from "@/components/ui/toast";
import {
  getAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  runAutomationRules,
  type AutomationRuleRow,
} from "@/features/organization-owner/actions/lead-actions";

type Props = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

const TRIGGER_LABELS: Record<string, string> = {
  inactive_days: "Inactive for X days",
  status_stale: "Status unchanged for X hours",
  new_lead: "New lead (within X hours)",
};

const ACTION_LABELS: Record<string, string> = {
  send_email: "Send Email",
  send_sms: "Send SMS",
  send_whatsapp: "Send WhatsApp",
  create_task: "Create Task",
  change_status: "Change Status",
};

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "trial_scheduled", label: "Trial Scheduled" },
  { value: "trial_attended", label: "Trial Attended" },
  { value: "negotiation", label: "Negotiation" },
  { value: "lost", label: "Lost" },
];

type RunLogEntry = {
  timestamp: string;
  triggered: number;
  errors: string[];
};

const initialFormData = {
  name: "",
  triggerType: "inactive_days" as string,
  triggerValue: 7,
  actionType: "send_email" as string,
  emailSubject: "",
  emailTemplate: "Hi {{name}}, we noticed you haven't been in touch. Would you like to schedule a visit?",
  smsMessage: "Hi {{name}}, we miss you at the gym! Come back for a free session.",
  whatsappMessage: "Hi {{name}}, we miss you at the gym! Come back for a free session.",
  taskTitle: "Follow up with {{name}}",
  taskDueInDays: 2,
  targetStatus: "contacted" as string,
};

export function LeadAutomationPanel({ dashboard, hasFeature }: Props) {
  const [rules, setRules] = useState<AutomationRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRuleRow | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ triggered: number; errors: string[] } | null>(null);
  const [runLog, setRunLog] = useState<RunLogEntry[]>([]);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [submitting, setSubmitting] = useState(false);

  const orgId = dashboard.organization.id;

  const fetchRules = useCallback(async () => {
    if (!hasFeature) return;
    setLoading(true);
    try {
      const data = await getAutomationRules(orgId);
      setRules(data);
    } catch {
      showToast("Failed to load automation rules", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, hasFeature]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const buildConfig = useCallback(() => {
    const config: Record<string, unknown> = {};
    if (formData.actionType === "send_email") {
      config.subject = formData.emailSubject;
      config.template = formData.emailTemplate;
    } else if (formData.actionType === "send_sms") {
      config.template = formData.smsMessage;
    } else if (formData.actionType === "send_whatsapp") {
      config.template = formData.whatsappMessage;
    } else if (formData.actionType === "create_task") {
      config.title = formData.taskTitle;
      config.due_in_days = formData.taskDueInDays;
    } else if (formData.actionType === "change_status") {
      config.target_status = formData.targetStatus;
    }
    return config;
  }, [formData]);

  const loadConfig = useCallback((rule: AutomationRuleRow) => {
    const c = rule.action_config as Record<string, unknown>;
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      triggerType: rule.trigger_type,
      triggerValue: rule.trigger_value,
      actionType: rule.action_type,
      emailSubject: (c.subject as string) ?? "",
      emailTemplate: (c.template as string) ?? initialFormData.emailTemplate,
      smsMessage: (c.template as string) ?? initialFormData.smsMessage,
      whatsappMessage: (c.template as string) ?? initialFormData.whatsappMessage,
      taskTitle: (c.title as string) ?? initialFormData.taskTitle,
      taskDueInDays: (c.due_in_days as number) ?? 2,
      targetStatus: (c.target_status as string) ?? "contacted",
    });
    setShowForm(true);
  }, []);

  const openCreateForm = useCallback(() => {
    setEditingRule(null);
    setFormData({ ...initialFormData });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name) {
      showToast("Rule name is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const config = buildConfig();
      if (editingRule) {
        await updateAutomationRule(orgId, editingRule.id, {
          name: formData.name,
          triggerType: formData.triggerType,
          triggerValue: formData.triggerValue,
          actionType: formData.actionType,
          actionConfig: config,
        });
        showToast("Rule updated", "success");
      } else {
        await createAutomationRule(orgId, {
          name: formData.name,
          triggerType: formData.triggerType,
          triggerValue: formData.triggerValue,
          actionType: formData.actionType,
          actionConfig: config,
        });
        showToast("Rule created", "success");
      }
      setShowForm(false);
      setEditingRule(null);
      setFormData({ ...initialFormData });
      fetchRules();
    } catch {
      showToast(editingRule ? "Failed to update rule" : "Failed to create rule", "error");
    } finally {
      setSubmitting(false);
    }
  }, [orgId, formData, editingRule, buildConfig, fetchRules]);

  const handleToggle = useCallback(async (rule: AutomationRuleRow) => {
    try {
      await updateAutomationRule(orgId, rule.id, { isActive: !rule.is_active });
      fetchRules();
    } catch {
      showToast("Failed to update rule", "error");
    }
  }, [orgId, fetchRules]);

  const handleDelete = useCallback(async (ruleId: string) => {
    try {
      await deleteAutomationRule(orgId, ruleId);
      fetchRules();
      showToast("Rule deleted", "success");
    } catch {
      showToast("Failed to delete rule", "error");
    }
  }, [orgId, fetchRules]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await runAutomationRules(orgId);
      setRunResult(result);
      setRunLog((prev) => [{ timestamp: new Date().toISOString(), triggered: result.triggered, errors: result.errors }, ...prev].slice(0, 20));
      if (result.triggered > 0) {
        showToast(`${result.triggered} actions triggered`, result.errors.length > 0 ? "error" : "success");
      } else {
        showToast("No leads matched any rules", "info");
      }
    } catch {
      showToast("Failed to run automation", "error");
    } finally {
      setRunning(false);
    }
  }, [orgId]);

  if (!hasFeature) {
    return (
      <EmptyState
        type="no_data"
        title="Automation Rules"
        description="Upgrade to the Enterprise plan to access re-engagement automation."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={handleRun} disabled={running} size="sm" variant="primary">
            {running ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Play className="size-3.5 mr-1.5" />}
            {running ? "Running..." : "Run Automation Now"}
          </Button>
          {runResult ? (
            <span className="text-xs text-muted-foreground">
              {runResult.triggered > 0 ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="size-3" />
                  {runResult.triggered} triggered
                </span>
              ) : "No leads matched"}
              {runResult.errors.length > 0 ? (
                <span className="inline-flex items-center gap-1 ml-2 text-red-600">
                  <AlertTriangle className="size-3" />
                  {runResult.errors.length} errors
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        <Button onClick={openCreateForm} size="sm" variant="secondary">
          <Plus className="size-3.5 mr-1.5" />
          Add Rule
        </Button>
      </div>

      {runResult?.errors?.length ? (
        <Card className="border-red-200">
          <CardContent className="p-3 text-xs text-red-700 space-y-1">
            {runResult.errors.map((err, i) => (
              <p key={i} className="flex items-center gap-1"><AlertTriangle className="size-3 shrink-0" />{err}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">{editingRule ? "Edit Rule" : "New Automation Rule"}</h3>
              <button onClick={() => { setShowForm(false); setEditingRule(null); }} className="text-muted-foreground hover:text-foreground" type="button">
                <X className="size-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Rule Name</label>
              <input
                className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Inactive lead follow-up"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Trigger Type</label>
                <select
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.triggerType}
                  onChange={(e) => setFormData((f) => ({ ...f, triggerType: e.target.value }))}
                >
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  {formData.triggerType === "status_stale" || formData.triggerType === "new_lead" ? "Hours" : "Days"}
                </label>
                <input
                  type="number"
                  min={1}
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.triggerValue}
                  onChange={(e) => setFormData((f) => ({ ...f, triggerValue: Number(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Action Type</label>
              <select
                className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.actionType}
                onChange={(e) => setFormData((f) => ({ ...f, actionType: e.target.value }))}
              >
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {formData.actionType === "send_email" ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Email Subject</label>
                  <input
                    className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.emailSubject}
                    onChange={(e) => setFormData((f) => ({ ...f, emailSubject: e.target.value }))}
                    placeholder="Follow-up from our gym"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Email Body (use {"{{name}}"} for lead name)</label>
                  <textarea
                    className="h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                    value={formData.emailTemplate}
                    onChange={(e) => setFormData((f) => ({ ...f, emailTemplate: e.target.value }))}
                  />
                </div>
              </>
            ) : null}
            {formData.actionType === "send_sms" ? (
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">SMS Message (use {"{{name}}"} for lead name)</label>
                <textarea
                  className="h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                  value={formData.smsMessage}
                  onChange={(e) => setFormData((f) => ({ ...f, smsMessage: e.target.value }))}
                />
              </div>
            ) : null}
            {formData.actionType === "send_whatsapp" ? (
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">WhatsApp Message (use {"{{name}}"} for lead name)</label>
                <textarea
                  className="h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                  value={formData.whatsappMessage}
                  onChange={(e) => setFormData((f) => ({ ...f, whatsappMessage: e.target.value }))}
                />
              </div>
            ) : null}
            {formData.actionType === "create_task" ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Task Title (use {"{{name}}"} for lead name)</label>
                  <input
                    className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.taskTitle}
                    onChange={(e) => setFormData((f) => ({ ...f, taskTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Due in (days)</label>
                  <input
                    type="number"
                    min={1}
                    className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.taskDueInDays}
                    onChange={(e) => setFormData((f) => ({ ...f, taskDueInDays: Number(e.target.value) || 1 }))}
                  />
                </div>
              </>
            ) : null}
            {formData.actionType === "change_status" ? (
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">Target Status</label>
                <select
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.targetStatus}
                  onChange={(e) => setFormData((f) => ({ ...f, targetStatus: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button onClick={handleSave} disabled={submitting} variant="primary" size="sm">
              {submitting ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && rules.length === 0 ? (
        <EmptyState
          type="no_data"
          title="No automation rules"
          description="Create rules to automatically re-engage inactive leads."
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const config = rule.action_config as Record<string, unknown>;
            let actionDetail = ACTION_LABELS[rule.action_type] ?? rule.action_type;
            if (rule.action_type === "send_email") actionDetail = `Email: ${config.subject ?? ""}`;
            else if (rule.action_type === "send_sms") actionDetail = "SMS message";
            else if (rule.action_type === "send_whatsapp") actionDetail = "WhatsApp message";
            else if (rule.action_type === "change_status") actionDetail = `Status → ${config.target_status ?? ""}`;
            else if (rule.action_type === "create_task") actionDetail = `Task: ${config.title ?? ""}`;
            return (
              <Card key={rule.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <button
                    className="shrink-0 text-muted-foreground hover:text-foreground transition"
                    onClick={() => handleToggle(rule)}
                    type="button"
                  >
                    {rule.is_active ? (
                      <ToggleRight className="size-5 text-green-500" />
                    ) : (
                      <ToggleLeft className="size-5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{rule.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="size-2.5" />
                        {TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}: {rule.trigger_value}
                      </span>
                      <span className={rule.is_active ? "text-green-600" : "text-muted-foreground"}>
                        {actionDetail}
                      </span>
                    </div>
                    {rule.last_triggered_at ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Last run: {new Date(rule.last_triggered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
                    onClick={() => loadConfig(rule)}
                    type="button"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 transition"
                    onClick={() => handleDelete(rule.id)}
                    type="button"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {runLog.length > 0 ? (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-black flex items-center gap-2">
              <History className="size-4" />
              Execution Log
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {runLog.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 text-xs p-2 rounded bg-surface-muted">
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-green-500" />
                    {entry.triggered} triggered
                  </span>
                  {entry.errors.length > 0 ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="size-3" />
                      {entry.errors.length} errors
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
