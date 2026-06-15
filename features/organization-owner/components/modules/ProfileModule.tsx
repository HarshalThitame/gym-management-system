"use client";

import { useCallback, useState, useActionState } from "react";
import { Building2, CalendarDays, CheckCircle2, CreditCard, Globe2, MapPin, Phone, Save, ShieldCheck, UserRound, XCircle } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveOrganizationProfileAction } from "@/features/organization-owner/actions/profile-actions";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

type ProfileEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: unknown; moduleFilters?: Record<string, unknown>; };

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ProfileEnterpriseModule({ dashboard }: ProfileEnterpriseModuleProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, formAction] = useActionState(saveOrganizationProfileAction, initialAuthActionState);
  const openEdit = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const settings = (dashboard.organization.settings ?? {}) as Record<string, unknown>;
  const legalName = settings.legalName as string | undefined;
  const gstNumber = settings.gstNumber as string | undefined;
  const phone = settings.phone as string | undefined;
  const orgAddress = settings.address as string | undefined;

  // ── Profile completeness ──
  const fields = {
    name: !!dashboard.organization.name,
    slug: !!dashboard.organization.slug,
    billingEmail: !!dashboard.organization.billing_email,
    primaryDomain: !!dashboard.organization.primary_domain,
    phone: !!phone,
    address: !!orgAddress,
    legalName: !!legalName,
    gstNumber: !!gstNumber,
  };
  const totalFields = Object.keys(fields).length;
  const filledFields = Object.values(fields).filter(Boolean).length;
  const completeness = Math.round((filledFields / totalFields) * 100);
  const missingFields = (Object.entries(fields) as [string, boolean][]).filter(([, v]) => !v).map(([k]) => k);

  // ── Usage vs Plan limits ──
  const usageItems = [
    { label: "Locations", current: dashboard.gyms.length, limit: "Unlimited" },
    { label: "Branches", current: dashboard.branches.length, limit: "Unlimited" },
    { label: "Members", current: dashboard.metrics.activeMembers, limit: "Unlimited" },
    { label: "Staff", current: dashboard.branchUsers.length, limit: "Unlimited" },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Your organization's legal name" icon={<Building2 className="size-5" />} label="Organization" value={dashboard.organization.name} />
        <StatCard detail="Organization operational structure" icon={<Building2 className="size-5" />} label="Type" value={formatEnterpriseLabel(dashboard.organization.organization_type)} />
        <StatCard detail="Current account status" icon={<ShieldCheck className="size-5" />} label="Status" value={dashboard.organization.status} />
        <StatCard detail="Organization slug identifier" icon={<Globe2 className="size-5" />} label="Slug" value={dashboard.organization.slug} />
      </section>

      {/* ═══ PROFILE COMPLETENESS ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black">Profile Completeness</h3>
              <p className="mt-1 text-sm text-muted-foreground">{filledFields} of {totalFields} fields completed</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-3 w-32 overflow-hidden rounded-full bg-surface-muted">
                <div className={`h-full rounded-full transition-all ${completeness >= 80 ? "bg-green-500" : completeness >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${completeness}%` }} />
              </div>
              <span className={`text-sm font-black ${completeness >= 80 ? "text-green-600" : completeness >= 50 ? "text-amber-600" : "text-red-600"}`}>{completeness}%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(fields).map(([key, filled]) => (
              <span key={key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                filled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {filled ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ ORGANIZATION DETAILS ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black">Organization Details</h3>
              <p className="mt-1 text-sm text-muted-foreground">Manage your organization profile and contact information</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5" onClick={openEdit} type="button">
              <Save className="size-4" /> Edit Profile
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Legal Name</p>
                <p className="mt-1 text-sm font-bold">{legalName ?? dashboard.organization.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Domain</p>
                <p className="mt-1 text-sm font-bold">{dashboard.organization.primary_domain ?? "Not set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Billing Email</p>
                <p className="mt-1 text-sm font-bold">{dashboard.organization.billing_email ?? "Not set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Phone</p>
                <p className="mt-1 text-sm font-bold">{phone ?? "Not set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Address</p>
                <p className="mt-1 text-sm font-bold">{orgAddress ?? "Not set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="neutral" className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">GST Number</p>
                <p className="mt-1 text-sm font-bold">{gstNumber ?? "Not set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Owner</p>
                <p className="mt-1 text-sm font-bold">{dashboard.organization.owner_user_id?.slice(0, 8) ?? "Not set"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Created</p>
                <p className="mt-1 text-sm font-bold">{dashboard.organization.created_at ? new Date(dashboard.organization.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Type</p>
                <p className="mt-1 text-sm font-bold capitalize">{dashboard.organization.organization_type.replace(/_/g, " ")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ USAGE SUMMARY ═══ */}
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Usage Summary</h3>
          <p className="mt-1 text-sm text-muted-foreground">Current resource usage across your organization</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {usageItems.map((item) => (
              <div key={item.label} className="rounded-md border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-black">{formatCompactNumber(item.current)}</p>
                <p className="text-xs text-muted-foreground">of {item.limit}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ EDIT DRAWER ═══ */}
      <OrgOwnerDrawer description="Update your organization profile information" onClose={closeDrawer} open={drawerOpen} title="Edit Profile" size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Organization Name" required>
              <input className={selectClass} defaultValue={dashboard.organization.name} name="name" required type="text" />
            </DrawerField>
            <DrawerField label="Organization Type">
              <select className={selectClass} defaultValue={dashboard.organization.organization_type} name="organizationType">
                <option value="single_gym">Single Gym</option>
                <option value="multi_branch">Multi Branch</option>
                <option value="franchise">Franchise</option>
              </select>
            </DrawerField>
            <DrawerField label="Legal Name">
              <input className={selectClass} defaultValue={legalName ?? ""} name="legalName" type="text" placeholder="Apex Fitness Pvt Ltd" />
            </DrawerField>
            <DrawerField label="GST Number">
              <input className={selectClass} defaultValue={gstNumber ?? ""} name="gstNumber" type="text" placeholder="27AAACA1234A1Z5" />
            </DrawerField>
            <DrawerField label="Billing Email">
              <input className={selectClass} defaultValue={dashboard.organization.billing_email ?? ""} name="billingEmail" type="email" />
            </DrawerField>
            <DrawerField label="Primary Domain">
              <input className={selectClass} defaultValue={dashboard.organization.primary_domain ?? ""} name="primaryDomain" placeholder="apexfit.com" type="text" />
            </DrawerField>
            <DrawerField label="Phone">
              <input className={selectClass} defaultValue={phone ?? ""} name="phone" type="tel" placeholder="+91 98765 43210" />
            </DrawerField>
            <DrawerField label="Slug">
              <input className={selectClass} defaultValue={dashboard.organization.slug} name="slug" type="text" placeholder="apex-fitness" />
            </DrawerField>
            <div className="md:col-span-2">
              <DrawerField label="Address">
                <textarea className={`${selectClass} min-h-[80px]`} defaultValue={orgAddress ?? ""} name="address" rows={3} placeholder="123 Main Street, Mumbai, Maharashtra 400001" />
              </DrawerField>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Save Profile</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
