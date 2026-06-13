"use client";

import { useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Play, Save, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from "lucide-react";

type Condition = {
  id: string;
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "in" | "contains";
  value: string;
};

type Action = {
  id: string;
  type: string;
  params: Record<string, string>;
};

type Rule = {
  id: string;
  name: string;
  description: string;
  triggerEvent: string;
  conditions: { mode: "all" | "any"; rules: Condition[] };
  actions: Action[];
  priority: number;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
};

const TRIGGER_EVENTS = [
  { value: "ticket_created", label: "Ticket Created" },
  { value: "ticket_updated", label: "Ticket Updated" },
  { value: "ticket_assigned", label: "Ticket Assigned" },
  { value: "ticket_status_changed", label: "Status Changed" },
  { value: "ticket_priority_changed", label: "Priority Changed" },
  { value: "customer_replied", label: "Customer Replied" },
  { value: "sla_warning", label: "SLA Warning" },
  { value: "sla_breach", label: "SLA Breach" },
  { value: "ticket_inactive", label: "Ticket Inactive" },
  { value: "escalation_triggered", label: "Escalation Triggered" },
  { value: "feedback_received", label: "Feedback Received" },
];

const CONDITION_FIELDS = [
  { value: "category_name", label: "Category", type: "text" },
  { value: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "critical", "emergency"] },
  { value: "status", label: "Status", type: "select", options: ["open", "in_review", "in_progress", "waiting_on_customer", "waiting_on_third_party", "resolved", "closed"] },
  { value: "source", label: "Source", type: "select", options: ["manual", "email", "chat", "whatsapp", "mobile_app", "api", "automation", "phone"] },
  { value: "customer_type", label: "Customer Type", type: "select", options: ["member", "trainer", "staff", "owner", "lead", "other"] },
  { value: "age_hours", label: "Age (hours)", type: "number" },
  { value: "reopened_count", label: "Reopened Count", type: "number" },
  { value: "sla_breached", label: "SLA Breached", type: "boolean" },
  { value: "escalation_level", label: "Escalation Level", type: "number" },
];

const ACTION_TYPES = [
  { value: "assign_to", label: "Assign To Agent", params: [{ key: "userId", label: "Agent ID" }] },
  { value: "set_priority", label: "Set Priority", params: [{ key: "priority", label: "Priority" }] },
  { value: "set_status", label: "Set Status", params: [{ key: "status", label: "Status" }] },
  { value: "escalate_to", label: "Escalate To Level", params: [{ key: "userId", label: "Agent ID" }, { key: "reason", label: "Reason" }] },
  { value: "add_note", label: "Add Internal Note", params: [{ key: "body", label: "Note Body" }] },
  { value: "close_ticket", label: "Close Ticket", params: [{ key: "reason", label: "Closing Reason" }] },
  { value: "send_notification", label: "Send Notification", params: [{ key: "channel", label: "Channel" }, { key: "message", label: "Message" }] },
];

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "in", label: "In List" },
  { value: "contains", label: "Contains" },
];

function genId() { return Math.random().toString(36).slice(2, 10); }

function newCondition(): Condition {
  return { id: genId(), field: "priority", operator: "equals", value: "high" };
}

function newAction(): Action {
  return { id: genId(), type: "assign_to", params: { userId: "" } };
}

function newRule(): Rule {
  return {
    id: "", name: "", description: "", triggerEvent: "ticket_created",
    conditions: { mode: "all", rules: [newCondition()] },
    actions: [newAction()], priority: 10, isActive: true,
    executionCount: 0, lastExecutedAt: null,
  };
}

