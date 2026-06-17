import { NextResponse } from "next/server";
import { runSubscriptionBilling } from "@/features/billing/services/subscription-billing-service";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSubscriptionBilling();

  const actions: string[] = [];
  if (result.invoiceGenerated > 0) actions.push(`Generated ${result.invoiceGenerated} invoice(s)`);
  if (result.ordersCreated > 0) actions.push(`Created ${result.ordersCreated} Razorpay order(s)`);
  if (result.emailsSent > 0) actions.push(`Sent ${result.emailsSent} invoice email(s)`);
  if (result.errors.length > 0) actions.push(`${result.errors.length} error(s) occurred`);
  if (actions.length === 0) actions.push("No actions taken");

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    actions,
    stats: {
      invoicesGenerated: result.invoiceGenerated,
      ordersCreated: result.ordersCreated,
      emailsSent: result.emailsSent,
      errors: result.errors.length,
    },
    errors: result.errors.length > 0 ? result.errors : undefined,
  });
}
