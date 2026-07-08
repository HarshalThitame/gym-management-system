import type { Metadata } from "next";
import { FileText, Shield, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Tax Settings",
  description: "Manage GSTIN and tax configuration for your gym.",
  path: "/admin/tax-settings",
});

export default async function AdminTaxSettingsPage() {
  const scope = await requireGymAdminScope("/admin/tax-settings");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "multi_gstin_support",
    actionName: "admin.tax-settings.read",
  });

  const supabase = await createSupabaseServerClient();

  const { data: gym } = await supabase
    .from("gyms")
    .select("id, name, gstin")
    .eq("id", scope.gymId)
    .maybeSingle() as never as {
    data: { id: string; name: string; gstin: string | null } | null;
    error: unknown;
  };

  const { data: org } = await supabase
    .from("organizations")
    .select("gstin")
    .eq("id", organizationId)
    .maybeSingle() as never as {
    data: { gstin: string | null } | null;
    error: unknown;
  };

  const { data: branches } = await supabase
    .from("gyms")
    .select("id, name, gstin")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true }) as never as {
    data: Array<{ id: string; name: string; gstin: string | null }> | null;
    error: unknown;
  };

  const branchesWithGstin = (branches ?? []).filter((b) => b.gstin).length;
  const totalBranches = (branches ?? []).length;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Compliance</p>
        <h2 className="mt-2 text-3xl font-black">Tax Settings</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage GSTIN configuration for your gym and branches. Each branch can have its own GST number for invoicing.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Your gym" icon={<Shield className="size-5" />} label="Gym GSTIN" value={gym?.gstin ?? "Not set"} />
        <StatCard detail="Organization-level" icon={<FileText className="size-5" />} label="Organization GSTIN" value={org?.gstin ?? "Not set"} />
        <StatCard detail="Branches with GSTIN configured" icon={<UsersRound className="size-5" />} label="Branches with GSTIN" value={String(branchesWithGstin)} />
        <StatCard detail="Total branches" icon={<UsersRound className="size-5" />} label="Total Branches" value={String(totalBranches)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Your Gym</h3>
            <p className="text-sm text-muted-foreground">{gym?.name ?? "Current gym"}</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-surface-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">GSTIN</p>
              <p className="mt-1 text-lg font-black font-mono">{gym?.gstin || "Not configured"}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Update your gym's GSTIN from the organization settings portal. Each branch can have its own GST number.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">All Branches</h3>
            <p className="text-sm text-muted-foreground">GSTIN status across all branches</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {(branches ?? []).length === 0 ? (
              <EmptyState simple text="No branches found." />
            ) : (
              branches?.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
                  <span className="font-semibold">{b.name}</span>
                  <span className={`font-mono text-xs ${b.gstin ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {b.gstin || "Not set"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">How GSTIN Works</h3>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Organization GSTIN</strong> — The default GST number for your organization, set in the organization settings.</p>
          <p><strong>Branch/Gym GSTIN</strong> — Each branch can have its own GSTIN. When generating invoices, the branch-level GSTIN is used as the <code>billing_gstin</code>. If a branch has no GSTIN configured, the organization-level GSTIN is used as a fallback.</p>
          <p><strong>GSTIN Format</strong> — 15 characters: 2 digit state code + 10 digit PAN + 1 digit entity code + 1 digit blank + 1 digit check digit (e.g., <code>27AAACA1234A1Z5</code>).</p>
        </CardContent>
      </Card>
    </div>
  );
}
