import { NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature } from "@/features/billing/razorpay/razorpay-service";
import { getRazorpayEnvironment } from "@/features/billing/razorpay/razorpay-config";
import { finalizeSubscriptionPayment } from "@/features/billing/services/finalize-subscription-payment";
import { handleMemberPaymentCaptured, handleMemberPaymentFailed } from "@/features/billing/services/member-webhook-handler";
import {
  handleOrgSubscriptionActivatedEvent,
  handleOrgSubscriptionChargedEvent,
  handleOrgSubscriptionChargeFailedEvent,
} from "@/features/billing/services/org-subscription-autodebit-service";
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
    const subscriptionEntity = (payloadEntity?.subscription as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
    const razorpayPaymentId = (paymentEntity?.id as string) || "";
    const razorpayOrderId = (paymentEntity?.order_id as string) || (orderEntity?.id as string) || "";
    const razorpaySubscriptionId = (subscriptionEntity?.id as string) || (paymentEntity?.subscription_id as string) || "";

    let processingStatus: "received" | "processed" | "ignored" | "failed" = "processed";
    let processingError: string | null = null;

    try {
      switch (eventName) {
        case "payment.captured": {
          if (razorpaySubscriptionId) {
            const { data: matchingOrgSub } = await adminDb
              .from("organization_subscriptions")
              .select("id")
              .eq("provider_subscription_id", razorpaySubscriptionId)
              .maybeSingle() as never as {
              data: { id: string } | null;
              error: { message: string } | null;
            };

            if (matchingOrgSub && razorpayPaymentId) {
              const orgResult = await handleOrgSubscriptionChargedEvent({
                providerSubscriptionId: razorpaySubscriptionId,
                providerPaymentId: razorpayPaymentId,
                providerOrderId: razorpayOrderId || null,
                providerEnvironment: getRazorpayEnvironment(),
                eventId,
                payload: parsedPayload,
              });
              if (!orgResult.handled) {
                processingStatus = "failed";
                processingError = orgResult.error || "Organization subscription charge processing failed";
              }
              break;
            }
          }

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
              if (razorpaySubscriptionId) {
                const orgResult = await handleOrgSubscriptionChargeFailedEvent({
                  providerSubscriptionId: razorpaySubscriptionId,
                  failureReason,
                  providerEnvironment: getRazorpayEnvironment(),
                  eventId,
                  providerPaymentId: razorpayPaymentId || null,
                });
                if (!orgResult.handled) {
                  processingStatus = "failed";
                  processingError = orgResult.error || "Organization subscription failure processing failed";
                }
              } else {
                await handleMemberPaymentFailed(razorpayOrderId, razorpayPaymentId, failureReason);
              }
            }
          }
          break;
        }

        case "subscription.activated": {
          if (!razorpaySubscriptionId) {
            processingStatus = "ignored";
            processingError = "Missing subscription ID";
            break;
          }
          const orgResult = await handleOrgSubscriptionActivatedEvent({
            providerSubscriptionId: razorpaySubscriptionId,
            providerEnvironment: getRazorpayEnvironment(),
            eventId,
            payload: parsedPayload,
          });
          if (!orgResult.handled) {
            processingStatus = "failed";
            processingError = orgResult.error || "Subscription activation processing failed";
          }
          break;
        }

        case "subscription.charged": {
          if (!razorpaySubscriptionId || !razorpayPaymentId) {
            processingStatus = "ignored";
            processingError = "Missing subscription or payment ID";
            break;
          }
          const orgResult = await handleOrgSubscriptionChargedEvent({
            providerSubscriptionId: razorpaySubscriptionId,
            providerPaymentId: razorpayPaymentId,
            providerOrderId: razorpayOrderId || null,
            providerEnvironment: getRazorpayEnvironment(),
            eventId,
            payload: parsedPayload,
          });
          if (!orgResult.handled) {
            processingStatus = "failed";
            processingError = orgResult.error || "Organization subscription charge processing failed";
          }
          break;
        }

        case "subscription.charged.failed": {
          if (!razorpaySubscriptionId) {
            processingStatus = "ignored";
            processingError = "Missing subscription ID";
            break;
          }
          const failureDesc = (payloadEntity?.error as Record<string, unknown> | undefined)?.description as string
            || (payloadEntity?.error as Record<string, unknown> | undefined)?.reason as string
            || "Subscription charge failed";
          const orgResult = await handleOrgSubscriptionChargeFailedEvent({
            providerSubscriptionId: razorpaySubscriptionId,
            failureReason: failureDesc,
            providerEnvironment: getRazorpayEnvironment(),
            eventId,
            providerPaymentId: razorpayPaymentId || null,
          });
          if (!orgResult.handled) {
            processingStatus = "failed";
            processingError = orgResult.error || "Organization subscription failure processing failed";
          }
          break;
        }

        case "subscription.cancelled": {
          if (!razorpaySubscriptionId) {
            processingStatus = "ignored";
            processingError = "Missing subscription ID";
            break;
          }
          const { data: subs } = await adminDb
            .from("organization_subscriptions")
            .select("id, organization_id, cancelled_at")
            .eq("provider_subscription_id", razorpaySubscriptionId) as never as {
            data: Array<{ id: string; organization_id: string; cancelled_at: string | null }> | null;
            error: { message: string } | null;
          };
          const sub = (subs ?? [])[0];
          if (sub) {
            const now = new Date().toISOString();
            await adminDb.from("organization_subscriptions").update({
              status: "cancelled",
              auto_renew: false,
              cancelled_at: sub.cancelled_at ?? now,
              updated_at: now,
            } as never).eq("id", sub.id);
            await logWebhookEvent({ actorId: null, organizationId: sub.organization_id, eventType: "WEBHOOK_CAPTURED", providerOrderId: razorpaySubscriptionId, detail: "Subscription cancelled" }).catch(() => {});
            await adminDb.from("subscription_events").insert({
              organization_id: sub.organization_id,
              subscription_id: sub.id,
              event_type: "subscription_cancelled",
              new_state: { providerSubscriptionId: razorpaySubscriptionId, cancelledAt: sub.cancelled_at ?? now },
              metadata: { source: "webhook", providerEnvironment: getRazorpayEnvironment(), eventId },
              reason: "Razorpay subscription cancelled.",
              created_at: now,
            } as never);
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
