import type { Metadata } from "next";
import { Building2, RefreshCcw, Search, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Corporate Accounts",
  description: "Manage corporate accounts and bulk membership enrollments.",
  path: "/admin/corporate-accounts",
});

type SearchParams = Promise<{ q?: string; page?: string }>;

const PAGE_SIZE = 20;

export default async function AdminCorporateAccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await requireGymAdminScope("/admin/corporate-accounts");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "corporate_bulk_memberships",
    actionName: "admin.corporate-accounts.read",
  });

  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const currentPage = Math.max(1, Number(params.page ?? "1"));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const searchQuery = params.q?.trim() || "";

  let query = supabase.from("corporate_accounts").select("*", { count: "exact" }).eq("organization_id", organizationId);
  if (searchQuery) query = query.ilike("company_name", `%${searchQuery}%`);

  const { data: accounts, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1) as never as {
    data: Array<{
      id: string; company_name: string; contact_person: string | null;
      contact_email: string | null; contact_phone: string | null;
      billing_email: string | null; discount_percentage: number;
      is_active: boolean; notes: string | null; created_at: string;
    }> | null;
    count: number | null;
    error: unknown;
  };

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const totalActive = (accounts ?? []).filter((a) => a.is_active).length;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Enterprise</p>
        <h2 className="mt-2 text-3xl font-black">Corporate Accounts</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Manage company tie-ups, bulk employee memberships, and corporate billing.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total corporate accounts" icon={<Building2 className="size-5" />} label="Total Accounts" value={String(count ?? 0)} />
        <StatCard detail="Active corporate accounts" icon={<RefreshCcw className="size-5" />} label="Active" value={String(totalActive)} />
        <StatCard detail="Linked employee members" icon={<UsersRound className="size-5" />} label="Employees" value="—" />
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-[1fr_auto]" method="get">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm" name="q" placeholder="Search by company name..." defaultValue={searchQuery} />
            </div>
            <button className="flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground" type="submit">Search</button>
            {searchQuery ? <a href="/admin/corporate-accounts" className="flex h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted">Clear</a> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Corporate Accounts</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!accounts || accounts.length === 0) ? (
            <EmptyState simple text={searchQuery ? "No accounts match your search." : "No corporate accounts found. Create one from the organization dashboard."} />
          ) : (
            accounts.map((acc) => (
              <div key={acc.id} className="rounded-md border border-border bg-surface-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black">{acc.company_name}</p>
                      <Badge variant={acc.is_active ? "success" : "neutral"}>{acc.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                    {acc.contact_person ? <p className="text-sm text-muted-foreground">{acc.contact_person}</p> : null}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {acc.contact_email ? <span>Email: {acc.contact_email}</span> : null}
                      {acc.contact_phone ? <span>Phone: {acc.contact_phone}</span> : null}
                      {acc.billing_email ? <span>Billing: {acc.billing_email}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                      <span>Discount: {acc.discount_percentage}%</span>
                      {acc.notes ? <span>Notes: {acc.notes.slice(0, 80)}</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <a key={i} href={`/admin/corporate-accounts?page=${i + 1}${searchQuery ? `&q=${searchQuery}` : ""}`}
                className={`flex size-10 items-center justify-center rounded-md ${i + 1 === currentPage ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {i + 1}
              </a>
            ))}
          </div>
          <span className="text-muted-foreground">{count ?? 0} total</span>
        </nav>
      )}
    </div>
  );
}
