"use client";

import { useCallback, useState } from "react";
import { LifeBuoy, Plus } from "lucide-react";
import { useActionState } from "react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { createTicketAction } from "@/features/organization-owner/actions/support-actions";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";

type SupportEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard;
  moduleData?: unknown;
  moduleFilters?: Record<string, unknown>; };

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function SupportEnterpriseModule({ dashboard }: SupportEnterpriseModuleProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, formAction] = useActionState(createTicketAction, initialAuthActionState);
  const openCreate = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Support tickets" icon={<LifeBuoy className="size-5" />} label="Tickets" value="0" />
        <StatCard detail="Open tickets" icon={<LifeBuoy className="size-5" />} label="Open" value="0" />
        <StatCard detail="High priority tickets" icon={<LifeBuoy className="size-5" />} label="High Priority" value="0" />
        <StatCard detail="Resolved tickets" icon={<LifeBuoy className="size-5" />} label="Resolved" value="0" />
      </section>

      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Create Ticket</Button>
      </div>

      <EmptyState description="Create a support ticket to get help from the platform team." title="No Support Tickets" type="initial_setup" />

      <OrgOwnerDrawer description="Submit a support request to the platform team" onClose={closeDrawer} open={drawerOpen} title="Create Ticket" size="lg">
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          <DrawerField label="Subject" required>
            <input className={selectClass} name="subject" required type="text" placeholder="Brief description of the issue" />
          </DrawerField>
          <DrawerField label="Description" required>
            <textarea className={`${selectClass} min-h-[120px]`} name="description" required placeholder="Detailed explanation..." rows={5} />
          </DrawerField>
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Priority">
              <select className={selectClass} defaultValue="normal" name="priority">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </DrawerField>
            <DrawerField label="Category">
              <select className={selectClass} defaultValue="" name="category">
                <option value="">General</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="account">Account</option>
                <option value="feature">Feature Request</option>
              </select>
            </DrawerField>
          </div>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Submit Ticket</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
