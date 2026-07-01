import type { Metadata } from "next";
import { Tag, Percent, Calendar, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getCouponDashboard } from "@/features/coupons/services/coupon-service";
import { CouponForm, CouponDeleteForm } from "@/features/coupons/components/coupon-forms";
import { CouponStatusBadge } from "@/features/coupons/components/coupon-status-badge";
import { formatCurrency } from "@/features/billing/lib/money";

export const metadata: Metadata = createMetadata({
  title: "Coupons & Promotions",
  description: "Manage discount coupons, promotional offers, and track usage.",
  path: "/admin/promotions"
});

export default async function AdminPromotionsPage() {
  const scope = await requireGymAdminScope("/admin/promotions");
  const dashboard = await getCouponDashboard(scope.gymId);

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
        <StatCard
          detail="Total coupons created"
          icon={<Tag className="size-5" />}
          label="Total Coupons"
          value={String(dashboard.metrics.totalCoupons)}
        />
        <StatCard
          detail="Currently active"
          icon={<Percent className="size-5" />}
          label="Active"
          value={String(dashboard.metrics.activeCoupons)}
        />
        <StatCard
          detail="Expired or inactive"
          icon={<Calendar className="size-5" />}
          label="Expired"
          value={String(dashboard.metrics.expiredCoupons)}
        />
        <StatCard
          detail="Total times used"
          icon={<Users className="size-5" />}
          label="Total Usage"
          value={String(dashboard.metrics.totalUsage)}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Coupon Library</h3>
            <p className="text-sm leading-6 text-muted-foreground">All coupons and promotional codes.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.coupons.length === 0 ? (
              <EmptyState simple text="No coupons created yet. Create your first coupon to get started." />
            ) : (
              dashboard.coupons.map((coupon) => (
                <div key={coupon.id} className="rounded-lg border border-border bg-surface-muted p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black">{coupon.name}</h4>
                        <CouponStatusBadge 
                          status={coupon.status} 
                          expiresAt={coupon.expires_at}
                          usedCount={coupon.used_count}
                          usageLimit={coupon.usage_limit}
                        />
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
                      {coupon.max_discount_amount && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Max discount: {formatCurrency(coupon.max_discount_amount)}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                        <span>Used: {coupon.used_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}</span>
                        {coupon.expires_at && (
                          <span>Expires: {new Date(coupon.expires_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <details className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    <summary className="cursor-pointer text-xs font-black text-destructive">Delete Coupon</summary>
                    <div className="mt-2">
                      <CouponDeleteForm couponId={coupon.id} />
                    </div>
                  </details>
                </div>
              ))
            )}
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
