import type { Metadata } from "next";
import { Calendar, Filter, Percent, Search, Tag, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CouponForm, CouponDeleteForm } from "@/features/coupons/components/coupon-forms";
import { CouponStatusBadge } from "@/features/coupons/components/coupon-status-badge";
import { formatCurrency } from "@/features/billing/lib/money";

export const metadata: Metadata = createMetadata({
  title: "Coupons & Promotions",
  description: "Manage discount coupons, promotional offers, and track usage.",
  path: "/admin/promotions"
});

type SearchParams = Promise<{ q?: string; status?: string }>;

export default async function AdminPromotionsPage({ searchParams }: { searchParams: SearchParams }) {
  const scope = await requireGymAdminScope("/admin/promotions");
  const params = await searchParams;
  const searchQuery = params.q?.trim() || "";
  const statusFilter = params.status || "";

  const supabase = await createSupabaseServerClient();

  let couponsQuery = supabase.from("coupons").select("*").eq("gym_id", scope.gymId);
  if (statusFilter === "active") couponsQuery = couponsQuery.eq("status", "active");
  else if (statusFilter === "inactive") couponsQuery = couponsQuery.eq("status", "inactive");
  else if (statusFilter === "expired") couponsQuery = couponsQuery.eq("status", "expired");

  couponsQuery = couponsQuery.order("created_at", { ascending: false });

  const { data: coupons } = await couponsQuery as never as {
    data: Array<{
      id: string; code: string; name: string; discount_type: string;
      value_amount: number; minimum_amount: number; max_discount_amount: number | null;
      usage_limit: number | null; used_count: number; expires_at: string | null;
      status: string; created_at: string;
    }> | null;
    error: unknown;
  };

  const rows = (coupons ?? []).filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.code.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const today = new Date().toISOString();
  const activeCount = rows.filter((c) => {
    if (c.status !== "active") return false;
    if (c.expires_at && c.expires_at < today) return false;
    if (c.usage_limit && c.used_count >= c.usage_limit) return false;
    return true;
  }).length;

  const expiredCount = rows.filter((c) => {
    if (c.expires_at && c.expires_at < today) return true;
    if (c.status === "expired") return true;
    return false;
  }).length;

  const totalUsage = rows.reduce((s, c) => s + c.used_count, 0);
  const hasActiveFilters = !!searchQuery || !!statusFilter;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Marketing</p>
        <h2 className="mt-2 text-3xl font-black">Coupons & Promotions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Create and manage discount coupons, track usage, and run promotional campaigns.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total coupons created" icon={<Tag className="size-5" />} label="Total Coupons" value={String(rows.length)} />
        <StatCard detail="Currently active" icon={<Percent className="size-5" />} label="Active" value={String(activeCount)} />
        <StatCard detail="Expired or inactive" icon={<Calendar className="size-5" />} label="Expired" value={String(expiredCount)} />
        <StatCard detail="Total times used" icon={<Users className="size-5" />} label="Total Usage" value={String(totalUsage)} />
      </section>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-[1fr_auto_auto]" method="get">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm" name="q" placeholder="Search by code or name..." defaultValue={searchQuery} />
            </div>
            <select className="h-11 rounded-md border border-border bg-surface px-3 text-sm" name="status" defaultValue={statusFilter || "all"}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
            <button className="flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground" type="submit">
              <Filter className="size-4" />
              Apply
            </button>
            {hasActiveFilters ? (
              <a href="/admin/promotions" className="flex h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-muted-foreground hover:bg-surface-muted">Clear</a>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-black">Coupon Library</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {hasActiveFilters ? `${rows.length} result${rows.length === 1 ? "" : "s"} — clear filters to see all` : "All coupons and promotional codes."}
                </p>
              </div>
              {rows.length > 0 ? <Badge variant="neutral">{rows.length} total</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 && !hasActiveFilters ? (
              <EmptyState simple text="No coupons created yet. Create your first coupon to get started." />
            ) : null}
            {rows.length === 0 && hasActiveFilters ? (
              <EmptyState simple text="No coupons match your search or filter criteria." />
            ) : null}
            {rows.map((coupon) => (
              <div key={coupon.id} className="rounded-lg border border-border bg-surface-muted p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-black">{coupon.name}</h4>
                      <CouponStatusBadge status={coupon.status} expiresAt={coupon.expires_at} usedCount={coupon.used_count} usageLimit={coupon.usage_limit} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">
                      Code: <span className="font-mono font-bold">{coupon.code}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {coupon.discount_type === "percentage"
                        ? `${coupon.value_amount / 100}% off`
                        : `${formatCurrency(coupon.value_amount)} off`
                      }
                      {coupon.minimum_amount > 0 && ` on min. ${formatCurrency(coupon.minimum_amount)}`}
                    </p>
                    {coupon.max_discount_amount ? (
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">Max discount: {formatCurrency(coupon.max_discount_amount)}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                      <span>Used: {coupon.used_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}</span>
                      {coupon.expires_at ? <span>Expires: {new Date(coupon.expires_at).toLocaleDateString()}</span> : null}
                    </div>
                  </div>
                </div>
                <details className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <summary className="cursor-pointer text-xs font-black text-destructive">Delete Coupon</summary>
                  <div className="mt-2"><CouponDeleteForm couponId={coupon.id} /></div>
                </details>
                  <details className="mt-2 rounded-md border border-border bg-surface p-2">
                    <summary className="cursor-pointer text-xs font-black text-foreground">Edit Coupon</summary>
                    <div className="mt-2"><CouponForm coupon={coupon} /></div>
                  </details>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Create Coupon</h3>
          </CardHeader>
          <CardContent>
            <CouponForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
