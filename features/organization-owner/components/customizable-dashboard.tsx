"use client";

import { useCallback, useEffect, useState } from "react";
import { GripVertical, Save, Trash2, Settings, X } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { Building2, CreditCard, UsersRound, Activity, AlertTriangle, TrendingUp, Globe2 } from "lucide-react";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";
import {
  getDashboardLayouts,
  saveDashboardLayout,
  deleteDashboardLayout,
  getNewLeadsCount,
  getExpiringMembershipsCount,
  getClassOccupancyAvg,
  getCheckInsToday,
  type DashboardLayout,
  type DashboardWidget,
} from "@/features/organization-owner/actions/dashboard-actions";

type WidgetId = "total_gyms" | "total_members" | "revenue" | "attendance" | "staff" | "trainers" | "memberships" | "alerts" | "growth" | "notifications" | "new_leads" | "expiring_memberships" | "class_occupancy" | "revenue_per_member" | "check_ins_today" | "cross_branch" | "corporate" | "loyalty_balance";

type Widget = { id: WidgetId; label: string; enabled: boolean; order: number };

const ALL_WIDGETS: Widget[] = [
  { id: "total_gyms", label: "Total Locations", enabled: true, order: 0 },
  { id: "total_members", label: "Active Members", enabled: true, order: 1 },
  { id: "revenue", label: "Revenue", enabled: true, order: 2 },
  { id: "attendance", label: "Attendance", enabled: true, order: 3 },
  { id: "staff", label: "Staff Count", enabled: true, order: 4 },
  { id: "trainers", label: "Trainers", enabled: true, order: 5 },
  { id: "memberships", label: "Memberships", enabled: true, order: 6 },
  { id: "alerts", label: "Security Alerts", enabled: true, order: 7 },
  { id: "growth", label: "Growth", enabled: true, order: 8 },
  { id: "notifications", label: "Notifications", enabled: true, order: 9 },
  { id: "new_leads", label: "New Leads", enabled: false, order: 10 },
  { id: "expiring_memberships", label: "Expiring Soon", enabled: false, order: 11 },
  { id: "class_occupancy", label: "Class Occupancy", enabled: false, order: 12 },
  { id: "revenue_per_member", label: "Revenue/Member", enabled: false, order: 13 },
  { id: "check_ins_today", label: "Check-ins Today", enabled: false, order: 14 },
  { id: "cross_branch", label: "Cross-Branch", enabled: false, order: 15 },
  { id: "corporate", label: "Corporate", enabled: false, order: 16 },
  { id: "loyalty_balance", label: "Loyalty Balance", enabled: false, order: 17 },
];

const WIDGET_STORAGE_KEY = "org-owner-dashboard-widgets";

function loadWidgetsFromLocalStorage(): Widget[] {
  try { return JSON.parse(localStorage.getItem(WIDGET_STORAGE_KEY) ?? "null") ?? ALL_WIDGETS; } catch { return ALL_WIDGETS; }
}

function widgetsFromLayout(layout: DashboardLayout): Widget[] {
  const widgetMap = new Map(ALL_WIDGETS.map((w) => [w.id, w]));
  return (layout.widgets ?? []).map((dw: DashboardWidget) => ({
    ...widgetMap.get(dw.id as WidgetId),
    id: dw.id as WidgetId,
    label: dw.label ?? widgetMap.get(dw.id as WidgetId)?.label ?? dw.id,
    enabled: dw.enabled,
    order: dw.order,
  })).filter((w) => w.label);
}

type CustomizableDashboardProps = {
  dashboard: OrganizationOwnerDashboard;
};

