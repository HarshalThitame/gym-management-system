"use client";

import { useCallback, useEffect, useState } from "react";
import { GripVertical, Settings, X } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { Building2, CreditCard, UsersRound, Activity, AlertTriangle } from "lucide-react";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";

type WidgetId = "total_gyms" | "total_members" | "revenue" | "attendance" | "staff" | "trainers" | "memberships" | "alerts" | "growth" | "notifications";

type Widget = { id: WidgetId; label: string; enabled: boolean; order: number };

const ALL_WIDGETS: Widget[] = [
  { id: "total_gyms", label: "Total Gyms", enabled: true, order: 0 },
  { id: "total_members", label: "Active Members", enabled: true, order: 1 },
  { id: "revenue", label: "Revenue", enabled: true, order: 2 },
  { id: "attendance", label: "Attendance", enabled: true, order: 3 },
  { id: "staff", label: "Staff Count", enabled: true, order: 4 },
  { id: "trainers", label: "Trainers", enabled: true, order: 5 },
  { id: "memberships", label: "Memberships", enabled: true, order: 6 },
  { id: "alerts", label: "Security Alerts", enabled: true, order: 7 },
  { id: "growth", label: "Growth", enabled: true, order: 8 },
  { id: "notifications", label: "Notifications", enabled: true, order: 9 },
];

const WIDGET_STORAGE_KEY = "org-owner-dashboard-widgets";

function loadWidgets(): Widget[] {
  try { return JSON.parse(localStorage.getItem(WIDGET_STORAGE_KEY) ?? "null") ?? ALL_WIDGETS; } catch { return ALL_WIDGETS; }
}

type CustomizableDashboardProps = {
  dashboard: OrganizationOwnerDashboard;
};

export function CustomizableDashboard({ dashboard }: CustomizableDashboardProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [editing, setEditing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => { setWidgets(loadWidgets()); }, []);

  const saveWidgets = useCallback((newWidgets: Widget[]) => {
    setWidgets(newWidgets);
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(newWidgets));
  }, []);

  const toggleWidget = useCallback((id: WidgetId) => {
    saveWidgets(widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  }, [widgets, saveWidgets]);

  const resetWidgets = useCallback(() => {
    saveWidgets(ALL_WIDGETS);
  }, [saveWidgets]);

  const handleDragStart = useCallback((index: number) => { setDragIndex(index); }, []);
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const fromIdx = dragIndex as number;
    const newWidgets = [...widgets];
    const moved = newWidgets[fromIdx];
    if (!moved) return;
    newWidgets.splice(fromIdx, 1);
    newWidgets.splice(index, 0, moved);
    setDragIndex(index);
    saveWidgets(newWidgets);
  }, [dragIndex, widgets, saveWidgets]);
  const handleDragEnd = useCallback(() => { setDragIndex(null); }, []);

  const visibleWidgets = widgets.filter((w) => w.enabled);
  const hiddenWidgets = widgets.filter((w) => !w.enabled);

  const kpis: Record<WidgetId, { value: string; detail: string; icon: React.ReactNode }> = {
    total_gyms: { value: String(dashboard.gyms.length), detail: "Gym records owned by this organization", icon: <Building2 className="size-5" /> },
    total_members: { value: formatCompactNumber(dashboard.metrics.activeMembers), detail: "Active member profiles", icon: <UsersRound className="size-5" /> },
    revenue: { value: formatCurrency(dashboard.metrics.totalRevenue), detail: "Total revenue from metrics", icon: <CreditCard className="size-5" /> },
    attendance: { value: formatCompactNumber(dashboard.metrics.totalAttendance), detail: "Attendance from metrics", icon: <Activity className="size-5" /> },
    staff: { value: formatCompactNumber(dashboard.branchUsers.length), detail: "Total staff assignments", icon: <UsersRound className="size-5" /> },
    trainers: { value: formatCompactNumber(dashboard.trainers.length), detail: "Trainer profiles", icon: <UsersRound className="size-5" /> },
    memberships: { value: formatCompactNumber(dashboard.memberships.filter((m) => m.status === "active").length), detail: "Active memberships", icon: <UsersRound className="size-5" /> },
    alerts: { value: formatCompactNumber(dashboard.metrics.openSecurityEvents), detail: "Open security events", icon: <AlertTriangle className="size-5" /> },
    growth: { value: `${dashboard.members.filter((m) => { const j = m.joined_at ? new Date(m.joined_at) : null; return j && j.getMonth() === new Date().getMonth() && j.getFullYear() === new Date().getFullYear(); }).length} this month`, detail: "New members this month", icon: <Activity className="size-5" /> },
    notifications: { value: formatCompactNumber(dashboard.notifications.length), detail: "Total notifications", icon: <Activity className="size-5" /> },
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-bold text-muted-foreground">{visibleWidgets.length} of {widgets.length} widgets visible</p>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-border-strong" onClick={() => setEditing(!editing)} type="button">
            <Settings className="size-3.5" /> {editing ? "Done" : "Customize"}
          </button>
          {editing ? (
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-border-strong" onClick={resetWidgets} type="button">Reset</button>
          ) : null}
        </div>
      </div>

      {/* Widget grid */}
      <div className={`grid gap-4 ${editing ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        {visibleWidgets.sort((a, b) => a.order - b.order).map((widget, i) => {
          const kpi = kpis[widget.id];
          if (!kpi) return null;
          return (
            <div
              key={widget.id}
              className={`relative rounded-lg border border-border bg-surface p-5 md:p-6 transition-all ${editing ? "cursor-grab border-dashed" : ""}`}
              draggable={editing}
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
            >
              {editing ? (
                <>
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <GripVertical className="size-4" />
                  </div>
                  <button className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => toggleWidget(widget.id)} type="button">
                    <X className="size-3.5" />
                  </button>
                </>
              ) : null}
              <StatCard detail={kpi.detail} icon={kpi.icon} label={widget.label} value={kpi.value} />
            </div>
          );
        })}
      </div>

      {/* Hidden widgets panel (shown during editing) */}
      {editing && hiddenWidgets.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-muted p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Hidden widgets</p>
          <div className="flex flex-wrap gap-2">
            {hiddenWidgets.map((w) => (
              <button key={w.id} className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:border-border-strong" onClick={() => toggleWidget(w.id)} type="button">
                + {w.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
