import type { Metadata } from "next";
import { BriefcaseBusiness, Clock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StaffProfileForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { listStaffProfiles } from "@/features/training/services/training-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Staff Operations",
  description: "Manage reception staff, managers, support staff, employment status, and operational access records.",
  path: "/admin/staff"
});

export default async function AdminStaffPage() {
  const scope = await requireGymAdminScope("/admin/staff");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "staff_management", actionName: "admin.staff.read" });
  const staff = await listStaffProfiles(scope.gymId);
  const activeStaff = staff.filter((profile) => profile.status === "active");
  const receptionStaff = staff.filter((profile) => profile.staff_role === "reception");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Staff Operations</p>
        <h2 className="mt-2 text-3xl font-black">Staff profiles and employment controls</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Track managers, reception staff, support staff, employment status, and linked Supabase users for operational accountability.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Current staff records" icon={<BriefcaseBusiness className="size-5" />} label="Active Staff" value={String(activeStaff.length)} />
        <StatCard detail="Front desk operating users" icon={<Clock className="size-5" />} label="Reception" value={String(receptionStaff.length)} />
        <StatCard detail="Profiles governed by admin RBAC" icon={<ShieldCheck className="size-5" />} label="Access Control" value="RBAC" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Staff Directory</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {staff.map((profile) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={profile.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-black">{profile.full_name}</h4>
                      <TrainingStatusBadge status={profile.status} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{profile.employee_code} · {profile.staff_role} · {profile.employment_type}</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{profile.phone ?? "No phone"} · joined {profile.joined_at}</p>
                  </div>
                </div>
              </div>
            ))}
            {staff.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No staff profiles created yet.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Create Staff Profile</h3>
          </CardHeader>
          <CardContent>
            <StaffProfileForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
