import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { checkRateLimitWithEnv } from "@/lib/rate-limiter";
import {
  getBillingSummary,
  getDetailedBillingData,
  getCreditNotes,
  getWriteOffs,
  getDisputes,
  getReconciliationEntries,
  getRevenueRecognitionEntries,
  getOrgSubscriptionInvoices,
  getOrgSubscriptionPayments,
  getSubscriptionRevenueMetrics,
} from "@/features/billing/services/billing-admin-service";

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimitWithEnv(`billing-dashboard:${ip}`, "billing_dashboard");
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const section = req.nextUrl.searchParams.get("section") ?? "summary";

  try {
    switch (section) {
      case "summary": {
        const [memberSummary, subMetrics] = await Promise.all([
          getBillingSummary(),
          getSubscriptionRevenueMetrics(),
        ]);
        return NextResponse.json({ ...memberSummary, subscriptionRevenue: subMetrics });
      }
      case "detailed": {
        const data = await getDetailedBillingData();
        return NextResponse.json(data);
      }
      case "credit_notes": {
        const data = await getCreditNotes({ limit: 50 });
        return NextResponse.json(data);
      }
      case "write_offs": {
        const data = await getWriteOffs({ limit: 50 });
        return NextResponse.json(data);
      }
      case "disputes": {
        const data = await getDisputes({ limit: 50 });
        return NextResponse.json(data);
      }
      case "reconciliation": {
        const data = await getReconciliationEntries({ limit: 50 });
        return NextResponse.json(data);
      }
      case "revenue_recognition": {
        const data = await getRevenueRecognitionEntries({ limit: 50 });
        return NextResponse.json(data);
      }
      case "subscription_invoices": {
        const data = await getOrgSubscriptionInvoices({ limit: 50 });
        return NextResponse.json(data);
      }
      case "subscription_payments": {
        const data = await getOrgSubscriptionPayments({ limit: 50 });
        return NextResponse.json(data);
      }
      default:
        return NextResponse.json({ error: "Unknown section" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
