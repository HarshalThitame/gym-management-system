import { NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/features/billing/razorpay/razorpay-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { finalizeSubscriptionPayment } from "@/features/billing/services/finalize-subscription-payment";
import { handleMemberPaymentCaptured, handleMemberPaymentFailed } from "@/features/billing/services/member-webhook-handler";
import { logWebhookEvent } from "@/features/entitlement/audit-service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

type WebhookRow = {
  id?: string;
  status?: string;
  invoice_id?: string | null;
  organization_id?: string | null;
};

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    if (!signature) {
      await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_SIGNATURE_INVALID", providerOrderId: "unknown", detail: "Missing webhook signature" }).catch(() => {});
      return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
    }

    const sigResult = verifyRazorpayWebhookSignature({ rawBody, signature });
    if (!sigResult.isValid) {
      await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_SIGNATURE_INVALID", providerOrderId: "unknown", detail: "Invalid webhook signature" }).catch(() => {});
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const entity = parsedPayload.entity as Record<string, unknown> | undefined;
    if (!entity) {
      return NextResponse.json({ error: "Invalid webhook event structure" }, { status: 400 });
    }

    const eventId = (entity.id as string) || "";
    const eventName = (entity.event as string) || "unknown";
    const eventCreatedAt = (entity.created_at as number) || 0;

    if (eventCreatedAt > 0 && Date.now() - eventCreatedAt * 1000 > WEBHOOK_TOLERANCE_MS) {
      // stale event — still process
    }

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    // Deduplication
    if (eventId) {
      const { data: existingEvents } = await adminDb
        .from("payment_provider_events")
        .select("id, status")
        .eq("provider", "razorpay")
        .eq("provider_environment", getRazorpayEnvironment())
        .eq("event_id", eventId) as never as {
        data: WebhookRow[] | null;
        error: { message: string } | null;
      };

      const existingEvent = (existingEvents ?? [])[0];
      if (existingEvent && existingEvent.status === "processed") {
        await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_DUPLICATE", providerOrderId: eventId, detail: "Duplicate webhook event" }).catch(() => {});
        return NextResponse.json({ ok: true, status: "duplicate_skipped", eventId });
      }
    }

    const { data: webhookRow } = await adminDb
      .from("payment_provider_events")
      .insert({
        provider: "razorpay",
        provider_environment: getRazorpayEnvironment(),
        event_id: eventId,
        event_type: eventName,
        signature,
        payload: parsedPayload,
        status: "received",
        created_at: new Date().toISOString(),
      } as never)
      .select("id")
      .maybeSingle() as never as {
      data: { id: string } | null;
      error: { message: string } | null;
    };

    const webhookDbId = webhookRow?.id;

    const payloadEntity = entity.payload as Record<string, unknown> | undefined;
    const paymentEntity = (payloadEntity?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
    const orderEntity = (payloadEntity?.order as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
    const razorpayPaymentId = (paymentEntity?.id as string) || "";
    const razorpayOrderId = (paymentEntity?.order_id as string) || (orderEntity?.id as string) || "";

    let processingStatus: "received" | "processed" | "ignored" | "failed" = "processed";
    let processingError: string | null = null;

    try {
      switch (eventName) {
        case "payment.captured": {
          if (!razorpayOrderId || !razorpayPaymentId) {
            processingStatus = "ignored";
            processingError = "Missing order or payment ID";
            break;
          }

          const result = await finalizeSubscriptionPayment({
            providerOrderId: razorpayOrderId,
            providerPaymentId: razorpayPaymentId,
            providerEnvironment: getRazorpayEnvironment(),
            eventId,
          });

          if (!result.success) {
            const memberResult = await handleMemberPaymentCaptured(razorpayOrderId, razorpayPaymentId);
            if (memberResult.handled) {
              await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_CAPTURED", providerOrderId: razorpayOrderId, providerPaymentId: razorpayPaymentId }).catch(() => {});
            } else {
              processingError = result.error || "Payment finalization failed";
              processingStatus = "failed";
            }
          } else {
            await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_CAPTURED", providerOrderId: razorpayOrderId, providerPaymentId: razorpayPaymentId }).catch(() => {});
          }
          break;
        }

        case "payment.failed": {
          const failureReason = (paymentEntity?.error_description as string) || (paymentEntity?.status as string) || "Unknown";
          await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_FAILED", providerOrderId: razorpayOrderId, providerPaymentId: razorpayPaymentId, detail: failureReason }).catch(() => {});

          if (razorpayPaymentId) {
            const { data: pmts } = await adminDb
              .from("org_subscription_payments")
              .select("id, invoice_id, organization_id")
              .or(`provider_payment_id.eq.${razorpayPaymentId},provider_order_id.eq.${razorpayOrderId}`) as never as {
              data: Array<{ id: string; invoice_id: string | null; organization_id: string | null }> | null;
              error: { message: string } | null;
            };

            const pmt = (pmts ?? [])[0];
            if (pmt) {
              await adminDb.from("org_subscription_payments").update({
                status: "failed",
                failure_reason: failureReason,
              } as never).eq("id", pmt.id);

              if (pmt.invoice_id) {
                await adminDb.from("org_subscription_invoices").update({
                  status: "draft",
                } as never).eq("id", pmt.invoice_id);
              }

              await adminDb.from("subscription_events").insert({
                organization_id: pmt.organization_id || null,
                event_type: "payment_failed",
                new_state: { razorpayPaymentId, razorpayOrderId, reason: failureReason },
                metadata: { source: "webhook" },
                reason: `Webhook: payment failed - ${failureReason}`,
                created_at: new Date().toISOString(),
              } as never);
            } else {
              await handleMemberPaymentFailed(razorpayOrderId, razorpayPaymentId, failureReason);
            }
          }
          break;
        }

        case "order.paid": {
          processingStatus = "ignored";
          processingError = "Order paid but awaiting payment.captured";
          break;
        }

        default: {
          processingStatus = "ignored";
          break;
        }
      }
    } catch (err) {
      processingStatus = "failed";
      processingError = err instanceof Error ? err.message : "Webhook processing error";
    }

    if (webhookDbId) {
      await adminDb.from("payment_provider_events").update({
        status: processingStatus,
        error_message: processingError,
        processed_at: new Date().toISOString(),
      } as never).eq("id", webhookDbId);
    }

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