function ConditionRow({
  condition, fields, onChange, onRemove,
}: {
  condition: Condition;
  fields: typeof CONDITION_FIELDS;
  onChange: (c: Condition) => void;
  onRemove: () => void;
}) {
  const fieldMeta = fields.find((f) => f.value === condition.field);

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value, value: "" })}
        className="h-8 rounded-md border border-border bg-background text-xs px-2 min-w-[140px]"
      >
        {fields.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as Condition["operator"] })}
        className="h-8 rounded-md border border-border bg-background text-xs px-2 min-w-[120px]"
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      {fieldMeta?.type === "boolean" ? (
        <select
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="h-8 rounded-md border border-border bg-background text-xs px-2 min-w-[100px]"
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      ) : fieldMeta?.type === "select" ? (
        <select
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          className="h-8 rounded-md border border-border bg-background text-xs px-2 min-w-[130px]"
        >
          {(fieldMeta.options as string[])?.map((opt) => (
            <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
          ))}
        </select>
      ) : (
        <input
          type={fieldMeta?.type === "number" ? "number" : "text"}
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Value"
          className="h-8 rounded-md border border-border bg-background text-xs px-2 min-w-[130px]"
        />
      )}
      <button onClick={onRemove} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ActionRow({
  action, onChange, onRemove,
}: {
  action: Action;
  onChange: (a: Action) => void;
  onRemove: () => void;
}) {
  const actionMeta = ACTION_TYPES.find((at) => at.value === action.type);

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
      <select
        value={action.type}
        onChange={(e) => {
          const meta = ACTION_TYPES.find((at) => at.value === e.target.value);
          const params: Record<string, string> = {};
          meta?.params.forEach((p) => { params[p.key] = ""; });
          onChange({ ...action, type: e.target.value, params });
        }}
        className="h-8 rounded-md border border-border bg-background text-xs px-2 min-w-[160px]"
      >
        {ACTION_TYPES.map((at) => (
          <option key={at.value} value={at.value}>{at.label}</option>
        ))}
      </select>
      {actionMeta?.params.map((param) => (
        <input
          key={param.key}
          type="text"
          value={action.params[param.key] ?? ""}
          onChange={(e) => onChange({ ...action, params: { ...action.params, [param.key]: e.target.value } })}
          placeholder={param.label}
          className="h-8 rounded-md border border-border bg-background text-xs px-2 min-w-[120px]"
        />
      ))}
      <button onClick={onRemove} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function RuleCard({
  rule,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  rule: Rule;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (r: Rule) => void;
  onDelete: () => void;
}) {
  const triggerLabel = TRIGGER_EVENTS.find((t) => t.value === rule.triggerEvent)?.label ?? rule.triggerEvent;
  const conditionCount = rule.conditions.rules.length;
  const actionCount = rule.actions.length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs font-mono text-muted-foreground w-6 text-right">#{index}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{rule.name || "Untitled Rule"}</p>
              {rule.executionCount > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{rule.executionCount}x</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              On <span className="font-medium text-foreground">{triggerLabel}</span>
              {" · "}{conditionCount} condition{conditionCount !== 1 ? "s" : ""}
              {" · "}{actionCount} action{actionCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate({ ...rule, isActive: !rule.isActive }); }}
            className={`p-1 rounded transition-colors ${rule.isActive ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}`}
            title={rule.isActive ? "Active" : "Inactive"}
          >
            {rule.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border px-4 py-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Rule Name</label>
              <input
                type="text" value={rule.name}
                onChange={(e) => onUpdate({ ...rule, name: e.target.value })}
                placeholder="e.g. Auto-assign billing issues"
                className="w-full h-9 rounded-md border border-border bg-background text-sm px-3"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Trigger Event</label>
              <select
                value={rule.triggerEvent}
                onChange={(e) => onUpdate({ ...rule, triggerEvent: e.target.value })}
                className="w-full h-9 rounded-md border border-border bg-background text-sm px-3"
              >
                {TRIGGER_EVENTS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Description</label>
            <input
              type="text" value={rule.description}
              onChange={(e) => onUpdate({ ...rule, description: e.target.value })}
              placeholder="Optional description of what this rule does"
              className="w-full h-9 rounded-md border border-border bg-background text-sm px-3"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conditions</label>
              <div className="flex items-center gap-2">
                <select
                  value={rule.conditions.mode}
                  onChange={(e) => onUpdate({ ...rule, conditions: { ...rule.conditions, mode: e.target.value as "all" | "any" } })}
                  className="h-7 rounded-md border border-border bg-background text-[10px] px-2"
                >
                  <option value="all">Match ALL</option>
                  <option value="any">Match ANY</option>
                </select>
                <button
                  onClick={() => onUpdate({ ...rule, conditions: { ...rule.conditions, rules: [...rule.conditions.rules, newCondition()] } })}
                  className="h-7 px-2 rounded-md border border-border text-[10px] hover:bg-muted transition-colors flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Condition
                </button>
              </div>
            </div>
            <div className="bg-muted/30 rounded-md p-2 space-y-1">
              {rule.conditions.rules.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">No conditions — rule will apply to all matching trigger events.</p>
              ) : (
                rule.conditions.rules.map((cond) => (
                  <ConditionRow
                    key={cond.id}
                    condition={cond}
                    fields={CONDITION_FIELDS}
                    onChange={(updated) =>
                      onUpdate({
                        ...rule,
                        conditions: {
                          ...rule.conditions,
                          rules: rule.conditions.rules.map((c) => c.id === updated.id ? updated : c),
                        },
                      })
                    }
                    onRemove={() =>
                      onUpdate({
                        ...rule,
                        conditions: {
                          ...rule.conditions,
                          rules: rule.conditions.rules.filter((c) => c.id !== cond.id),
                        },
                      })
                    }
                  />
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</label>
              <button
                onClick={() => onUpdate({ ...rule, actions: [...rule.actions, newAction()] })}
                className="h-7 px-2 rounded-md border border-border text-[10px] hover:bg-muted transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Action
              </button>
            </div>
            <div className="bg-muted/30 rounded-md p-2 space-y-1">
              {rule.actions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">No actions defined — rule will match but perform no action.</p>
              ) : (
                rule.actions.map((act) => (
                  <ActionRow
                    key={act.id}
                    action={act}
                    onChange={(updated) =>
                      onUpdate({
                        ...rule,
                        actions: rule.actions.map((a) => a.id === updated.id ? updated : a),
                      })
                    }
                    onRemove={() =>
                      onUpdate({
                        ...rule,
                        actions: rule.actions.filter((a) => a.id !== act.id),
                      })
                    }
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Priority</label>
              <input
                type="number" value={rule.priority}
                onChange={(e) => onUpdate({ ...rule, priority: parseInt(e.target.value) || 0 })}
                className="w-16 h-7 rounded-md border border-border bg-background text-xs px-2 text-center"
                min={0} max={100}
              />
              <span className="text-[10px] text-muted-foreground">Lower = runs first</span>
            </div>
            {rule.lastExecutedAt && (
              <span className="text-[10px] text-muted-foreground">Last run: {new Date(rule.lastExecutedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SupportAutomationBuilder({
  rules: initialRules,
  onSave,
  onTest,
}: {
  rules: Rule[];
  onSave: (rules: Rule[]) => Promise<void>;
  onTest?: (ruleId: string) => Promise<void>;
}) {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddRule = useCallback(() => {
    const newR = newRule();
    newR.priority = rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) + 10 : 10;
    setRules([...rules, newR]);
    setExpandedId(newR.id);
  }, [rules]);

  const handleUpdateRule = useCallback((updated: Rule) => {
    setRules((prev) => prev.map((r) => r.id === updated.id ? updated : r));
  }, []);

  const handleDeleteRule = useCallback((ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    if (expandedId === ruleId) setExpandedId(null);
  }, [expandedId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(rules);
    } finally {
      setIsSaving(false);
    }
  }, [rules, onSave]);

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {rules.length} Rule{rules.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRule}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New Rule
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 px-3 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {sortedRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <div className="text-3xl mb-2">⚙️</div>
            <p className="text-sm font-medium text-muted-foreground">No automation rules yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first IF-THEN rule to automate ticket workflows.</p>
            <button
              onClick={handleAddRule}
              className="mt-3 h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Create First Rule
            </button>
          </div>
        ) : (
          sortedRules.map((rule, idx) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={idx + 1}
              isExpanded={expandedId === rule.id}
              onToggle={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
              onUpdate={handleUpdateRule}
              onDelete={() => handleDeleteRule(rule.id)}
            />
          ))
        )}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Tip:</span> Rules execute in priority order (lowest number first).
          Only the first matching rule&apos;s actions are executed per trigger event.
          Use &quot;Match ANY&quot; mode to trigger on any condition, &quot;Match ALL&quot; to require every condition.
        </p>
      </div>
    </div>
  );
}

export type { Rule, Condition, Action };
