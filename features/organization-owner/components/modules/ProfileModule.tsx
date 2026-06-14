"use client";

import { useCallback, useState } from "react";
import { Building2, Globe2, ShieldCheck, UserRound, Save } from "lucide-react";
import { useActionState } from "react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveOrganizationProfileAction } from "@/features/organization-owner/actions/profile-actions";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataCard } from "@/features/organization-owner/components/org-owner-data-card";

type ProfileEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard;
  moduleData?: unknown;
  moduleFilters?: Record<string, unknown>; };

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ProfileEnterpriseModule({ dashboard }: ProfileEnterpriseModuleProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, formAction] = useActionState(saveOrganizationProfileAction, initialAuthActionState);
  const openEdit = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Your organization name" icon={<Building2 className="size-5" />} label="Name" value={dashboard.organization.name} />
        <StatCard detail="Organization type" icon={<Building2 className="size-5" />} label="Type" value={dashboard.organization.organization_type} />
        <StatCard detail="Current status" icon={<ShieldCheck className="size-5" />} label="Status" value={dashboard.organization.status} />
        <StatCard detail="Primary domain" icon={<Globe2 className="size-5" />} label="Domain" value={dashboard.organization.primary_domain ?? "Not set"} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black">Organization Details</h3>
              <p className="mt-1 text-sm text-muted-foreground">Manage your organization profile and contact information.</p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5"
              onClick={openEdit}
              type="button"
            >
              <Save className="size-4" /> Edit Profile
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Billing Email</p>
              <p className="mt-1 text-sm font-bold">{dashboard.organization.billing_email ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Owner</p>
              <p className="mt-1 text-sm font-bold">{dashboard.organization.owner_user_id ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Slug</p>
              <p className="mt-1 text-sm font-bold">{dashboard.organization.slug}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <OrgOwnerDrawer description="Update your organization profile information" onClose={closeDrawer} open={drawerOpen} title="Edit Profile" size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Organization Name" required>
              <input className={selectClass} defaultValue={dashboard.organization.name} name="name" required type="text" />
            </DrawerField>
            <DrawerField label="Billing Email">
              <input className={selectClass} defaultValue={dashboard.organization.billing_email ?? ""} name="billingEmail" type="email" />
            </DrawerField>
            <DrawerField label="Primary Domain">
              <input className={selectClass} defaultValue={dashboard.organization.primary_domain ?? ""} name="primaryDomain" placeholder="example.com" type="text" />
            </DrawerField>
            <DrawerField label="Phone">
              <input className={selectClass} name="phone" type="text" />
            </DrawerField>
            <div className="md:col-span-2">
              <DrawerField label="Address">
                <textarea className={`${selectClass} min-h-[80px]`} name="address" rows={3} />
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
