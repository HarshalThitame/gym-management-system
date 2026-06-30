"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  UserRound,
  CalendarDays,
  Pencil,
  CheckCheck,
} from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { showToast } from "@/components/ui/toast";
import { GenericSuccessDialog } from "@/features/organization-owner/components/modules/GenericSuccessDialog";
import {
  getLeadTasks,
  getOverdueTasks,
  createLeadTask,
  completeLeadTask,
  updateLeadTask,
  deleteLeadTask,
  type LeadTaskRow,
} from "@/features/organization-owner/actions/lead-actions";
import { getOrgLeads } from "@/features/organization-owner/actions/lead-actions";

type Props = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
  onOpenLead?: (leadId: string) => void;
};

function defaultDueDate() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function LeadFollowUpPanel({ dashboard, hasFeature, onOpenLead }: Props) {
  const [tasks, setTasks] = useState<LeadTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<LeadTaskRow | null>(null);
  const [formData, setFormData] = useState({
    leadId: "",
    title: "",
    description: "",
    dueDate: defaultDueDate(),
    assignedTo: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [successAction, setSuccessAction] = useState<{ action: "created" | "updated" | "deleted"; title: string; itemName: string } | null>(null);

  const orgId = dashboard.organization.id;
  const staffList = dashboard.branchUsers.filter(
    (u) => u.role_name !== "member"
  );
  const staffNameMap = new Map(
    staffList.map((s) => [s.user_id, `${s.role_name} (${s.user_id.slice(0, 8)}...)`])
  );

  const fetchTasks = useCallback(async () => {
    if (!hasFeature) return;
    setLoading(true);
    try {
      const [allTasks, overDue] = await Promise.all([
        getLeadTasks(orgId),
        getOverdueTasks(orgId),
      ]);
      const overdueIds = new Set(overDue.map((t) => t.id));
      const merged = allTasks.map((t) => ({
        ...t,
        _isOverdue: overdueIds.has(t.id),
      }));
      setTasks(merged);
    } catch {
      showToast("Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, hasFeature]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!showForm) return;
    const fetchLeads = async () => {
      try {
        const result = await getOrgLeads(orgId, {
          q: undefined,
          status: undefined,
          source: undefined,
          page: 1,
          pageSize: 200,
        });
        setLeads(result.leads.map((l) => ({ id: l.id, name: l.name })));
      } catch { /* ignore */ }
    };
    fetchLeads();
  }, [orgId, showForm]);

  const openCreateForm = useCallback(() => {
    setEditingTask(null);
    setFormData({
      leadId: "",
      title: "",
      description: "",
      dueDate: defaultDueDate(),
      assignedTo: "",
    });
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((task: LeadTaskRow) => {
    setEditingTask(task);
    setFormData({
      leadId: task.lead_id,
      title: task.title,
      description: task.description ?? "",
      dueDate: task.due_date.slice(0, 16),
      assignedTo: task.assigned_to ?? "",
    });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.leadId || !formData.title || !formData.dueDate) {
      showToast("Lead, title, and due date are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      if (editingTask) {
        const updateData: Record<string, unknown> = {
          title: formData.title,
          dueDate: new Date(formData.dueDate).toISOString(),
          assignedTo: formData.assignedTo || null,
        };
        if (formData.description) updateData.description = formData.description;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateLeadTask(orgId, editingTask.id, updateData as any);
        setSuccessAction({ action: "updated", title: "Task Updated!", itemName: formData.title });
      } else {
        const payload: Record<string, unknown> = {
          leadId: formData.leadId,
          title: formData.title,
          dueDate: new Date(formData.dueDate).toISOString(),
        };
        if (formData.description) payload.description = formData.description;
        if (formData.assignedTo) payload.assignedTo = formData.assignedTo;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await createLeadTask(orgId, payload as any);
        setSuccessAction({ action: "created", title: "Task Created!", itemName: formData.title });
      }
      setShowForm(false);
      setEditingTask(null);
      setFormData({ leadId: "", title: "", description: "", dueDate: defaultDueDate(), assignedTo: "" });
      fetchTasks();
    } catch {
      showToast(editingTask ? "Failed to update task" : "Failed to create task", "error");
    } finally {
      setSubmitting(false);
    }
  }, [orgId, formData, editingTask, fetchTasks, setSuccessAction]);

  const handleComplete = useCallback(async (taskId: string) => {
    try {
      await completeLeadTask(orgId, taskId);
      fetchTasks();
    } catch {
      showToast("Failed to complete task", "error");
    }
  }, [orgId, fetchTasks]);

  const handleCompleteAll = useCallback(async () => {
    const uncompleted = tasks.filter((t) => !t.completed_at);
    if (uncompleted.length === 0) {
      showToast("No tasks to complete", "info");
      return;
    }
    try {
      await Promise.all(uncompleted.map((t) => completeLeadTask(orgId, t.id)));
      showToast(`${uncompleted.length} tasks completed`, "success");
      fetchTasks();
    } catch {
      showToast("Failed to complete some tasks", "error");
    }
  }, [orgId, tasks, fetchTasks]);

  const handleDelete = useCallback(async (taskId: string) => {
    try {
      const taskName = tasks.find((t) => t.id === taskId)?.title ?? "Task";
      await deleteLeadTask(orgId, taskId);
      setSuccessAction({ action: "deleted", title: "Task Deleted!", itemName: taskName });
      fetchTasks();
    } catch {
      showToast("Failed to delete task", "error");
    }
  }, [orgId, fetchTasks, tasks, setSuccessAction]);

  if (!hasFeature) {
    return (
      <EmptyState
        type="no_data"
        title="Follow-up Tasks"
        description="Upgrade to the Growth or Enterprise plan to access follow-up reminders."
      />
    );
  }

  const overdue = tasks.filter((t) => !t.completed_at && new Date(t.due_date) < new Date());
  const upcoming = tasks.filter((t) => !t.completed_at && new Date(t.due_date) >= new Date());
  const completed = tasks.filter((t) => t.completed_at);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const dueToday = tasks.filter((t) => !t.completed_at && new Date(t.due_date) >= todayStart && new Date(t.due_date) <= todayEnd);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {overdue.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
              <AlertTriangle className="size-3" />
              {overdue.length} Overdue
            </span>
          ) : null}
          {dueToday.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
              <Clock className="size-3" />
              {dueToday.length} Due Today
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {overdue.length + upcoming.length > 0 ? (
            <Button onClick={handleCompleteAll} size="sm" variant="secondary">
              <CheckCheck className="size-3.5 mr-1.5" />
              Complete All
            </Button>
          ) : null}
          <Button onClick={openCreateForm} size="sm" variant="primary">
            <Plus className="size-3.5 mr-1.5" />
            Add Task
          </Button>
        </div>
      </div>

      {showForm ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">{editingTask ? "Edit Follow-up Task" : "New Follow-up Task"}</h3>
              <button onClick={() => { setShowForm(false); setEditingTask(null); }} className="text-muted-foreground hover:text-foreground" type="button">
                <X className="size-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Lead</label>
              <select
                className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.leadId}
                onChange={(e) => setFormData((f) => ({ ...f, leadId: e.target.value }))}
                disabled={!!editingTask}
              >
                <option value="">Select lead</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Title</label>
              <input
                className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.title}
                onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Follow-up call"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Description</label>
              <textarea
                className="h-20 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional details..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Due Date</label>
              <input
                type="datetime-local"
                className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.dueDate}
                onChange={(e) => setFormData((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">Assign to Staff</label>
              <select
                className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.assignedTo}
                onChange={(e) => setFormData((f) => ({ ...f, assignedTo: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {staffList.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {staffNameMap.get(s.user_id) ?? s.user_id}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSave} disabled={submitting} variant="primary" size="sm">
              {submitting ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && tasks.length === 0 ? (
        <EmptyState
          type="no_data"
          title="No follow-up tasks"
          description="Create tasks to remind yourself to follow up with leads."
        />
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 ? (
            <div>
              <h3 className="text-sm font-black text-red-600 mb-2 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                Overdue ({overdue.length})
              </h3>
              <div className="space-y-2">
                {overdue.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onEdit={openEditForm}
                    onOpenLead={onOpenLead}
                    staffNameMap={staffNameMap}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {upcoming.length > 0 ? (
            <div>
              <h3 className="text-sm font-black text-muted-foreground mb-2 flex items-center gap-2">
                <CalendarDays className="size-4" />
                Upcoming ({upcoming.length})
              </h3>
              <div className="space-y-2">
                {upcoming.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onEdit={openEditForm}
                    onOpenLead={onOpenLead}
                    staffNameMap={staffNameMap}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {completed.length > 0 ? (
            <div>
              <h3 className="text-sm font-black text-green-600 mb-2 flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                Completed ({completed.length})
              </h3>
              <div className="space-y-2 opacity-60">
                {completed.slice(0, 10).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onEdit={openEditForm}
                    onOpenLead={onOpenLead}
                    staffNameMap={staffNameMap}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
      <GenericSuccessDialog
        action={successAction?.action ?? "created"}
        itemName={successAction?.itemName ?? ""}
        onClose={() => setSuccessAction(null)}
        open={successAction !== null}
        title={successAction?.title ?? ""}
      />
    </div>
  );
}

function TaskCard({
  task,
  onComplete,
  onDelete,
  onEdit,
  onOpenLead,
  staffNameMap,
}: {
  task: LeadTaskRow;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (t: LeadTaskRow) => void;
  onOpenLead?: ((leadId: string) => void) | undefined;
  staffNameMap: Map<string, string>;
}) {
  const isPast = new Date(task.due_date) < new Date();
  const assigneeLabel = task.assigned_to ? (staffNameMap.get(task.assigned_to) ?? task.assigned_to) : null;

  return (
    <Card className={isPast && !task.completed_at ? "border-red-200" : ""}>
      <CardContent className="flex items-center gap-3 p-3">
        <button
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition ${task.completed_at ? "border-green-500 bg-green-500 text-white" : isPast ? "border-red-400" : "border-border hover:border-green-400"}`}
          onClick={() => onComplete(task.id)}
          type="button"
          disabled={!!task.completed_at}
        >
          {task.completed_at ? <CheckCircle2 className="size-3.5" /> : null}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${task.completed_at ? "line-through text-muted-foreground" : ""}`}>
            {task.title}
          </p>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {task.leadName ? (
              <button
                className="flex items-center gap-1 hover:text-primary hover:underline"
                onClick={() => onOpenLead?.(task.lead_id)}
                type="button"
              >
                <UserRound className="size-2.5" />
                {task.leadName}
              </button>
            ) : null}
            <span className={`flex items-center gap-1 ${isPast && !task.completed_at ? "text-red-600 font-semibold" : ""}`}>
              <CalendarClock className="size-2.5" />
              {new Date(task.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            {assigneeLabel ? (
              <span className="font-medium">{assigneeLabel}</span>
            ) : null}
          </div>
        </div>
        <button
          className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
          onClick={() => onEdit(task)}
          type="button"
          disabled={!!task.completed_at}
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 transition"
          onClick={() => onDelete(task.id)}
          type="button"
        >
          <Trash2 className="size-3.5" />
        </button>
      </CardContent>
    </Card>
  );
}