export function CustomizableDashboard({ dashboard }: CustomizableDashboardProps) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [editing, setEditing] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [layouts, setLayouts] = useState<DashboardLayout[]>([]);
  const [, setLoadingLayouts] = useState(true);
  const [layoutName, setLayoutName] = useState("My Dashboard");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Dynamic KPI data
  const [newLeads, setNewLeads] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [classOcc, setClassOcc] = useState(0);
  const [checkInsToday, setCheckInsToday] = useState(0);

  // Load layouts from server on mount, fall back to localStorage
  useEffect(() => {
    let cancelled = false;
    setLoadingLayouts(true);
    getDashboardLayouts(dashboard.organization.id)
      .then(({ layouts: serverLayouts, defaultLayout: defaultL }) => {
        if (cancelled) return;
        setLayouts(serverLayouts);
        // Try default layout first, then first layout, then localStorage
        if (defaultL && defaultL.widgets.length) {
          setWidgets(widgetsFromLayout(defaultL));
        } else if (serverLayouts.length > 0 && serverLayouts[0]!.widgets.length) {
          setWidgets(widgetsFromLayout(serverLayouts[0]!));
        } else {
          setWidgets(loadWidgetsFromLocalStorage());
        }
      })
      .catch(() => {
        // Fall back to localStorage
        setWidgets(loadWidgetsFromLocalStorage());
      })
      .finally(() => { if (!cancelled) setLoadingLayouts(false); });

    return () => { cancelled = true; };
  }, [dashboard.organization.id]);

  // Fetch dynamic KPI data
  useEffect(() => {
    Promise.all([
      getNewLeadsCount(dashboard.organization.id).catch(() => 0),
      getExpiringMembershipsCount(dashboard.organization.id).catch(() => 0),
      getClassOccupancyAvg(dashboard.organization.id).catch(() => 0),
      getCheckInsToday(dashboard.organization.id).catch(() => 0),
    ]).then(([leads, expiring, occ, checkIns]) => {
      setNewLeads(leads);
      setExpiringCount(expiring);
      setClassOcc(occ);
      setCheckInsToday(checkIns);
    }).catch(() => {});
  }, [dashboard.organization.id]);

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

  // Server-side save
  const handleSaveToServer = useCallback(async (setAsDefault?: boolean) => {
    if (!layoutName.trim()) return;
    try {
      const saved = await saveDashboardLayout(dashboard.organization.id, {
        name: layoutName.trim(),
        widgets: widgets.map((w) => ({
          id: w.id,
          label: w.label,
          enabled: w.enabled,
          order: w.order,
        })),
        isDefault: setAsDefault ?? false,
      });
      setLayouts((prev) => {
        const idx = prev.findIndex((l) => l.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [saved, ...prev];
      });
      setShowSaveDialog(false);
    } catch {
      // Silently fail save
    }
  }, [layoutName, widgets, dashboard.organization.id]);

  const handleLoadLayout = useCallback((layout: DashboardLayout) => {
    if (layout.widgets?.length) {
      const loaded = widgetsFromLayout(layout);
      saveWidgets(loaded);
    }
  }, [saveWidgets]);

  const handleDeleteLayout = useCallback(async (layoutId: string) => {
    try {
      await deleteDashboardLayout(dashboard.organization.id, layoutId);
      setLayouts((prev) => prev.filter((l) => l.id !== layoutId));
    } catch {
      // ignore
    }
  }, [dashboard.organization.id]);

  const visibleWidgets = widgets.filter((w) => w.enabled);
  const hiddenWidgets = widgets.filter((w) => !w.enabled);

  const baseKpis: Record<WidgetId, { value: string; detail: string; icon: React.ReactNode }> = {
    total_gyms: { value: String(dashboard.gyms.length), detail: "Total locations owned by this organization", icon: <Building2 className="size-5" /> },
    total_members: { value: formatCompactNumber(dashboard.metrics.activeMembers), detail: "Active member profiles", icon: <UsersRound className="size-5" /> },
    revenue: { value: formatCurrency(dashboard.metrics.totalRevenue), detail: "Total revenue from metrics", icon: <CreditCard className="size-5" /> },
    attendance: { value: formatCompactNumber(dashboard.metrics.totalAttendance), detail: "Attendance from metrics", icon: <Activity className="size-5" /> },
    staff: { value: formatCompactNumber(dashboard.branchUsers.length), detail: "Total staff assignments", icon: <UsersRound className="size-5" /> },
    trainers: { value: formatCompactNumber(dashboard.trainers.length), detail: "Trainer profiles", icon: <UsersRound className="size-5" /> },
    memberships: { value: formatCompactNumber(dashboard.memberships.filter((m) => m.status === "active").length), detail: "Active memberships", icon: <UsersRound className="size-5" /> },
    alerts: { value: formatCompactNumber(dashboard.metrics.openSecurityEvents), detail: "Open security events", icon: <AlertTriangle className="size-5" /> },
    growth: { value: `${dashboard.members.filter((m) => { const j = m.joined_at ? new Date(m.joined_at) : null; return j && j.getMonth() === new Date().getMonth() && j.getFullYear() === new Date().getFullYear(); }).length} this month`, detail: "New members this month", icon: <Activity className="size-5" /> },
    notifications: { value: formatCompactNumber(dashboard.notifications.length), detail: "Total notifications", icon: <Activity className="size-5" /> },
    new_leads: { value: formatCompactNumber(newLeads), detail: "New leads captured this month", icon: <TrendingUp className="size-5" /> },
    expiring_memberships: { value: formatCompactNumber(expiringCount), detail: "Memberships expiring within 30 days", icon: <AlertTriangle className="size-5" /> },
    class_occupancy: { value: `${classOcc}%`, detail: "Average class fill rate", icon: <Activity className="size-5" /> },
    revenue_per_member: { value: formatCurrency(dashboard.metrics.activeMembers > 0 ? dashboard.metrics.totalRevenue / dashboard.metrics.activeMembers : 0), detail: "Revenue per active member", icon: <CreditCard className="size-5" /> },
    check_ins_today: { value: formatCompactNumber(checkInsToday), detail: "Check-ins recorded today", icon: <Activity className="size-5" /> },
    cross_branch: { value: "Coming soon", detail: "Cross-branch check-ins today", icon: <Globe2 className="size-5" /> },
    corporate: { value: "Coming soon", detail: "Corporate member accounts", icon: <Building2 className="size-5" /> },
    loyalty_balance: { value: "Coming soon", detail: "Total loyalty points outstanding", icon: <CreditCard className="size-5" /> },
  };

  const kpis = baseKpis;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-bold text-muted-foreground">{visibleWidgets.length} of {widgets.length} widgets visible</p>
        <div className="flex gap-2">
          {/* Layout selector */}
          {layouts.length > 0 ? (
            <select
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
              onChange={(e) => {
                const layout = layouts.find((l) => l.id === e.target.value);
                if (layout) handleLoadLayout(layout!);
              }}
              defaultValue=""
            >
              <option value="" disabled>Load Layout...</option>
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.is_default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          ) : null}
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-border-strong" onClick={() => setShowSaveDialog(!showSaveDialog)} type="button">
            <Save className="size-3.5" /> Save Layout
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-border-strong" onClick={() => setEditing(!editing)} type="button">
            <Settings className="size-3.5" /> {editing ? "Done" : "Customize"}
          </button>
          {editing ? (
            <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-border-strong" onClick={resetWidgets} type="button">Reset</button>
          ) : null}
        </div>
      </div>

      {/* Save Layout dialog */}
      {showSaveDialog ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-4">
          <input
            className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="Layout name"
          />
          <button className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90" onClick={() => handleSaveToServer(false)} type="button">
            <Save className="mr-1.5 inline size-3.5" /> Save
          </button>
          <button className="rounded-md border border-border bg-surface px-4 py-2 text-xs font-bold hover:border-border-strong" onClick={() => handleSaveToServer(true)} type="button">
            Set as Default
          </button>
          <button className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold hover:border-border-strong" onClick={() => setShowSaveDialog(false)} type="button">Cancel</button>
          {layouts.length > 0 ? (
            <div className="ml-auto flex items-center gap-1">
              {layouts.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background px-2 py-1 text-xs">
                  {l.name} {l.is_default ? "★" : ""}
                  <button onClick={() => handleDeleteLayout(l.id)} className="ml-1 text-muted-foreground hover:text-red-600" type="button">
                    <Trash2 className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

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
