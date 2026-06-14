"use client";

import { useCallback, useState, useActionState } from "react";
import { CalendarDays, Plus, XCircle } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveClassSessionAction, cancelClassSessionAction } from "@/features/organization-owner/actions/class-actions";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { showToast } from "@/components/ui/toast";
import { StatCard } from "@/components/ui/stat-card";
import type { Database } from "@/types/database";

type ClassesEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };
type ClassSessionRow = Database["public"]["Tables"]["class_sessions"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ClassesEnterpriseModule({ dashboard, moduleData }: ClassesEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSessionRow | null>(null);
  const [state, formAction] = useActionState(saveClassSessionAction, initialAuthActionState);

  const sessions = (moduleData?.items ?? dashboard.classSessions) as ClassSessionRow[];
  const openCreate = useCallback(() => { setEditingSession(null); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingSession(null); }, []);
  const handleApply = useCallback((f: Record<string, string>) => { navigate({ q: f.q, status: f.status }); }, [navigate]);
  const handleCancel = useCallback(async (sessionId: string) => {
    const fd = new FormData(); fd.set("sessionId", sessionId);
    const r = await cancelClassSessionAction({ status: "idle", message: null } as never, fd);
    showToast(r.status === "success" ? "Session cancelled" : (r.message || "Failed to cancel"), r.status === "success" ? "success" : "error");
  }, []);

  const items = sessions.map((s) => ({
    id: s.id, title: `${s.session_date} · ${s.starts_at?.slice(0, 5) ?? ""}-${s.ends_at?.slice(0, 5) ?? ""}`,
    subtitle: `Booked: ${s.booked_count}/${s.capacity}`, meta: `${s.location ?? "No location"}`,
    badge: s.status, badgeVariant: (s.status === "scheduled" ? "success" : s.status === "cancelled" ? "error" : "neutral") as "success" | "error" | "neutral",
    sections: [
      { label: "Date", value: s.session_date }, { label: "Time", value: `${s.starts_at?.slice(0, 5) ?? ""} - ${s.ends_at?.slice(0, 5) ?? ""}` },
      { label: "Booked", value: `${s.booked_count}/${s.capacity}` }, { label: "Waitlist", value: String(s.waitlist_count ?? 0) }
    ],
    actions: s.status === "scheduled" ? [{ label: "Cancel", onClick: () => handleCancel(s.id), variant: "destructive" as const, icon: <XCircle className="size-3.5" /> }] : []
  }));

  const totalItems = moduleData?.items?.length ?? dashboard.classSessions.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Class sessions" icon={<CalendarDays className="size-5" />} label="Total" value={String(sessions.length)} />
        <StatCard detail="Scheduled" icon={<CalendarDays className="size-5" />} label="Scheduled" value={String(sessions.filter((s) => s.status === "scheduled").length)} />
        <StatCard detail="Booked seats" icon={<CalendarDays className="size-5" />} label="Booked" value={String(sessions.reduce((t, s) => t + Number(s.booked_count ?? 0), 0))} />
        <StatCard detail="Waitlisted" icon={<CalendarDays className="size-5" />} label="Waitlist" value={String(sessions.reduce((t, s) => t + Number(s.waitlist_count ?? 0), 0))} />
      </section>
      <FilterBar filterGroups={[{ key: "status", label: "Status", options: [{ value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }] }]} searchPlaceholder="Search sessions..." onApply={handleApply} activeFilters={filters as unknown as unknown as Record<string, string>} />
      <DataList headerAction={<Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Schedule</Button>} headerTitle="Sessions" items={items} totalItems={totalItems} totalPages={Math.ceil(totalItems / (filters.pageSize ?? 12))} currentPage={currentPage} onPageChange={(p) => navigate({ page: p })} pageSize={filters.pageSize ?? 12} />
      <OrgOwnerDrawer description="Schedule a new class session" onClose={closeDrawer} open={drawerOpen} title="Schedule Class" size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required><select className={selectClass} defaultValue="" name="gymId" required><option value="">Select gym</option>{dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></DrawerField>
            <DrawerField label="Class ID" required><input className={selectClass} name="classId" required type="text" /></DrawerField>
            <DrawerField label="Date" required><input className={selectClass} name="sessionDate" required type="date" /></DrawerField>
            <DrawerField label="Start"><input className={selectClass} name="startsAt" type="time" /></DrawerField>
            <DrawerField label="End"><input className={selectClass} name="endsAt" type="time" /></DrawerField>
            <DrawerField label="Capacity"><input className={selectClass} defaultValue={30} min={1} name="capacity" type="number" /></DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Schedule</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
