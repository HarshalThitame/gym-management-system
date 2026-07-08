import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InvoicesData = Array<{
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
  paidAt: string | null;
  pdfUrl: string | null;
}>;

export type PaymentMethodData = {
  id: string;
  type: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  brand: string;
} | null;

export type PlanServerData = {
  invoices: InvoicesData;
  paymentMethod: PaymentMethodData;
  usageHistory: Array<{ date: string; members: number; branches: number; storageMb: number }>;
  availableAddons: Array<{ name: string; description: string; price: number; category: string }>;
  currentAddons: Array<{ name: string; assignedAt: string; price: number }>;
  autoRenew: boolean;
};

export async function getPlanServerData(organizationId: string): Promise<PlanServerData> {
  const supabase = await createSupabaseServerClient();

  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("id, auto_renew, started_at, package_id")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionId = (sub as Record<string, unknown> | null)?.id as string | undefined;
  const autoRenew = (sub as Record<string, unknown> | null)?.auto_renew === true;

  const { data: invoices } = await supabase
    .from("org_subscription_invoices")
    .select("id, invoice_number, total_amount, currency, status, issued_at, paid_at, razorpay_order_id")
    .eq("organization_id", organizationId)
    .order("issued_at", { ascending: false })
    .limit(12) as never as {
    data: Array<{
      id: string; invoice_number: string; total_amount: number; currency: string;
      status: string; issued_at: string; paid_at: string | null; razorpay_order_id: string | null;
    }> | null;
    error: { message: string } | null;
  };

  const invoicesData: InvoicesData = (invoices ?? []).map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    amount: inv.total_amount,
    currency: inv.currency || "INR",
    status: inv.status,
    issuedAt: inv.issued_at,
    paidAt: inv.paid_at,
    pdfUrl: null,
  }));

  const { data: pmtMethods } = await supabase
    .from("org_payment_methods")
    .select("id, payment_type, last_four, expiry_month, expiry_year, is_default, card_network")
    .eq("organization_id", organizationId)
    .order("is_default", { ascending: false })
    .limit(1) as never as {
    data: Array<{
      id: string; payment_type: string; last_four: string | null;
      expiry_month: number | null; expiry_year: number | null; is_default: boolean;
      card_network: string | null;
    }> | null;
    error: { message: string } | null;
  };

  const pmt = (pmtMethods ?? [])[0] ?? null;
  const paymentMethodData: PaymentMethodData = pmt
    ? {
        id: pmt.id,
        type: pmt.payment_type,
        last4: pmt.last_four ?? "0000",
        expiryMonth: pmt.expiry_month ?? 0,
        expiryYear: pmt.expiry_year ?? 0,
        isDefault: pmt.is_default,
        brand: pmt.card_network ?? pmt.payment_type,
      }
    : null;

  const { data: addons } = await supabase
    .from("package_addons")
    .select("name, description, price_amount, category")
    .order("name") as never as {
    data: Array<{ name: string; description: string; price_amount: number; category: string }> | null;
    error: { message: string } | null;
  };

  const availableAddons: PlanServerData["availableAddons"] = (addons ?? []).map((a) => ({
    name: a.name,
    description: a.description,
    price: a.price_amount,
    category: a.category || "general",
  }));

  let currentAddons: PlanServerData["currentAddons"] = [];
  if (subscriptionId) {
    const { data: assignedAddons } = await supabase
      .from("subscription_addons")
      .select("id, addon_name, price_amount, assigned_at")
      .eq("subscription_id", subscriptionId) as never as {
      data: Array<{ id: string; addon_name: string; price_amount: number; assigned_at: string }> | null;
      error: { message: string } | null;
    };

    currentAddons = (assignedAddons ?? []).map((a) => ({
      name: a.addon_name,
      assignedAt: a.assigned_at,
      price: a.price_amount,
    }));
  }

  const branchMetrics = await supabase
    .from("branch_metrics")
    .select("*")
    .eq("organization_id", organizationId)
    .order("metric_date" as never, { ascending: false })
    .limit(6)
    .then((r) => r.data as unknown as Array<Record<string, unknown>> | null);

  const usageHistory: PlanServerData["usageHistory"] = [];
  const seenMonths = new Set<string>();

  const { count: branchCount } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId) as never as {
    count: number | null;
  };

  for (const m of branchMetrics ?? []) {
    const month = (m.metric_date as string)?.slice(0, 7);
    if (!month || seenMonths.has(month)) continue;
    seenMonths.add(month);
    const monthData = (branchMetrics ?? []).filter((bm) => (bm.metric_date as string)?.startsWith(month));
    usageHistory.push({
      date: month,
      members: Math.max(0, ...monthData.map((bm) => Number((bm as Record<string, unknown>).active_members ?? 0))),
      branches: branchCount ?? 0,
      storageMb: Math.max(0, ...monthData.map((bm) => Number((bm as Record<string, unknown>).storage_mb ?? 0))),
    });
  }

  return {
    invoices: invoicesData,
    paymentMethod: paymentMethodData,
    usageHistory: usageHistory.reverse(),
    availableAddons,
    currentAddons,
    autoRenew,
  };
}
