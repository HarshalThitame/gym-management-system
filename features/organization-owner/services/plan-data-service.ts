import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

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

  // Fetch subscription with auto-renew
  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("id, auto_renew, started_at")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch branch metrics aggregated by month for usage trend
  const branchMetrics = await supabase
    .from("branch_metrics")
    .select("*")
    .eq("organization_id", organizationId)
    .order("metric_date" as never, { ascending: false })
    .limit(6)
    .then((r) => r.data as unknown as Array<Record<string, unknown>> | null);

  // Build usage history from branch metrics (last 6 months)
  const usageHistory: PlanServerData["usageHistory"] = [];
  const seenMonths = new Set<string>();
  for (const m of branchMetrics ?? []) {
    const month = (m.metric_date as string)?.slice(0, 7);
    if (!month || seenMonths.has(month)) continue;
    seenMonths.add(month);
    const monthData = (branchMetrics ?? []).filter((bm) => (bm.metric_date as string)?.startsWith(month));
    usageHistory.push({
      date: month,
      members: Math.max(0, ...monthData.map((bm) => Number((bm as Record<string, unknown>).active_members ?? 0))),
      branches: 0,
      storageMb: Math.max(0, ...monthData.map((bm) => Number((bm as Record<string, unknown>).storage_mb ?? 0)))
    });
  }

  // Mock invoices (in production, fetch from Razorpay)
  const invoices: InvoicesData = [];

  // Mock payment method
  const paymentMethod: PaymentMethodData = null;

  // Available add-ons in the marketplace
  const availableAddons = [
    { name: "SMS Credits (1000)", description: "1,000 SMS credits for member communications", price: 499, category: "communications" },
    { name: "WhatsApp API", description: "WhatsApp Business API integration for campaigns", price: 999, category: "communications" },
    { name: "Biometric Hardware Support", description: "Fingerprint scanner integration support", price: 1999, category: "attendance" },
    { name: "Advanced Analytics", description: "Custom reports, cohort analysis, and BI dashboards", price: 2999, category: "analytics" },
    { name: "Additional Storage (10GB)", description: "10 GB additional cloud storage for media", price: 499, category: "storage" },
    { name: "Priority Support", description: "24/7 priority support with 1-hour SLA", price: 2999, category: "support" },
  ];

  return {
    invoices,
    paymentMethod,
    usageHistory: usageHistory.reverse(),
    availableAddons,
    currentAddons: [],
    autoRenew: (sub as unknown as { auto_renew?: boolean })?.auto_renew ?? true,
  };
}
