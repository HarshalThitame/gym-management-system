"use client";

import { Activity, CreditCard, Dumbbell, MapPin, UserRound, UsersRound, X } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { GymRow } from "@/types/enterprise";
import { formatCompactNumber, formatCurrency } from "@/features/enterprise/lib/business-rules";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";

type GymDetailPanelProps = {
  gym: GymRow;
  dashboard: OrganizationOwnerDashboard;
  onClose: () => void;
};

export function GymDetailPanel({ gym, dashboard, onClose }: GymDetailPanelProps) {
  const gymBranches = dashboard.branches.filter((b) => b.gym_id === gym.id);
  const gymMembers = dashboard.members.filter((m) => m.gym_id === gym.id);
  const gymTrainers = dashboard.trainers.filter((t) => t.gym_id === gym.id);
  const gymPayments = dashboard.payments.filter((p) => p.gym_id === gym.id);
  const gymAttendance = dashboard.attendanceLogs.filter((l) => l.gym_id === gym.id);
  const gymClasses = dashboard.classSessions.filter((s) => s.gym_id === gym.id);

  // Find gym admin from branch_users
  const gymAdmins = dashboard.branchUsers.filter((u) => {
    const userBranches = dashboard.branches.filter((b) => b.gym_id === gym.id);
    return userBranches.some((b) => b.id === u.branch_id) && u.role_name === "gym_admin";
  });

  const totalCapacity = gymBranches.reduce((s, b) => s + Number(b.capacity ?? 0), 0);
  const usedCapacity = gymMembers.length;
  const capacityPercent = totalCapacity > 0 ? Math.min(100, Math.round((usedCapacity / totalCapacity) * 100)) : 0;

  const totalRevenue = gymPayments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);

  // Compute active branch name list
  const activeBranchNames = gymBranches.filter((b) => b.status === "active").map((b) => b.name);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${gym.name} details`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{gym.name}</h2>
              <EnterpriseStatusBadge status={gym.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">Slug: {gym.slug} · {gym.timezone} · {gym.currency}</p>
          </div>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close panel"><X className="size-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Gym Admin */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Gym Admin</p>
            {gymAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin assigned</p>
            ) : (
              <div className="space-y-2">
                {gymAdmins.map((admin) => (
                  <div key={admin.id} className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                    <div className="rounded-full bg-accent/10 p-2"><UserRound className="size-4 text-accent" /></div>
                    <div>
                      <p className="text-sm font-bold">Admin</p>
                      <p className="text-xs text-muted-foreground">{admin.access_scope} scope · {admin.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Branches */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Branches ({gymBranches.length})</p>
            {gymBranches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branches</p>
            ) : (
              <div className="space-y-2">
                {gymBranches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-bold">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.branch_code} · {[b.city, b.state].filter(Boolean).join(", ") || "No address"}</p>
                      </div>
                    </div>
                    <EnterpriseStatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Capacity utilization */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Capacity Utilization</p>
            <div className="rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{formatCompactNumber(usedCapacity)} / {formatCompactNumber(totalCapacity)} members</span>
                <span className={`text-sm font-black ${capacityPercent >= 90 ? "text-red-600" : capacityPercent >= 75 ? "text-amber-600" : "text-green-600"}`}>{capacityPercent}%</span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className={`h-full rounded-full transition-all duration-700 ${capacityPercent >= 90 ? "bg-red-500" : capacityPercent >= 75 ? "bg-amber-500" : "bg-accent"}`} style={{ width: `${capacityPercent}%` }} />
              </div>
              {gymBranches.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{activeBranchNames.length} of {gymBranches.length} branches active · Total capacity: {formatCompactNumber(totalCapacity)}</p>
              ) : null}
            </div>
          </div>

          {/* Analytics grid */}
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Analytics</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-2">
                  <UsersRound className="size-4 text-accent" /><span className="text-xs text-muted-foreground">Members</span>
                </div>
                <p className="mt-1 text-2xl font-black">{formatCompactNumber(gymMembers.length)}</p>
                <p className="text-xs text-muted-foreground">{gymMembers.filter((m) => m.status === "active").length} active</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-accent" /><span className="text-xs text-muted-foreground">Revenue</span>
                </div>
                <p className="mt-1 text-2xl font-black">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">{gymPayments.filter((p) => p.status === "paid").length} paid</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-2">
                  <Dumbbell className="size-4 text-accent" /><span className="text-xs text-muted-foreground">Trainers</span>
                </div>
                <p className="mt-1 text-2xl font-black">{formatCompactNumber(gymTrainers.length)}</p>
                <p className="text-xs text-muted-foreground">{gymTrainers.filter((t) => t.status === "active").length} active</p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-accent" /><span className="text-xs text-muted-foreground">Attendance</span>
                </div>
                <p className="mt-1 text-2xl font-black">{formatCompactNumber(gymAttendance.length)}</p>
                <p className="text-xs text-muted-foreground">{gymClasses.length} class sessions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
