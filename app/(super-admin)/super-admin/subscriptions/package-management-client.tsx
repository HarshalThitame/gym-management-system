"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Pencil, Plus, Trash2, X, AlertTriangle, Loader2, Search, Archive, Check, Eye, Users, CreditCard, Calendar, Briefcase, MessageSquare, BarChart3, Smartphone } from "lucide-react";
import { useActionState, useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { savePackageAction, deletePackageAction } from "@/features/super-admin/actions/package-management-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { FeatureCard, FeatureCategorySection } from "@/components/ui/feature-card";
import { FEATURE_CATEGORIES } from "@/features/subscription/feature-definitions";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";

const CATEGORY_ICONS: Record<string, any> = {
  members: Users,
  billing: CreditCard,
  classes: Calendar,
  staff: Briefcase,
  communication: MessageSquare,
  reports: BarChart3,
  portal: Smartphone,
};

type PackageModal = {
  pkg: any | null;
  mode: "create" | "edit";
};

export function PackageManagementClient({ data }: { data: { organizations: any[]; packages: any[]; subscriptions: any[] } }) {
  const [editor, setEditor] = useState<PackageModal | null>(null);
  const [deletingPkg, setDeletingPkg] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPkg, setSelectedPkg] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [saveState, formAction, savePending] = useActionState(savePackageAction, initialAuthActionState);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePackageAction, initialAuthActionState);

  const subs = data.subscriptions;
  const pkgs = data.packages;
  const orgs = data.organizations;

  const activeSubs = subs.filter((s: any) => s.status === "active").length;
  const trialSubs = subs.filter((s: any) => s.status === "trial").length;
  const expiredSubs = subs.filter((s: any) => s.status === "expired").length;

  // Build feature map from package_features/package_limits (from DB)
  function getPackageFeatureValue(pkg: any, featureCode: string): boolean {
    const features = pkg._features ?? {};
    return features[featureCode] === true || features[featureCode] === "true";
  }

  function getPackageLimitValue(pkg: any, limitCode: string): number {
    const limits = pkg._limits ?? {};
    return limits[limitCode] ?? 0;
  }

  const filteredPkgs = useMemo(() => {
    if (!search) return pkgs;
    const q = search.toLowerCase();
    return pkgs.filter((p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  }, [pkgs, search]);

  function openCreate() { setEditor({ pkg: null, mode: "create" }); }
  function openEdit(pkg: any) { setEditor({ pkg, mode: "edit" }); }
  function closeEditor() { setEditor(null); setSelectedPkg(null); }

  useEffect(() => {
    if (saveState.status === "success") {
      showToast(saveState.message || "Package saved successfully.", "success");
      closeEditor();
    } else if (saveState.status === "error" && saveState.message) {
      showToast(saveState.message, "error");
    }
  }, [saveState]);

  useEffect(() => {
    if (deleteState.status === "success") {
      showToast(deleteState.message || "Package deleted.", "success");
      setDeletingPkg(null);
      setDeleteConfirm("");
    } else if (deleteState.status === "error" && deleteState.message) {
      showToast(deleteState.message, "error");
    }
  }, [deleteState]);

  function getDeleteContext(pkg: any) {
    const assignedOrgs = subs.filter((s: any) => s.package_id === pkg.id);
    const assignedCount = assignedOrgs.length;
    const activeCount = assignedOrgs.filter((s: any) => s.status === "active" || s.status === "trial").length;
    return { assignedCount, activeCount, hasSubscribers: assignedCount > 0 };
  }

  return (
    <div className="space-y-6">
      <ToastContainer />

      {/* Package Management Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black">Package Management</h2>
          <p className="text-sm text-muted-foreground">
            {filteredPkgs.length} packages · {activeSubs} active subscriptions · {trialSubs} trial
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("px-3 py-2 text-xs font-bold transition", viewMode === "grid" ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
              type="button"
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("px-3 py-2 text-xs font-bold transition border-l border-border", viewMode === "list" ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
              type="button"
            >
              List
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search packages..."
              className="h-10 w-56 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm"
              aria-label="Search packages"
            />
          </div>
          <Button onClick={openCreate} size="sm" className="gap-2">
            <Plus className="size-4" /> Create Package
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Packages" value={String(pkgs.length)} detail={`${pkgs.filter((p: any) => p.is_active).length} active`} />
        <StatCard label="Active Subscriptions" value={String(activeSubs)} detail={`${trialSubs} in trial`} status={activeSubs > 0 ? "good" : "watch"} />
        <StatCard label="Expired / Suspended" value={String(expiredSubs)} detail="Need attention" status={expiredSubs > 0 ? "risk" : "good"} />
        <StatCard label="Unassigned Organizations" value={String(orgs.length - subs.length)} detail="No plan assigned" status={orgs.length > subs.length ? "watch" : "good"} />
      </div>

      {/* Package Cards / List */}
      {filteredPkgs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface-muted py-16 text-center">
          <PackageIcon className="size-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-black text-muted-foreground">No packages found</p>
            {search ? (
              <p className="text-sm text-muted-foreground">No packages matching &quot;{search}&quot;</p>
            ) : (
              <p className="text-sm text-muted-foreground">Create your first subscription package to get started</p>
            )}
          </div>
          {!search && <Button onClick={openCreate} variant="primary"><Plus className="size-4" /> Create Package</Button>}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredPkgs.map((pkg: any) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              subsCount={subs.filter((s: any) => s.package_id === pkg.id).length}
              activeSubsCount={subs.filter((s: any) => s.package_id === pkg.id && s.status === "active").length}
              onEdit={() => openEdit(pkg)}
              onDelete={() => { setDeletingPkg(pkg); setDeleteConfirm(""); }}
              onView={() => setSelectedPkg(pkg)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-3">Package</th>
                <th className="px-5 py-3">Price</th>
                <th className="px-5 py-3">Members</th>
                <th className="px-5 py-3">Branches</th>
                <th className="px-5 py-3">Staff</th>
                <th className="px-5 py-3">Subscriptions</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPkgs.map((pkg: any) => (
                <tr key={pkg.id} className="border-b border-border hover:bg-accent/5 transition-colors">
                  <td className="px-5 py-3 font-semibold">{pkg.name}</td>
                  <td className="px-5 py-3">₹{Intl.NumberFormat("en-IN").format(pkg.price ?? 0)}</td>
                  <td className="px-5 py-3">{getPackageLimitValue(pkg, "max_members") === -1 ? "Unlimited" : getPackageLimitValue(pkg, "max_members")}</td>
                  <td className="px-5 py-3">{getPackageLimitValue(pkg, "max_branches") === -1 ? "Unlimited" : getPackageLimitValue(pkg, "max_branches")}</td>
                  <td className="px-5 py-3">{getPackageLimitValue(pkg, "max_staff") === -1 ? "Unlimited" : getPackageLimitValue(pkg, "max_staff")}</td>
                  <td className="px-5 py-3">{subs.filter((s: any) => s.package_id === pkg.id).length}</td>
                  <td className="px-5 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
                      pkg.is_active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-50 text-gray-500 border border-gray-200"
                    )}>
                      {pkg.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(pkg)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10" type="button" aria-label="Edit"><Pencil className="size-4" /></button>
                      <button onClick={() => { setDeletingPkg(pkg); setDeleteConfirm(""); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" type="button" aria-label="Delete"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Package Detail View */}
      {selectedPkg && (
        <PackageDetailView
          pkg={selectedPkg}
          onClose={() => setSelectedPkg(null)}
          onEdit={() => { openEdit(selectedPkg); setSelectedPkg(null); }}
          subs={subs}
        />
      )}

      {/* Package Editor Modal */}
      {editor !== null && (
        <PackageEditorModal
          open
          pkg={editor.pkg}
          mode={editor.mode}
          savePending={savePending}
          formAction={formAction}
          onClose={closeEditor}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingPkg && (
        <DeleteConfirmationModal
          pkg={deletingPkg}
          deleteContext={getDeleteContext(deletingPkg)}
          deleteState={deleteState}
          deletePending={deletePending}
          deleteConfirm={deleteConfirm}
          onDeleteConfirmChange={setDeleteConfirm}
          onClose={() => { setDeletingPkg(null); setDeleteConfirm(""); }}
          deleteAction={deleteAction}
        />
      )}
    </div>
  );
}

/* ─── Package Card ─── */

function PackageCard({ pkg, subsCount, activeSubsCount, onEdit, onDelete, onView }: {
  pkg: any; subsCount: number; activeSubsCount: number; onEdit: () => void; onDelete: () => void; onView: () => void;
}) {
  const features = pkg._features ?? {};
  const limits = pkg._limits ?? {};

  const memberLimit = limits["max_members"] ?? 0;
  const branchLimit = limits["max_branches"] ?? 0;
  const staffLimit = limits["max_staff"] ?? 0;

  return (
    <div className="group relative rounded-xl border border-border bg-gradient-to-br from-background to-accent/5 transition-all hover:shadow-lg hover:border-primary/20 overflow-hidden">
      {/* Gradient header */}
      <div className={cn("h-1.5 w-full bg-gradient-to-r", pkg.is_active ? "from-primary/60 to-primary/20" : "from-gray-300 to-gray-100")} />

      <div className="p-5">
        {/* Package name & status */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-black text-lg">{pkg.name}</p>
            {pkg.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}
          </div>
          <span className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold border",
            pkg.is_active
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-gray-50 text-gray-500 border-gray-200"
          )}>
            {pkg.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Pricing - Monthly & Annual */}
        {pkg.name === "Enterprise" ? (
          <div className="mt-3">
            <p className="text-lg font-black">Custom Pricing</p>
            <p className="text-xs text-muted-foreground">Contact Sales</p>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black">₹{Intl.NumberFormat("en-IN").format(Math.round((pkg._pricing?.find((pr: any) => pr.billing_period === "monthly")?.price ?? pkg.price ?? 0) / 100))}</span>
              <span className="text-xs text-muted-foreground">/month</span>
            </div>
            <div className="flex items-baseline gap-1 text-sm">
              <span className="font-bold">₹{Intl.NumberFormat("en-IN").format(Math.round((pkg._pricing?.find((pr: any) => pr.billing_period === "annual")?.price ?? 0) / 100))}</span>
              <span className="text-xs text-muted-foreground">/year</span>
              <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-700 border border-green-200">2 free</span>
            </div>
          </div>
        )}

        {/* Limits */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <LimitBadge
            label="Members"
            value={memberLimit === -1 ? "∞" : memberLimit}
            color="green"
          />
          <LimitBadge
            label="Branches"
            value={branchLimit === -1 ? "∞" : branchLimit}
            color="blue"
          />
          <LimitBadge
            label="Staff"
            value={staffLimit === -1 ? "∞" : staffLimit}
            color="purple"
          />
        </div>

        {/* Features summary */}
        <div className="mt-3 space-y-1">
          {FEATURE_CATEGORIES.slice(0, 4).map((cat) => {
            const includedCount = cat.features.filter((f) => features[f.featureCode] === true || features[f.featureCode] === "true").length;
            const totalCount = cat.features.length;
            if (totalCount === 0) return null;
            return (
              <div key={cat.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground w-24 truncate">{cat.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-accent/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/40"
                    style={{ width: `${(includedCount / totalCount) * 100}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-8 text-right">{includedCount}/{totalCount}</span>
              </div>
            );
          })}
        </div>

        {/* Subscription count + Trial */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          <span>{subsCount} organizations ({activeSubsCount} active)</span>
        </div>
        {pkg.trial_days > 0 && (
          <div className="mt-2 flex items-center gap-1 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 font-semibold text-blue-700">
              {pkg.trial_days}-day free trial
            </span>
          </div>
        )}
        {pkg.name === "Enterprise" && (
          <div className="mt-2 flex items-center gap-1 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 font-semibold text-purple-700">
              Custom pricing
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button onClick={onView} size="sm" variant="secondary" className="flex-1 gap-1.5"><Eye className="size-3.5" /> View</Button>
          <Button onClick={onEdit} size="sm" variant="secondary" className="flex-1 gap-1.5"><Pencil className="size-3.5" /> Edit</Button>
          <Button onClick={onDelete} size="sm" variant="destructive" className="gap-1.5"><Trash2 className="size-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}

function LimitBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorClasses: Record<string, string> = {
    green: "border-green-200 bg-green-50 text-green-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  };
  return (
    <div className={cn("rounded-lg border p-2 text-center", colorClasses[color] ?? "border-border bg-background")}>
      <p className="text-[18px] font-black">{value}</p>
      <p className="text-[10px] font-semibold opacity-80">{label}</p>
    </div>
  );
}

/* ─── Package Detail View ─── */

function PackageDetailView({ pkg, onClose, onEdit, subs }: {
  pkg: any;
  onClose: () => void;
  onEdit: () => void;
  subs: any[];
}) {

  const features = pkg._features ?? {};
  const limits = pkg._limits ?? {};
  const orgAssigned = subs.filter((s: any) => s.package_id === pkg.id);
  const activeOrgs = orgAssigned.filter((s: any) => s.status === "active").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-black">{pkg.name}</h2>
              <p className="text-sm text-muted-foreground">{pkg.description}</p>
            </div>
            <Badge variant={pkg.is_active ? "success" : "neutral"}>{pkg.is_active ? "Active" : "Inactive"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onEdit} variant="primary" size="sm" className="gap-2"><Pencil className="size-4" /> Edit Package</Button>
            <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent/10"><X className="size-5" /></button>
          </div>
        </div>

        {/* Pricing & Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard label="Monthly Price" value={`₹${Intl.NumberFormat("en-IN").format(pkg.price ?? 0)}`} detail="Per month" />
          <StatCard label="Organizations" value={String(orgAssigned.length)} detail={`${activeOrgs} active`} />
          <StatCard label="Billing Period" value={pkg.billing_period ?? "monthly"} detail="Default cycle" />
          <StatCard label="Trial Days" value={String(pkg.trial_days ?? 0)} detail="Free trial duration" />
        </div>

        {/* Limits */}
        <div className="mb-6">
          <h3 className="text-base font-black mb-3">Resource Limits</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(limits).map(([code, val]: [string, any]) => (
              <div key={code} className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{code.replace(/_/g, " ")}</p>
                <p className="mt-1 text-xl font-black">{val === -1 ? "Unlimited" : val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Feature categories */}
        <div className="space-y-5">
          <h3 className="text-base font-black">Features</h3>
          {FEATURE_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id] ?? Check;
            const catFeatures = cat.features.map((f) => ({
              ...f,
              included: features[f.featureCode] === true || features[f.featureCode] === "true",
              limitVal: f.limitKey ? limits[f.limitKey] : undefined,
            }));
            return (
              <FeatureCategorySection
                key={cat.id}
                name={cat.name}
                description={cat.description}
                icon={<Icon className="size-4" />}
              >
                {catFeatures.map((f, idx) => (
                  <FeatureCard
                    key={`${f.featureCode}-${idx}`}
                    label={f.label}
                    description={f.description}
                    included={f.included}
                    {...(f.included ? {} : { upgradeLabel: f.upgradeLabel ?? "Locked" })}
                    {...(f.included && f.limitLabel ? { limitLabel: f.limitLabel } : {})}
                  />
                ))}
              </FeatureCategorySection>
            );
          })}
        </div>

        {/* Assigned organizations */}
        {orgAssigned.length > 0 && (
          <div className="mt-6">
            <h3 className="text-base font-black mb-3">Assigned Organizations ({orgAssigned.length})</h3>
            <div className="space-y-2">
              {orgAssigned.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                  <span className="text-sm font-semibold">{s.organization_id}</span>
                  <StatusBadge2 status={s.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge2({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    trial: "bg-blue-50 text-blue-700 border-blue-200",
    expired: "bg-red-50 text-red-700 border-red-200",
    suspended: "bg-orange-50 text-orange-800 border-orange-200",
  };
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", colors[status] ?? "bg-gray-50 text-gray-500 border-gray-200")}>
      {status}
    </span>
  );
}

/* ─── Package Editor Modal ─── */

function PackageEditorModal({ open, pkg, mode, savePending, formAction, onClose }: {
  open: boolean;
  pkg: any | null;
  mode: "create" | "edit";
  savePending: boolean;
  formAction: any;
  onClose: () => void;
}) {
  const [activeFeatureTab, setActiveFeatureTab] = useState<string>("members");
  const pkgMeta = typeof pkg?.metadata === "object" ? (pkg.metadata ?? {}) : {};
  const [priceMonthly, setPriceMonthly] = useState(pkgMeta?.price_monthly ?? pkg?.price ?? 0);
  const [priceAnnual, setPriceAnnual] = useState(pkgMeta?.price_annual ?? (pkg?.price ?? 0) * 10);
  const [annualDiscountLabel, setAnnualDiscountLabel] = useState(pkgMeta?.annual_discount_label ?? "2 months free");
  const [billingPeriod, setBillingPeriod] = useState(pkg?.billing_period ?? "monthly");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black">{mode === "edit" ? "Edit Package" : "Create Package"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "edit" ? "Modify plan settings, features, limits, and pricing." : "Define a new subscription plan tier with features and limits."}
            </p>
          </div>
          <button onClick={onClose} disabled={savePending} className="rounded-md p-1.5 hover:bg-accent/10 disabled:opacity-50"><X className="size-5" /></button>
        </div>

        <form action={formAction} className="space-y-6">
          {pkg && <input type="hidden" name="id" value={pkg.id} />}

          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-name">Package Name</label>
              <Input id="pkg-name" name="name" defaultValue={pkg?.name ?? ""} required placeholder="e.g. Starter, Professional, Enterprise" disabled={savePending} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-price-m">Monthly Price (₹)</label>
                <Input
                  id="pkg-price-m"
                  name="priceMonthly"
                  type="number"
                  value={priceMonthly}
                  onChange={(e) => setPriceMonthly(Number(e.target.value))}
                  disabled={savePending}
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  ₹{Intl.NumberFormat("en-IN").format(Math.round(priceMonthly / 100))} / month
                </p>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-price-a">Annual Price (₹)</label>
                <Input
                  id="pkg-price-a"
                  name="priceAnnual"
                  type="number"
                  value={priceAnnual}
                  onChange={(e) => setPriceAnnual(Number(e.target.value))}
                  disabled={savePending}
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  ₹{Intl.NumberFormat("en-IN").format(Math.round(priceAnnual / 100))} / yr · ₹{Intl.NumberFormat("en-IN").format(Math.round(priceAnnual / 1200))}/mo eff.
                </p>
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-disc-label">Annual Discount Label</label>
                <Input
                  id="pkg-disc-label"
                  name="annualDiscountLabel"
                  defaultValue={annualDiscountLabel}
                  disabled={savePending}
                />
                {priceAnnual > 0 && priceMonthly > 0 && (
                  <p className="mt-0.5 text-[11px] text-green-600 font-semibold">
                    Save ₹{Intl.NumberFormat("en-IN").format(Math.round((priceMonthly * 12 - priceAnnual) / 100))} · {annualDiscountLabel || "2 months free"}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="pkg-desc">Description</label>
            <Textarea id="pkg-desc" name="description" defaultValue={pkg?.description ?? ""} rows={2} placeholder="Brief description of what this plan includes..." disabled={savePending} />
          </div>

          {/* Limits */}
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground mb-3">Resource Limits</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <LimitField label="Max Members (-1 = ∞)" name="maxMembers" value={pkg?.max_members ?? pkg?._limits?.max_members ?? 0} disabled={savePending} />
              <LimitField label="Max Branches (-1 = ∞)" name="maxBranches" value={pkg?.max_branches ?? pkg?._limits?.max_branches ?? 0} disabled={savePending} />
              <LimitField label="Max Trainers (-1 = ∞)" name="maxTrainers" value={pkg?.max_trainers ?? pkg?._limits?.max_trainers ?? 0} disabled={savePending} />
              <LimitField label="Max Staff (-1 = ∞)" name="maxStaff" value={pkg?.max_staff ?? pkg?._limits?.max_staff ?? 0} disabled={savePending} />
              <LimitField label="Storage GB (-1 = ∞)" name="maxStorage" value={pkg?.max_storage_gb ?? pkg?._limits?.max_storage_gb ?? 0} disabled={savePending} />
              <LimitField label="Monthly API Calls (-1 = ∞)" name="maxApiCalls" value={pkg?.max_api_calls ?? pkg?._limits?.max_api_calls ?? 0} disabled={savePending} />
              <LimitField label="Sort Order" name="sortOrder" value={pkg?.sort_order ?? 0} disabled={savePending} />
            </div>
          </div>

          {/* Trial & Billing Settings */}
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground mb-3">Trial & Billing Settings</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <label className="text-sm font-semibold" htmlFor="pkg-trial-days">Trial Days</label>
                <Input id="pkg-trial-days" name="trialDays" type="number" defaultValue={pkg?.trial_days ?? 0} disabled={savePending} />
                <p className="mt-0.5 text-[11px] text-muted-foreground">Set 0 to disable free trial</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 flex items-center gap-3">
                <input type="checkbox" name="isTrialAvailable" defaultChecked={pkgMeta?.is_trial_available !== false} disabled={savePending} className="size-4 rounded border-border text-primary" />
                <div>
                  <p className="text-sm font-semibold">Free Trial Available</p>
                  <p className="text-[11px] text-muted-foreground">Allow organizations to start a free trial</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <label className="text-sm font-semibold" htmlFor="pkg-billing-cycle">Default Billing Cycle</label>
                <select id="pkg-billing-cycle" name="billingPeriod" defaultValue={pkg?.billing_period ?? "monthly"} disabled={savePending} className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half Yearly</option>
                </select>
              </div>
            </div>
          </div>

          {/* Feature Categories - Tabbed */}
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="border-b border-border bg-accent/5 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Feature Toggles</p>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface-muted/50 px-4 py-2">
              {FEATURE_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id] ?? Check;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveFeatureTab(cat.id)}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition",
                      activeFeatureTab === cat.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FEATURE_CATEGORIES.find((c) => c.id === activeFeatureTab)?.features.map((f, idx) => {
                  const fieldName = `${f.featureCode}Enabled`;
                  return (
                    <label
                      key={`${f.featureCode}-${idx}`}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-3 text-sm cursor-pointer hover:bg-accent/10 transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        name={f.featureCode === "member_management" ? "memberManagement" : f.featureCode === "class_booking" ? "classScheduling" : f.featureCode === "whatsapp_integration" ? "communicationsEnabled" : f.featureCode === "biometric_attendance" ? "biometricAttendance" : f.featureCode === "api_access" ? "apiAccess" : f.featureCode === "qr_attendance" ? "qrAttendance" : f.featureCode === "multi_branch_management" ? "multiBranchManagement" : f.featureCode}
                        defaultChecked={pkg ? (pkg._features?.[f.featureCode] === true || pkg._features?.[f.featureCode] === "true") : false}
                        disabled={savePending}
                        className="size-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{f.label}</p>
                        {f.upgradeLabel && <p className="text-[10px] text-amber-600">{f.upgradeLabel}</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
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

/* ─── Delete Confirmation Modal ─── */

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!deletePending) onClose(); }}>
      <div className="w-full max-w-md rounded-xl border-2 border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ borderColor: hasSubscribers ? "#d97706" : "#dc2626" }}>
        <div className="flex items-start gap-4">
          <div className={`rounded-full p-2 ${hasSubscribers ? "bg-amber-50" : "bg-red-50"}`}>
            {hasSubscribers ? <Archive className="size-6 text-amber-600" /> : <AlertTriangle className="size-6 text-red-600" />}
          </div>
          <div>
            <h2 className="text-lg font-black">{hasSubscribers ? "Cannot Delete - Archive Instead" : "Delete Package"}</h2>
            {hasSubscribers ? (
              <div className="mt-2 space-y-2 text-sm">
                <p className="text-muted-foreground"><span className="font-semibold text-foreground">{pkg.name}</span> has <span className="font-black text-amber-600">{assignedCount}</span> assigned organization(s).</p>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <p className="font-semibold">
                    {activeCount > 0 ? `${activeCount} subscription(s) are active or in trial. ` : ""}
                    This package will be archived so subscription history stays intact.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                No organizations are currently assigned to <span className="font-semibold text-foreground">{pkg.name}</span>. If historical billing or request records exist, it will be archived instead.
              </p>
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
          <div>
            <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="delete-confirm">
              Type <span className={hasSubscribers ? "text-amber-600" : "text-red-600"}>DELETE</span> to confirm
            </label>
            <Input id="delete-confirm" value={deleteConfirm} onChange={(e) => onDeleteConfirmChange(e.target.value)} placeholder="DELETE" className="mt-1" disabled={deletePending} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={deletePending}>Cancel</Button>
            <Button type="submit" variant={hasSubscribers ? "secondary" : "destructive"} disabled={deleteConfirm !== "DELETE" || deletePending} className="gap-2">
              {deletePending ? <Loader2 className="size-4 animate-spin" /> : null}
              {deletePending ? "Processing..." : hasSubscribers ? "Archive Package" : "Delete Package"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4 7.55 4.24" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.29 7 12 12l8.71-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
