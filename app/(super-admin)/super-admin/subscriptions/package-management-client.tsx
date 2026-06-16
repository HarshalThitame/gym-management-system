"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Pencil, Plus, Trash2, X, AlertTriangle, Loader2, Search, Archive } from "lucide-react";
import { useActionState, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { savePackageAction, deletePackageAction } from "@/features/super-admin/actions/package-management-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { showToast } from "@/components/ui/toast";

const ALL_FEATURES = [
  ["qrAttendance", "QR Attendance", "qr_attendance_enabled"],
  ["biometricAttendance", "Biometric", "biometric_attendance_enabled"],
  ["rfidAttendance", "RFID", "rfid_attendance_enabled"],
  ["classScheduling", "Class Scheduling", "class_scheduling_enabled"],
  ["trainerAssignment", "Trainer Assignment", "trainer_assignment_enabled"],
  ["razorpayEnabled", "Payments", "razorpay_enabled"],
  ["communicationsEnabled", "Communications", "communications_enabled"],
  ["aiEnabled", "AI Features", "ai_enabled"],
  ["advancedReports", "Advanced Reports", "advanced_reports_enabled"],
  ["customDomain", "Custom Domain", "custom_domain_enabled"],
  ["apiAccess", "API Access", "api_access_enabled"],
  ["notificationsEnabled", "Notifications", "notifications_enabled"],
  ["whiteLabelEnabled", "White Label", "white_label_enabled"],
];

type PackageModal = {
  pkg: any | null;
  mode: "create" | "edit";
};

export function PackageManagementClient({ data }: { data: { organizations: any[]; packages: any[]; subscriptions: any[] } }) {
  const [editor, setEditor] = useState<PackageModal>({ pkg: null, mode: "create" });
  const [deletingPkg, setDeletingPkg] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [search, setSearch] = useState("");
  const [saveState, formAction, savePending] = useActionState(savePackageAction, initialAuthActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePackageAction, initialAuthActionState);
  const subs: any[] = data.subscriptions;
  const pkgs: any[] = data.packages;
  const orgs: any[] = data.organizations;

  const activeSubs = subs.filter((s) => s.status === "active").length;
  const trialSubs = subs.filter((s) => s.status === "trial").length;
  const expiredSubs = subs.filter((s) => s.status === "expired").length;

  function openCreate() { setEditor({ pkg: null, mode: "create" }); }
  function openEdit(pkg: any) { setEditor({ pkg, mode: "edit" }); }
  function closeEditor() { setEditor({ pkg: null, mode: "create" }); }

  // Toast save results
  useEffect(() => {
    if (saveState.status === "success") {
      showToast(saveState.message || "Package saved successfully.", "success");
      closeEditor();
    } else if (saveState.status === "error" && saveState.message) {
      showToast(saveState.message, "error");
    }
  }, [saveState]);

  // Toast delete results
  useEffect(() => {
    if (deleteState.status === "success") {
      const isArchived = deleteState.message?.toLowerCase().includes("deactivated") || deleteState.message?.toLowerCase().includes("archived");
      showToast(deleteState.message || "Package deleted.", isArchived ? "info" : "success");
      setDeletingPkg(null);
      setDeleteConfirm("");
    } else if (deleteState.status === "error" && deleteState.message) {
      showToast(deleteState.message, "error");
    }
  }, [deleteState]);

  // Determine if package has subscribers for the delete modal
  function getDeleteContext(pkg: any) {
    const assignedOrgs = subs.filter((s) => s.package_id === pkg.id);
    const assignedCount = assignedOrgs.length;
    const activeCount = assignedOrgs.filter((s) => s.status === "active" || s.status === "trial").length;
    return { assignedCount, activeCount, hasSubscribers: assignedCount > 0 };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Super Admin</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Subscription Management</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {orgs.length} organizations &middot; {pkgs.length} packages &middot; {subs.length} subscriptions
          </p>
        </div>
        <ButtonLink href="/super-admin/billing" variant="secondary">Billing Dashboard</ButtonLink>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active" value={String(activeSubs)} color="green" />
        <KpiCard label="Trial" value={String(trialSubs)} color="blue" />
        <KpiCard label="Expired" value={String(expiredSubs)} color="red" />
        <KpiCard label="Unassigned" value={String(orgs.length - subs.length)} color="muted" />
      </div>

      {/* Packages Section */}
      <div className="rounded-xl border border-border bg-background">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="text-lg font-black">Packages</h2>
          <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="size-4" /> Create Package</Button>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {pkgs.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-4xl">&#128230;</p>
              <p className="font-semibold text-muted-foreground">No packages yet</p>
              <Button onClick={openCreate} variant="primary">Create your first package</Button>
            </div>
          ) : (
            pkgs.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onEdit={() => openEdit(pkg)}
                onDelete={() => { setDeletingPkg(pkg); setDeleteConfirm(""); }}
              />
            ))
          )}
        </div>
      </div>

      {/* Organizations Table */}
      <div className="rounded-xl border border-border bg-background">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black">Organizations</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organizations..." className="h-10 w-64 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm" aria-label="Search" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              <th className="px-6 py-3">Organization</th><th className="px-6 py-3">Package</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Started</th><th className="px-6 py-3">Expires</th>
            </tr></thead>
            <tbody>
              {orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase())).map((org: any) => {
                const orgSub = subs.find((s) => s.organization_id === org.id);
                const pkg = orgSub ? pkgs.find((p) => p.id === orgSub.package_id) : null;
                return (
                  <tr key={org.id} className="border-b border-border hover:bg-accent/10">
                    <td className="px-6 py-3 font-semibold">{org.name}</td>
                    <td className="px-6 py-3"><Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">{pkg?.name ?? "No plan"}</Badge></td>
                    <td className="px-6 py-3">{orgSub ? <StatusBadge status={orgSub.status} /> : <Badge variant="neutral">Unassigned</Badge>}</td>
                    <td className="px-6 py-3 text-muted-foreground" suppressHydrationWarning>{orgSub?.started_at ? new Date(orgSub.started_at).toLocaleDateString() : "-"}</td>
                    <td className="px-6 py-3 text-muted-foreground" suppressHydrationWarning>{orgSub?.expires_at ? new Date(orgSub.expires_at).toLocaleDateString() : "-"}</td>
                  </tr>
                );
              })}
              {orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No organizations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Editor Modal */}
      <PackageEditorModal
        open={editor.pkg !== null || editor.mode === "create"}
        pkg={editor.pkg}
        mode={editor.mode}
        savePending={savePending}
        formAction={formAction}
        onClose={closeEditor}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        pkg={deletingPkg}
        deleteContext={deletingPkg ? getDeleteContext(deletingPkg) : null}
        deleteState={deleteState}
        deletePending={deletePending}
        deleteConfirm={deleteConfirm}
        onDeleteConfirmChange={setDeleteConfirm}
        onClose={() => { setDeletingPkg(null); setDeleteConfirm(""); }}
        deleteAction={deleteAction}
      />
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: "to-green-50/50 text-green-600",
    blue: "to-blue-50/50 text-blue-600",
    red: "to-red-50/50 text-red-600",
    muted: "to-accent/5 text-muted-foreground",
  };
  return (
    <div className={`rounded-xl border border-border bg-gradient-to-br from-background ${colorMap[color]?.split(" ")[0] ?? "to-accent/5"} p-5`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-black ${colorMap[color]?.split(" ")[1] ?? ""}`}>{value}</p>
    </div>
  );
}

function PackageCard({ pkg, onEdit, onDelete }: { pkg: any; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group relative rounded-lg border border-border bg-gradient-to-br from-background to-accent/5 p-5 transition-all hover:shadow-md hover:border-primary/20">
      {pkg.recommended && <Badge className="absolute -top-2.5 right-3 border-green-200 bg-green-50 text-green-700 shadow-sm">Popular</Badge>}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-lg">{pkg.name}</p>
          {pkg.price > 0 && <p className="text-sm text-muted-foreground">&#8377;{Intl.NumberFormat("en-IN").format(pkg.price)} / {pkg.billing_period ?? "month"}</p>}
        </div>
        <StatusBadge status={pkg.is_active ? "active" : "inactive"} suppressHydrationWarning />
      </div>
      {pkg.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border border-border bg-background p-2"><p className="text-[10px] text-muted-foreground">Max Members</p><p className="font-black">{String(pkg.max_members ?? "-")}</p></div>
        <div className="rounded-md border border-border bg-background p-2"><p className="text-[10px] text-muted-foreground">Max Branches</p><p className="font-black">{String(pkg.max_branches ?? "-")}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {ALL_FEATURES.filter((f) => pkg[f[2] as string]).map((f) => (
          <Badge key={f[0]} variant="info" className="text-[10px]">{f[1]}</Badge>
        ))}
      </div>
      <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button onClick={onEdit} size="sm" variant="secondary" className="flex-1 gap-1.5"><Pencil className="size-3.5" /> Edit</Button>
        <Button onClick={onDelete} size="sm" variant="destructive" className="gap-1.5"><Trash2 className="size-3.5" /></Button>
      </div>
    </div>
  );
}

function PackageEditorModal({ open, pkg, mode, savePending, formAction, onClose }: {
  open: boolean;
  pkg: any | null;
  mode: "create" | "edit";
  savePending: boolean;
  formAction: any;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black">{mode === "edit" ? "Edit Package" : "Create Package"}</h2>
            <p className="text-sm text-muted-foreground">{mode === "edit" ? "Modify plan settings, features, and limits." : "Define a new subscription plan tier."}</p>
          </div>
          <button onClick={onClose} disabled={savePending} className="rounded-md p-1.5 hover:bg-accent/10 disabled:opacity-50"><X className="size-5" /></button>
        </div>

        <form action={formAction} className="space-y-5">
          {pkg && <input type="hidden" name="id" value={pkg.id} />}

          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-name">Package Name</label>
              <Input id="pkg-name" name="name" defaultValue={pkg?.name ?? ""} required placeholder="e.g. Starter, Professional, Enterprise" disabled={savePending} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-price">Price (paise)</label>
                <Input id="pkg-price" name="price" type="number" defaultValue={pkg?.price ?? 0} disabled={savePending} />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-billing">Billing</label>
                <select id="pkg-billing" name="billingPeriod" defaultValue={pkg?.billing_period ?? "monthly"} disabled={savePending} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm disabled:opacity-50">
                  <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half Yearly</option><option value="annual">Annual</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-desc">Description</label>
            <Textarea id="pkg-desc" name="description" defaultValue={pkg?.description ?? ""} rows={2} placeholder="Brief description of what this plan includes..." disabled={savePending} />
          </div>

          {/* Limits */}
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground mb-2">Limits</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <LimitField label="Max Members (-1 = unlimited)" name="maxMembers" value={pkg?.max_members} disabled={savePending} />
              <LimitField label="Max Branches / Locations (-1 = unlimited)" name="maxBranches" value={pkg?.max_branches} disabled={savePending} />
              <LimitField label="Max Trainers (-1 = unlimited)" name="maxTrainers" value={pkg?.max_trainers} disabled={savePending} />
              <LimitField label="Storage GB (-1 = unlimited)" name="maxStorage" value={pkg?.max_storage_gb} disabled={savePending} />
              <LimitField label="Monthly API Calls (-1 = unlimited)" name="maxApiCalls" value={pkg?.max_api_calls} disabled={savePending} />
              <LimitField label="Sort Order" name="sortOrder" value={pkg?.sort_order} disabled={savePending} />
              <LimitField label="Trial Days" name="trialDays" value={pkg?.trial_days} disabled={savePending} />
            </div>
          </div>

          {/* Features Grid */}
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground mb-2">Features</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_FEATURES.map((f) => (
                <label key={f[0]} className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-3 text-sm cursor-pointer hover:bg-accent/10 transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                  <input type="checkbox" name={f[0]} defaultChecked={pkg ? pkg[f[2] as string] : false} disabled={savePending} className="size-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50" />
                  {f[1]}
                </label>
              ))}
            </div>
          </div>

          {/* Status Toggles */}
          <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-background p-4">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" name="isActive" defaultChecked={pkg ? pkg.is_active : true} disabled={savePending} className="size-4 rounded border-border text-primary disabled:opacity-50" />
              <span className="font-semibold">Active</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" name="recommended" defaultChecked={pkg?.recommended ?? false} disabled={savePending} className="size-4 rounded border-border text-amber-500 disabled:opacity-50" />
              <span className="font-semibold">Recommended (Popular badge)</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose} disabled={savePending}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={savePending} className="gap-2 min-w-[140px]">
              {savePending ? <Loader2 className="size-4 animate-spin" /> : null}
              {savePending ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Package"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LimitField({ label, name, value, disabled }: { label: string; name: string; value: any; disabled: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <label className="text-sm font-semibold" htmlFor={`pkg-${name}`}>{label}</label>
      <Input id={`pkg-${name}`} name={name} type="number" defaultValue={value ?? 0} disabled={disabled} />
    </div>
  );
}

function DeleteConfirmationModal({ pkg, deleteContext, deleteState, deletePending, deleteConfirm, onDeleteConfirmChange, onClose, deleteAction }: {
  pkg: any;
  deleteContext: { assignedCount: number; activeCount: number; hasSubscribers: boolean } | null;
  deleteState: any;
  deletePending: boolean;
  deleteConfirm: string;
  onDeleteConfirmChange: (v: string) => void;
  onClose: () => void;
  deleteAction: any;
}) {
  if (!pkg || !deleteContext) return null;
  const { assignedCount, activeCount, hasSubscribers } = deleteContext;

  const isArchived = deleteState?.status === "success" && (deleteState.message?.toLowerCase().includes("deactivated") || deleteState.message?.toLowerCase().includes("archived"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!deletePending) onClose(); }}>
      <div className="w-full max-w-md rounded-xl border-2 border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ borderColor: hasSubscribers ? "#d97706" : "#dc2626" }}>
        {isArchived ? (
          /* Success state after archival */
          <div className="text-center py-4">
            <div className="mx-auto rounded-full bg-amber-50 p-3 w-fit">
              <Archive className="size-8 text-amber-600" />
            </div>
            <h2 className="mt-4 text-lg font-black">Package Archived</h2>
            <p className="mt-2 text-sm text-muted-foreground">{deleteState.message}</p>
            <Button className="mt-6" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <div className={`rounded-full p-2 ${hasSubscribers ? "bg-amber-50" : "bg-red-50"}`}>
                {hasSubscribers ? <Archive className="size-6 text-amber-600" /> : <AlertTriangle className="size-6 text-red-600" />}
              </div>
              <div>
                <h2 className="text-lg font-black">{hasSubscribers ? "Cannot Delete - Archive Instead" : "Delete Package"}</h2>
                {hasSubscribers ? (
                  <div className="mt-2 space-y-2 text-sm">
                    <p className="text-muted-foreground"><span className="font-semibold text-foreground">{pkg.name}</span> has <span className="font-black text-amber-600">{assignedCount}</span> assigned organization(s) (<span className="font-black">{activeCount}</span> active).</p>
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
                      <p className="font-semibold">This package has historical subscription records, so it cannot be permanently deleted. It will be archived instead:</p>
                      <ul className="mt-1 list-disc pl-4 text-xs space-y-0.5">
                        <li>Existing orgs keep working until their subscription expires</li>
                        <li>No new orgs can be assigned to this plan</li>
                        <li>Once all subscriptions expire, you can permanently delete it</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No organizations are assigned to <span className="font-semibold text-foreground">{pkg.name}</span>. It will be permanently removed.</p>
                )}
              </div>
            </div>

            {deleteState.status === "error" && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{deleteState.message}</span>
              </div>
            )}

            <form action={deleteAction} className="mt-5 space-y-4">
              <input type="hidden" name="packageId" value={pkg.id} />
              <input type="hidden" name="forceDeactivate" value={hasSubscribers ? "true" : "false"} />
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="delete-confirm">
                  Type <span className={hasSubscribers ? "text-amber-600" : "text-red-600"}>DELETE</span> to confirm {hasSubscribers ? "archival" : "deletion"}
                </label>
                <Input id="delete-confirm" value={deleteConfirm} onChange={(e) => onDeleteConfirmChange(e.target.value)} placeholder="DELETE" className="mt-1" disabled={deletePending} />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onClose} disabled={deletePending}>Cancel</Button>
                <Button type="submit" variant={hasSubscribers ? "secondary" : "destructive"} disabled={deleteConfirm !== "DELETE" || deletePending} className={`gap-2 min-w-[160px] ${hasSubscribers ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : ""}`}>
                  {deletePending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {deletePending
                    ? hasSubscribers ? "Archiving..." : "Deleting..."
                    : hasSubscribers ? "Archive Package" : "Permanently Delete"
                  }
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, suppressHydrationWarning }: { status: string; suppressHydrationWarning?: boolean }) {
  const colors: Record<string, string> = {
    active: "border-green-200 bg-green-50 text-green-700",
    trial: "border-blue-200 bg-blue-50 text-blue-700",
    expired: "border-red-200 bg-red-50 text-red-700",
    suspended: "border-orange-200 bg-orange-50 text-orange-800",
    cancelled: "border-slate-200 bg-slate-50 text-slate-700",
    inactive: "border-gray-200 bg-gray-50 text-gray-700"
  };
  const normalized = status?.toLowerCase() ?? "inactive";
  return (
    <span className={"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold " + (colors[normalized] ?? "border-border bg-surface-muted text-muted-foreground")} suppressHydrationWarning={suppressHydrationWarning}>
      {normalized}
    </span>
  );
}
