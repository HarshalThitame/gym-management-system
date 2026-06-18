import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhookSignature } from "@/features/billing/razorpay/razorpay-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { finalizeSubscriptionPayment } from "@/features/billing/services/finalize-subscription-payment";
import { logWebhookEvent } from "@/features/entitlement/audit-service";

const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

type WebhookRow = {
  id?: string;
  status?: string;
  invoice_id?: string | null;
  organization_id?: string | null;
};

type WebhookSelectQuery = PromiseLike<{ data: WebhookRow[] | null; error: { message: string } | null }> & {
  eq(column: string, value: unknown): WebhookSelectQuery;
  or(filter: string): WebhookSelectQuery;
};

type WebhookInsertQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select(columns: string): {
    maybeSingle(): Promise<{ data: WebhookRow | null; error: { message: string } | null }>;
  };
};

type WebhookUpdateQuery = {
  eq(column: string, value: unknown): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type WebhookDb = {
  from(table: string): {
    select(columns: string): WebhookSelectQuery;
    insert(row: Record<string, unknown>): WebhookInsertQuery;
    update(row: Record<string, unknown>): WebhookUpdateQuery;
  };
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
      try {
        const payload = JSON.parse(rawBody);
        const eventId = payload?.entity?.id || "unknown";
        const adminDb = getSupabaseAdminClient();
        if (adminDb) {
          const webhookDb = adminDb as unknown as WebhookDb;
          await webhookDb.from("payment_provider_events").insert({
            provider: "razorpay",
            provider_environment: getRazorpayEnvironment(),
            event_id: eventId,
            event_type: "signature_verification_failed",
            signature,
            payload: { raw: rawBody.slice(0, 500) },
            status: "failed",
            error_message: "Invalid webhook signature",
            created_at: new Date().toISOString(),
          });
        }
      } catch {
        /* silent */
      }
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
      // stale event, still process
    }

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
    const d = adminDb as unknown as WebhookDb;

    if (eventId) {
      const { data: existingEvents } = await d
        .from("payment_provider_events")
        .select("id, status")
        .eq("provider", "razorpay")
        .eq("provider_environment", getRazorpayEnvironment())
        .eq("event_id", eventId);

      const existingEvent = (existingEvents ?? [])[0];
      if (existingEvent && existingEvent.status === "processed") {
        await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_DUPLICATE", providerOrderId: eventId, detail: "Duplicate webhook event" }).catch(() => {});
        return NextResponse.json({ ok: true, status: "duplicate_skipped", eventId });
      }
    }

    const { data: webhookRow } = await d.from("payment_provider_events").insert({
      provider: "razorpay",
      provider_environment: getRazorpayEnvironment(),
      event_id: eventId,
      event_type: eventName,
      signature: signature,
      payload: parsedPayload,
      status: "received",
      created_at: new Date().toISOString(),
    }).select("id").maybeSingle();

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
            processingError = result.error || "Payment finalization failed";
            processingStatus = "failed";
          } else {
            await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_CAPTURED", providerOrderId: razorpayOrderId, providerPaymentId: razorpayPaymentId }).catch(() => {});
            if (webhookDbId) {
              await d.from("payment_provider_events").update({
                invoice_id: result.invoiceId || null,
                subscription_id: result.subscriptionId || null,
              }).eq("id", webhookDbId);
            }
          }
          break;
        }

        case "payment.failed": {
          const failureReason = (paymentEntity?.error_description as string) || (paymentEntity?.status as string) || "Unknown";
          await logWebhookEvent({ actorId: null, organizationId: null, eventType: "WEBHOOK_FAILED", providerOrderId: razorpayOrderId, providerPaymentId: razorpayPaymentId, detail: failureReason }).catch(() => {});
          if (razorpayPaymentId) {
            let paymentQuery = d
              .from("org_subscription_payments")
              .select("id, invoice_id, organization_id")
              .eq("provider_payment_id", razorpayPaymentId);
            if (razorpayOrderId) {
              paymentQuery = d
                .from("org_subscription_payments")
                .select("id, invoice_id, organization_id")
                .or(`provider_payment_id.eq.${razorpayPaymentId},provider_order_id.eq.${razorpayOrderId}`);
            }
            const { data: pmts } = await paymentQuery;

            const pmt = (pmts ?? [])[0];
            if (pmt) {
              await d.from("org_subscription_payments").update({
                status: "failed",
                failure_reason: failureReason,
              }).eq("id", pmt.id);

              if (pmt.invoice_id) {
                await d.from("org_subscription_invoices").update({
                  status: "draft",
                }).eq("id", pmt.invoice_id);
              }

              await d.from("subscription_events").insert({
                organization_id: pmt.organization_id || null,
                event_type: "payment_failed",
                new_state: { razorpayPaymentId, razorpayOrderId, reason: failureReason },
                metadata: { source: "webhook" },
                reason: `Webhook: payment failed - ${failureReason}`,
                created_at: new Date().toISOString(),
              });
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
      await d.from("payment_provider_events").update({
        status: processingStatus,
        error_message: processingError,
        processed_at: new Date().toISOString(),
      }).eq("id", webhookDbId);
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
