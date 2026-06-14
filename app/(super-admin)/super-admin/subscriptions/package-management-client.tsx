"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Pencil, Plus, Trash2, X, AlertTriangle, Loader2, Search } from "lucide-react";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { savePackageAction, deletePackageAction } from "@/features/super-admin/actions/package-management-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";

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

export function PackageManagementClient({ data }: { data: { organizations: any[]; packages: any[]; subscriptions: any[] } }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingPkg, setEditingPkg] = useState<any | null>(null);
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

  function openCreate() { setEditingPkg(null); setShowEditor(true); }
  function openEdit(pkg: any) { setEditingPkg(pkg); setShowEditor(true); }

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
        <div className="rounded-xl border border-border bg-gradient-to-br from-background to-green-50/50 p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Active</p><p className="mt-2 text-3xl font-black text-green-600">{activeSubs}</p></div>
        <div className="rounded-xl border border-border bg-gradient-to-br from-background to-blue-50/50 p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Trial</p><p className="mt-2 text-3xl font-black text-blue-600">{trialSubs}</p></div>
        <div className="rounded-xl border border-border bg-gradient-to-br from-background to-red-50/50 p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Expired</p><p className="mt-2 text-3xl font-black text-red-600">{expiredSubs}</p></div>
        <div className="rounded-xl border border-border bg-gradient-to-br from-background to-accent/5 p-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Unassigned</p><p className="mt-2 text-3xl font-black text-muted-foreground">{orgs.length - subs.length}</p></div>
      </div>

      {/* Packages Section */}
      <div className="rounded-xl border border-border bg-background">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <h2 className="text-lg font-black">Packages</h2>
          <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="size-4" /> Create Package</Button>
        </div>
        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {pkgs.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-4xl">&#128230;</p>
              <p className="font-semibold text-muted-foreground">No packages yet</p>
              <Button onClick={openCreate} variant="primary">Create your first package</Button>
            </div>
          )}
          {pkgs.map((pkg) => (
            <div key={pkg.id} className="group relative rounded-lg border border-border bg-gradient-to-br from-background to-accent/5 p-5 transition-all hover:shadow-md hover:border-primary/20">
              {pkg.recommended && <Badge className="absolute -top-2.5 right-3 border-green-200 bg-green-50 text-green-700 shadow-sm">Popular</Badge>}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-lg">{pkg.name}</p>
                  {pkg.price > 0 && <p className="text-sm text-muted-foreground">&#8377;{Intl.NumberFormat("en-IN").format(pkg.price)} / {pkg.billing_period ?? "month"}</p>}
                </div>
                <Badge className={pkg.is_active ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>
                  {pkg.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {pkg.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border border-border bg-background p-2"><p className="text-[10px] text-muted-foreground">Max Members</p><p className="font-black">{pkg.max_members}</p></div>
                <div className="rounded-md border border-border bg-background p-2"><p className="text-[10px] text-muted-foreground">Max Branches</p><p className="font-black">{pkg.max_branches}</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {ALL_FEATURES.filter((f) => pkg[f[2] as string]).map((f) => (
                  <Badge key={f[0]} variant="info" className="text-[10px]">{f[1]}</Badge>
                ))}
              </div>
              <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button onClick={() => openEdit(pkg)} size="sm" variant="secondary" className="flex-1 gap-1.5"><Pencil className="size-3.5" /> Edit</Button>
                <Button onClick={() => { setDeletingPkg(pkg); setDeleteConfirm(""); }} size="sm" variant="destructive" className="gap-1.5"><Trash2 className="size-3.5" /></Button>
              </div>
            </div>
          ))}
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
                    <td className="px-6 py-3 text-muted-foreground">{orgSub?.started_at ? new Date(orgSub.started_at).toLocaleDateString() : "mdash;"}</td>
                    <td className="px-6 py-3 text-muted-foreground">{orgSub?.expires_at ? new Date(orgSub.expires_at).toLocaleDateString() : "mdash;"}</td>
                  </tr>
                );
              })}
              {orgs.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No organizations found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowEditor(false)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black">{editingPkg ? "Edit Package" : "Create Package"}</h2>
                <p className="text-sm text-muted-foreground">{editingPkg ? "Modify plan settings, features, and limits." : "Define a new subscription plan tier."}</p>
              </div>
              <button onClick={() => setShowEditor(false)} className="rounded-md p-1.5 hover:bg-accent/10"><X className="size-5" /></button>
            </div>

            {saveState.status === "error" && <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{saveState.message}</span></div>}
            {saveState.status === "success" && <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{saveState.message}</div>}

            <form action={formAction} className="space-y-5">
              {editingPkg && <input type="hidden" name="id" value={editingPkg.id} />}

              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-name">Package Name</label>
                  <Input id="pkg-name" name="name" defaultValue={editingPkg?.name ?? ""} required placeholder="e.g. Starter, Professional, Enterprise" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-price">Price (paise)</label>
                    <Input id="pkg-price" name="price" type="number" defaultValue={editingPkg?.price ?? 0} />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-billing">Billing</label>
                    <select id="pkg-billing" name="billingPeriod" defaultValue={editingPkg?.billing_period ?? "monthly"} className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
                      <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                      <option value="half_yearly">Half Yearly</option><option value="annual">Annual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-desc">Description</label>
                <Textarea id="pkg-desc" name="description" defaultValue={editingPkg?.description ?? ""} rows={2} placeholder="Brief description of what this plan includes..." />
              </div>

              {/* Limits */}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground mb-2">Limits</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <label className="text-sm font-semibold" htmlFor="pkg-members">Max Members (-1 = unlimited)</label>
                    <Input id="pkg-members" name="maxMembers" type="number" defaultValue={editingPkg?.max_members ?? 0} />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <label className="text-sm font-semibold" htmlFor="pkg-branches">Max Branches (-1 = unlimited)</label>
                    <Input id="pkg-branches" name="maxBranches" type="number" defaultValue={editingPkg?.max_branches ?? 0} />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <label className="text-sm font-semibold" htmlFor="pkg-gyms">Max Gyms (-1 = unlimited)</label>
                    <Input id="pkg-gyms" name="maxGyms" type="number" defaultValue={editingPkg?.max_gyms ?? 1} />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <label className="text-sm font-semibold" htmlFor="pkg-trainers">Max Trainers (-1 = unlimited)</label>
                    <Input id="pkg-trainers" name="maxTrainers" type="number" defaultValue={editingPkg?.max_trainers ?? 0} />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <label className="text-sm font-semibold" htmlFor="pkg-storage">Storage GB (-1 = unlimited)</label>
                    <Input id="pkg-storage" name="maxStorage" type="number" defaultValue={editingPkg?.max_storage_gb ?? 0} />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <label className="text-sm font-semibold" htmlFor="pkg-apicalls">Monthly API Calls (-1 = unlimited)</label>
                    <Input id="pkg-apicalls" name="maxApiCalls" type="number" defaultValue={editingPkg?.max_api_calls ?? 0} />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <label className="text-sm font-semibold" htmlFor="pkg-sort">Sort Order</label>
                    <Input id="pkg-sort" name="sortOrder" type="number" defaultValue={editingPkg?.sort_order ?? 0} />
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <label className="text-sm font-semibold" htmlFor="pkg-trial">Trial Days</label>
                    <Input id="pkg-trial" name="trialDays" type="number" defaultValue={editingPkg?.trial_days ?? 0} />
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground mb-2">Features</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_FEATURES.map((f) => (
                    <label key={f[0]} className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-3 text-sm cursor-pointer hover:bg-accent/10 transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                      <input type="checkbox" name={f[0]} defaultChecked={editingPkg ? editingPkg[f[2] as string] : false} className="size-4 rounded border-border text-primary focus:ring-primary" />
                      {f[1]}
                    </label>
                  ))}
                </div>
              </div>

              {/* Status Toggles */}
              <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-background p-4">
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" name="isActive" defaultChecked={editingPkg ? editingPkg.is_active : true} className="size-4 rounded border-border text-primary" />
                  <span className="font-semibold">Active</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" name="recommended" defaultChecked={editingPkg?.recommended ?? false} className="size-4 rounded border-border text-amber-500" />
                  <span className="font-semibold">Recommended (Popular badge)</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button type="button" variant="secondary" onClick={() => setShowEditor(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={savePending}>
                  {savePending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {editingPkg ? "Save Changes" : "Create Package"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPkg && (() => {
        const assignedOrgs = subs.filter((s) => s.package_id === deletingPkg.id);
        const assignedCount = assignedOrgs.length;
        const activeCount = assignedOrgs.filter((s) => s.status === "active" || s.status === "trial").length;
        const hasSubscribers = assignedCount > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeletingPkg(null)}>
            <div className="w-full max-w-md rounded-xl border-2 border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ borderColor: hasSubscribers ? "#d97706" : "#dc2626" }}>
              <div className="flex items-start gap-4">
                <div className={`rounded-full p-2 ${hasSubscribers ? "bg-amber-50" : "bg-red-50"}`}>
                  <AlertTriangle className={`size-6 ${hasSubscribers ? "text-amber-600" : "text-red-600"}`} />
                </div>
                <div>
                  <h2 className="text-lg font-black">{hasSubscribers ? "Cannot Delete — Deactivate Instead" : "Delete Package"}</h2>
                  {hasSubscribers ? (
                    <div className="mt-2 space-y-2 text-sm">
                      <p className="text-muted-foreground"><span className="font-semibold text-foreground">{deletingPkg.name}</span> has <span className="font-black text-amber-600">{assignedCount}</span> assigned organization(s) (<span className="font-black">{activeCount}</span> active).</p>
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
                        <p className="font-semibold">The plan will be <span className="uppercase">deactivated</span> instead of deleted:</p>
                        <ul className="mt-1 list-disc pl-4 text-xs space-y-0.5">
                          <li>Existing orgs keep working until their subscription expires</li>
                          <li>No new orgs can be assigned to this plan</li>
                          <li>Once all subscriptions expire, you can permanently delete it</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">No organizations are assigned to <span className="font-semibold text-foreground">{deletingPkg.name}</span>. It will be permanently removed.</p>
                  )}
                </div>
              </div>

              {deleteState.status === "error" && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteState.message}</div>}
              {deleteState.status === "success" && <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{deleteState.message}</div>}

              <form action={deleteAction} className="mt-5 space-y-4">
                <input type="hidden" name="packageId" value={deletingPkg.id} />
                <input type="hidden" name="forceDeactivate" value={hasSubscribers ? "true" : "false"} />
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="delete-confirm">
                    Type <span className={hasSubscribers ? "text-amber-600" : "text-red-600"}>DELETE</span> to confirm {hasSubscribers ? "deactivation" : "deletion"}
                  </label>
                  <Input id="delete-confirm" name="confirmation" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" className="mt-1" />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setDeletingPkg(null)}>Cancel</Button>
                  <Button type="submit" variant={hasSubscribers ? "secondary" : "destructive"} disabled={deleteConfirm !== "DELETE" || deletePending}
                    className={hasSubscribers ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : ""}>
                    {deletePending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {hasSubscribers ? "Deactivate Package" : "Permanently Delete"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "border-green-200 bg-green-50 text-green-700",
    trial: "border-blue-200 bg-blue-50 text-blue-700",
    expired: "border-red-200 bg-red-50 text-red-700",
    suspended: "border-orange-200 bg-orange-50 text-orange-800",
    cancelled: "border-slate-200 bg-slate-50 text-slate-700"
  };
  return <Badge className={colors[status] ?? ""}>{status}</Badge>;
}
