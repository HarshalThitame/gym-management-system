import type { Metadata } from "next";
import { BarChart3, Percent, RefreshCcw, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Revenue Split",
  description: "Manage branch revenue sharing rules and view split reports.",
  path: "/admin/revenue-split",
});

export default async function AdminRevenueSplitPage() {
  const scope = await requireGymAdminScope("/admin/revenue-split");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "branch_revenue_split",
    actionName: "admin.revenue-split.read",
  });

  const supabase = await createSupabaseServerClient();

  const { data: rules } = await supabase
    .from("revenue_split_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false }) as never as {
    data: Array<{
      id: string; name: string; description: string | null;
      source_branch_id: string; target_branch_id: string;
      split_percentage: number; is_active: boolean;
    }> | null;
    error: unknown;
  };

  const branchIds = [...new Set((rules ?? []).flatMap((r) => [r.source_branch_id, r.target_branch_id]))];

  const { data: branches } = branchIds.length > 0
    ? await supabase.from("gyms").select("id, name").in("id", branchIds) as never as {
        data: Array<{ id: string; name: string }> | null;
        error: unknown;
      }
    : { data: [] as Array<{ id: string; name: string }> };

  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const totalRules = rules?.length ?? 0;
  const activeRules = (rules ?? []).filter((r) => r.is_active).length;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Finance</p>
        <h2 className="mt-2 text-3xl font-black">Revenue Split</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Configure revenue sharing rules between branches and view split reports.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total revenue split rules" icon={<BarChart3 className="size-5" />} label="Total Rules" value={String(totalRules)} />
        <StatCard detail="Currently active rules" icon={<RefreshCcw className="size-5" />} label="Active" value={String(activeRules)} />
        <StatCard detail="Rules that split incoming revenue" icon={<Percent className="size-5" />} label="Avg Split" value={activeRules > 0 ? `${Math.round((rules ?? []).filter(r => r.is_active).reduce((s, r) => s + r.split_percentage, 0) / activeRules)}%` : "—"} />
        <StatCard detail="Manage from org dashboard" icon={<TrendingUp className="size-5" />} label="Full Management" value="Org Portal" />
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Split Rules</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Manage rules from the organization dashboard for full CRUD and reporting.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!rules || rules.length === 0 ? (
            <EmptyState simple text="No revenue split rules configured. Create rules from the organization dashboard." />
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="rounded-md border border-border bg-surface-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black">{rule.name}</p>
                      <Badge variant={rule.is_active ? "success" : "neutral"}>{rule.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                    {rule.description ? <p className="text-sm text-muted-foreground">{rule.description}</p> : null}
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">
                      {branchMap.get(rule.source_branch_id) ?? "Unknown branch"} → {branchMap.get(rule.target_branch_id) ?? "Unknown branch"} &middot; {rule.split_percentage}%
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
