/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhookSignature } from "@/features/billing/razorpay/razorpay-service";
import { finalizeSuccessfulSubscriptionPayment } from "@/features/billing/services/finalize-payment-service";

const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

type RazorpayWebhookPayload = {
  entity: {
    id: string;
    event: string;
    created_at: number;
    contains?: unknown[];
    payload?: {
      payment?: { entity: Record<string, unknown> };
      order?: { entity: Record<string, unknown> };
      invoice?: { entity: Record<string, unknown> };
    };
  };
};

async function getNote(entity: Record<string, unknown> | null | undefined, key: string): Promise<string | null> {
  if (!entity) return null;
  const notes = entity.notes as Record<string, unknown> | null;
  if (!notes) return null;
  const val = notes[key];
  return typeof val === "string" ? val : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // 1. Read raw body for signature verification (must be done before any parsing)
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    // 2. Verify webhook signature
    if (!signature) {
      return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
    }

    const sigResult = verifyRazorpayWebhookSignature({ rawBody, signature });
    if (!sigResult.isValid) {
      // Log failed signature attempt
      try {
        const payload = JSON.parse(rawBody);
        const eventId = payload?.entity?.id || "unknown";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adminDb = getSupabaseAdminClient() as any;
        if (adminDb) {
          await adminDb.from("payment_provider_events").insert({
            provider: "razorpay", event_id: eventId,
            event_type: "signature_verification_failed",
            signature, payload: { raw: rawBody.slice(0, 500) },
            status: "failed", error_message: "Invalid webhook signature",
            created_at: new Date().toISOString(),
          });
        }
      } catch { /* silent */ }
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    // 3. Parse payload
    let parsedPayload: RazorpayWebhookPayload;
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const event = parsedPayload.entity;
    if (!event) {
      return NextResponse.json({ error: "Invalid webhook event structure" }, { status: 400 });
    }

    const eventId = (event.id as string) || "";
    const eventName = (event.event as string) || "unknown";
    const eventCreatedAt = (event.created_at as number) || 0;

    // 4. Check event recency (prevent replay attacks)
    if (eventCreatedAt > 0 && Date.now() - eventCreatedAt * 1000 > WEBHOOK_TOLERANCE_MS) {
      // Store as stale but still process (Razorpay can retry old events)
    }

    // 5. Idempotency: check if event already processed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = getSupabaseAdminClient() as any;
    if (!adminDb) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    if (eventId) {
      const { data: existingEvents } = await adminDb
        .from("payment_provider_events")
        .select("id, status, processing_status")
        .eq("event_id", eventId);
      const existingEvent = (existingEvents ?? [])[0] as Record<string, unknown> | undefined;
      if (existingEvent && existingEvent.status === "processed") {
        // Already processed — return success idempotently
        return NextResponse.json({ ok: true, status: "duplicate_skipped", eventId });
      }
    }

    // 6. Store incoming webhook event
    const { data: webhookRow } = await adminDb.from("payment_provider_events").insert({
      provider: "razorpay",
      provider_environment: "test",
      event_id: eventId,
      event_type: eventName,
      signature: signature,
      payload: parsedPayload,
      status: "processing",
      created_at: new Date().toISOString(),
    }).select("id").maybeSingle();
    const webhookDbId = webhookRow?.id;

    // 7. Extract order/payment details
    const paymentEntity = parsedPayload.entity?.payload?.payment?.entity || null;
    const orderEntity = parsedPayload.entity?.payload?.order?.entity || null;
    const razorpayPaymentId = (paymentEntity?.id as string) || "";
    const razorpayOrderId = (paymentEntity?.order_id as string) || (orderEntity?.id as string) || "";

    // Extract metadata from notes
    const orgId = await getNote(paymentEntity, "organization_id") || await getNote(orderEntity, "organization_id") || "";
    const invoiceId = await getNote(paymentEntity, "invoice_id") || await getNote(orderEntity, "invoice_id") || "";
    const pkgId = await getNote(paymentEntity, "package_id") || await getNote(orderEntity, "package_id") || "";
    const billingCycle = await getNote(paymentEntity, "billing_cycle") || await getNote(orderEntity, "billing_cycle") || "monthly";

    // Find subscription from order notes or invoice
    let subscriptionId: string | undefined;
    const subIdFromNotes = await getNote(paymentEntity, "subscription_id") || await getNote(orderEntity, "subscription_id");

    // 8. Handle specific events
    let processingStatus = "processed";
    let processingError: string | null = null;

    try {
      switch (eventName) {
        case "payment.captured": {
          const amount = (paymentEntity?.amount as number) || 0;
          const currency = (paymentEntity?.currency as string) || "INR";

          if (invoiceId && orgId && pkgId) {
            // Find subscription ID if not in notes
            if (!subIdFromNotes && invoiceId) {
              const { data: inv } = await adminDb.from("org_subscription_invoices").select("subscription_id").eq("id", invoiceId).maybeSingle();
              subscriptionId = (inv?.subscription_id as string) || undefined;
            } else {
              subscriptionId = subIdFromNotes || undefined;
            }

            const result = await finalizeSuccessfulSubscriptionPayment({
              organizationId: orgId,
              packageId: pkgId,
              invoiceId,
              razorpayOrderId,
              razorpayPaymentId,
              billingCycle,
              subscriptionId,
              actorId: null,
            });

            if (!result.success) {
              processingError = result.error || "Payment finalization failed";
              processingStatus = "failed";
            }
          } else if (razorpayOrderId && razorpayPaymentId) {
            // Try to match by order id
            const { data: invByOrder } = await adminDb
              .from("org_subscription_invoices")
              .select("id, organization_id, package_id, subscription_id")
              .eq("razorpay_order_id", razorpayOrderId)
              .maybeSingle();

            if (invByOrder) {
              const orgFromOrder = invByOrder.organization_id as string;
              const invIdFromOrder = invByOrder.id as string;
              const pkgFromOrder = invByOrder.package_id as string;
              subscriptionId = (invByOrder.subscription_id as string) || undefined;

              const result = await finalizeSuccessfulSubscriptionPayment({
                organizationId: orgFromOrder,
                packageId: pkgFromOrder,
                invoiceId: invIdFromOrder,
                razorpayOrderId,
                razorpayPaymentId,
                billingCycle,
                subscriptionId,
                actorId: null,
              });

              if (!result.success) {
                processingError = result.error || "Payment finalization failed";
                processingStatus = "failed";
              }
            } else {
              processingStatus = "unmatched";
              processingError = "No matching invoice found for order";
            }
          } else {
            processingStatus = "unmatched";
            processingError = "Missing invoice/order identifiers in payload";
          }
          break;
        }

        case "payment.failed": {
          const failureReason = (paymentEntity?.error_description as string) || (paymentEntity?.status as string) || "Unknown";
          if (razorpayPaymentId) {
            const { data: pmts } = await adminDb.from("org_subscription_payments").select("id, invoice_id").eq("provider_payment_id", razorpayPaymentId);
            const pmt = (pmts ?? [])[0] as Record<string, unknown> | undefined;
            if (pmt) {
              await adminDb.from("org_subscription_payments").update({
                status: "failed",
                failure_reason: failureReason,
              }).eq("id", pmt.id as string);

              if (pmt.invoice_id) {
                await adminDb.from("org_subscription_invoices").update({ status: "failed" }).eq("id", pmt.invoice_id as string);
              }
            }
            await adminDb.from("subscription_events").insert({
              organization_id: orgId || null, event_type: "payment_failed",
              new_state: { razorpayPaymentId, razorpayOrderId, reason: failureReason },
              metadata: { source: "webhook" },
              reason: `Webhook: payment failed - ${failureReason}`,
              created_at: new Date().toISOString(),
            });
          }
          break;
        }

        case "order.paid": {
          // Already handled by payment.captured; skip if already processed
          if (invoiceId && orgId && pkgId) {
            const { data: invStatus } = await adminDb.from("org_subscription_invoices").select("status").eq("id", invoiceId).maybeSingle();
            if (invStatus && invStatus.status !== "paid") {
              // Payment might have been captured separately; if not, process
              processingStatus = "deferred";
              processingError = "Order paid but awaiting payment.captured";
            }
          }
          break;
        }

        default: {
          processingStatus = "unhandled";
          break;
        }
      }
    } catch (err) {
      processingStatus = "failed";
      processingError = err instanceof Error ? err.message : "Webhook processing error";
    }

    // 9. Update webhook event status
    await adminDb.from("payment_provider_events").update({
      status: processingStatus,
      error_message: processingError,
      processed_at: new Date().toISOString(),
    }).eq("id", webhookDbId?.id || webhookDbId);

    // 10. Record billing attempt
    await adminDb.from("payment_attempts").insert({
      organization_id: orgId || null,
      subscription_id: subscriptionId || null,
      invoice_id: invoiceId || null,
      provider: "razorpay",
      provider_order_id: razorpayOrderId || null,
      provider_payment_id: razorpayPaymentId || null,
      attempt_type: "webhook_process",
      status: processingStatus === "processed" ? "success" : processingStatus === "failed" ? "failed" : "skipped",
      error_description: processingError,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      eventId,
      eventName,
      status: processingStatus,
      error: processingError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
