import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BillingOverview } from "./billing-overview";

export default async function OrgBillingPage() {
  const context = await requireOrganizationOwner("/organization/billing");
  const supabase = await createSupabaseServerClient();

  const db = supabase as never as {
    from(t: string): {
      select(c: string): {
        eq(c: string, v: unknown): {
          single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          order(c: string, o: { ascending: boolean }): {
            limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
          };
        };
      };
    };
  };

  const [subRes, invoicesRes, methodsRes] = await Promise.all([
    db.from("organization_subscriptions").select("*").eq("organization_id", context.organizationId).single(),
    db.from("org_subscription_invoices").select("*").eq("organization_id", context.organizationId).order("created_at", { ascending: false }).limit(10),
    supabase.from("org_payment_methods").select("*").eq("organization_id", context.organizationId).order("created_at", { ascending: false }).limit(10),
  ]);

  const subscription = subRes.data as Record<string, unknown> | null;
  const invoices = (invoicesRes.data ?? []) as Array<Record<string, unknown>>;
  const methods = (methodsRes.data ?? []) as Array<Record<string, unknown>>;

  return (
    <BillingOverview
      organizationId={context.organizationId}
      subscription={subscription}
      invoices={invoices}
      paymentMethods={methods}
    />
  );
}
