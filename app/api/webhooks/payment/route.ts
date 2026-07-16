import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { billingLogger } from "@/features/billing/lib/logger";
import { getProviderForGym } from "@/features/billing/providers/provider-registry";
import type { IPaymentProvider } from "@/features/billing/providers/provider-types";
import { handleMemberPaymentCaptured, handleMemberPaymentFailed } from "@/features/billing/services/member-webhook-handler";
import { finalizeSubscriptionPayment } from "@/features/billing/services/finalize-subscription-payment";
import { getRazorpayProvider } from "@/features/billing/razorpay/razorpay-provider-adapter";

type ProviderEventRow = {
  id?: string;
  status?: string;
  invoice_id?: string | null;
  subscription_id?: string | null;
};

export async function handlePaymentWebhook(request: Request): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();
    const url = new URL(request.url);

    const providerFromQuery = url.searchParams.get("provider") || "";
    const providerHeader = request.headers.get("x-payment-provider") || "";

    const isPayuWebhook = providerFromQuery === "payu" || providerHeader === "payu";

    // Detect provider
    let provider: "razorpay" | "payu";
    let signature: string;
    let parsedPayload: Record<string, unknown>;
    let eventId: string;
    let eventName: string;

    if (isPayuWebhook) {
      provider = "payu";
      // PayU sends form-encoded POST data
      const formData: Record<string, string> = {};
      try {
        const params = new URLSearchParams(rawBody);
        for (const [key, value] of params) {
          formData[key] = value;
        }
      } catch {
        // try JSON
      }

      try {
        parsedPayload = Object.keys(formData).length > 0
          ? formData as unknown as Record<string, unknown>
          : JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      signature = (parsedPayload.hash as string) || "";
      eventId = (parsedPayload.mihpayid as string) || (parsedPayload.txnid as string) || `payu_${Date.now()}`;
      eventName = (parsedPayload.status as string) === "success" ? "payment.captured" : "payment.failed";
    } else {
      provider = "razorpay";
      signature = request.headers.get("x-razorpay-signature") || "";

      if (!signature) {
        return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
      }

      try {
        parsedPayload = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
      }

      const entity = parsedPayload.entity as Record<string, unknown> | undefined;
      if (!entity) {
        return NextResponse.json({ error: "Invalid webhook event structure" }, { status: 400 });
      }

      eventId = (entity.id as string) || "";
      eventName = (entity.event as string) || "unknown";
    }

    if (!eventId) {
      return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
    }

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    const providerResult = await resolveWebhookProvider({
      adminDb,
      provider,
      eventName,
      parsedPayload,
    });
    if (!providerResult.ok) {
      billingLogger.error("webhook.payment", "Provider not available for webhook verification", { provider, reason: providerResult.message });
      return NextResponse.json({ error: providerResult.message }, { status: 500 });
    }

    const isValid = await providerResult.provider.verifyWebhookSignature({ rawBody, signature });
    if (!isValid) {
      billingLogger.warn("webhook.payment", "Invalid webhook signature", { provider, eventId });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Deduplication
    const { data: existingEvents } = await adminDb
      .from("payment_provider_events")
      .select("id, status")
      .eq("provider", provider)
      .eq("event_id", eventId) as never as {
      data: ProviderEventRow[] | null;
      error: unknown;
    };

    const existingEvent = (existingEvents ?? [])[0];
    if (existingEvent && existingEvent.status === "processed") {
      return NextResponse.json({ ok: true, status: "duplicate_skipped", eventId });
    }

    // Insert webhook event
    const { data: inserted } = await adminDb
      .from("payment_provider_events")
      .insert({
        provider,
        provider_environment: providerResult.provider.getEnvironment(),
        event_id: eventId,
        event_type: eventName,
        payload: parsedPayload,
        status: "received",
        created_at: new Date().toISOString(),
      } as never)
      .select("id")
      .maybeSingle() as never as {
      data: { id: string } | null;
      error: unknown;
    };

    const webhookDbId = inserted?.id;

    let processingStatus: "received" | "processed" | "ignored" | "failed" = "processed";
    let processingError: string | null = null;

    try {
      if (provider === "payu") {
        const payuPayload = parsedPayload as Record<string, string>;
        const providerPaymentId = payuPayload.mihpayid || payuPayload.payuMoneyId || "";
        const providerOrderId = payuPayload.txnid || "";
        const payuStatus = payuPayload.status || "";

        if (payuStatus === "success" || payuStatus === "completed") {
          if (!providerOrderId || !providerPaymentId) {
            processingStatus = "ignored";
            processingError = "Missing transaction details";
          } else {
            const memberResult = await handleMemberPaymentCaptured(providerOrderId, providerPaymentId);
            if (!memberResult.handled) {
              processingError = memberResult.error || "Payment processing failed";
              processingStatus = "failed";
            }
          }
        } else {
          const failureReason = payuPayload.error_Message || payuPayload.unmappedstatus || "PayU payment failed";
          if (providerPaymentId) {
            await handleMemberPaymentFailed(providerOrderId, providerPaymentId, failureReason);
          }
        }
      } else {
        const entity = parsedPayload.entity as Record<string, unknown> | undefined;
        const payloadEntity = entity?.payload as Record<string, unknown> | undefined;
        const paymentEntity = (payloadEntity?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
        const orderEntity = (payloadEntity?.order as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
        const razorpayPaymentId = (paymentEntity?.id as string) || "";
        const razorpayOrderId = (paymentEntity?.order_id as string) || (orderEntity?.id as string) || "";

        switch (eventName) {
          case "payment.captured": {
            if (!razorpayOrderId || !razorpayPaymentId) {
              processingStatus = "ignored";
              processingError = "Missing order or payment ID";
              break;
            }

            const subscriptionResult = await finalizeSubscriptionPayment({
              providerOrderId: razorpayOrderId,
              providerPaymentId: razorpayPaymentId,
              providerEnvironment: providerResult.provider.getEnvironment(),
              eventId,
            });

            if (!subscriptionResult.success) {
              const memberResult = await handleMemberPaymentCaptured(razorpayOrderId, razorpayPaymentId);
              if (!memberResult.handled) {
                processingError = subscriptionResult.error || "Payment finalization failed";
                processingStatus = "failed";
              }
            }
            break;
          }

          case "payment.failed": {
            const failureReason = (paymentEntity?.error_description as string) || (paymentEntity?.status as string) || "Unknown";
            if (razorpayPaymentId) {
              const { data: pmts } = await adminDb
                .from("org_subscription_payments")
                .select("id, invoice_id, organization_id")
                .or(`provider_payment_id.eq.${razorpayPaymentId},provider_order_id.eq.${razorpayOrderId}`) as never as {
                data: Array<{ id: string; invoice_id: string | null; organization_id: string | null }> | null;
                error: unknown;
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

          case "subscription.charged": {
            const subEntity = (payloadEntity?.subscription as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
            const razorpaySubscriptionId = (subEntity?.id as string) || "";
            const subPaymentId = (paymentEntity?.id as string) || "";

            if (!razorpaySubscriptionId || !subPaymentId || !razorpayOrderId) {
              processingStatus = "ignored";
              processingError = "Missing subscription/payment/order ID";
              break;
            }

            const { handleSubscriptionCharged } = await import("@/features/billing/services/member-webhook-handler");
            const subResult = await handleSubscriptionCharged(razorpaySubscriptionId, subPaymentId, razorpayOrderId);
            if (!subResult.handled) {
              processingStatus = "failed";
              processingError = subResult.error || "Subscription charge processing failed";
            }
            break;
          }

          case "subscription.charged.failed": {
            const failedSubEntity = (payloadEntity?.subscription as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
            const failedSubId = (failedSubEntity?.id as string) || "";
            const failureDesc = (payloadEntity?.error as Record<string, unknown> | undefined)?.description as string || "Subscription charge failed";

            if (!failedSubId) {
              processingStatus = "ignored";
              processingError = "Missing subscription ID";
              break;
            }

            const { handleSubscriptionChargeFailed } = await import("@/features/billing/services/member-webhook-handler");
            await handleSubscriptionChargeFailed(failedSubId, failureDesc);
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
      }
    } catch (err) {
      processingStatus = "failed";
      processingError = err instanceof Error ? err.message : "Webhook processing error";
    }

    // Update webhook event status
    if (webhookDbId) {
      await adminDb.from("payment_provider_events").update({
        status: processingStatus,
        error_message: processingError,
        processed_at: new Date().toISOString(),
      } as never).eq("id", webhookDbId);
    }

    billingLogger.info("webhook.payment", "Webhook processed", {
      provider,
      eventId,
      eventName,
      status: processingStatus,
      duration: Date.now() - startTime,
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
    billingLogger.error("webhook.payment", "Fatal error", { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return handlePaymentWebhook(request);
}

type WebhookProviderResult =
  | { ok: true; provider: IPaymentProvider; gymId: string | null }
  | { ok: false; message: string };

async function resolveWebhookProvider(input: {
  adminDb: ReturnType<typeof getSupabaseAdminClient>;
  provider: "razorpay" | "payu";
  eventName: string;
  parsedPayload: Record<string, unknown>;
}): Promise<WebhookProviderResult> {
  const { adminDb, provider, eventName, parsedPayload } = input;
  const payloadEntity = parsedPayload.entity as Record<string, unknown> | undefined;
  const payload = payloadEntity?.payload as Record<string, unknown> | undefined;
  const paymentEntity = (payload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  const orderEntity = (payload?.order as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  const subscriptionEntity = (payload?.subscription as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;

  const subscriptionId = (subscriptionEntity?.id as string) || (paymentEntity?.subscription_id as string) || "";
  if (provider === "razorpay" && subscriptionId) {
    const { data: orgSubscription } = await adminDb
      .from("organization_subscriptions")
      .select("id")
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle() as never as {
      data: { id: string } | null;
      error: { message: string } | null;
    };

    if (orgSubscription) {
      return {
        ok: true,
        provider: getRazorpayProvider(undefined, false),
        gymId: null,
      };
    }
  }

  const gymId = await resolveGymIdFromWebhook(adminDb, {
    paymentEntity,
    orderEntity,
  });

  if (!gymId) {
    if (provider === "razorpay" && eventName.startsWith("subscription.")) {
      return {
        ok: true,
        provider: getRazorpayProvider(undefined, false),
        gymId: null,
      };
    }

    return { ok: false, message: "Unable to resolve the gym for this payment webhook." };
  }

  const providerResult = await getProviderForGym(gymId, provider);
  if (!providerResult.ok) {
    return { ok: false, message: providerResult.message };
  }

  return {
    ok: true,
    provider: providerResult.provider,
    gymId,
  };
}

async function resolveGymIdFromWebhook(
  adminDb: ReturnType<typeof getSupabaseAdminClient>,
  input: {
    paymentEntity: Record<string, unknown> | undefined;
    orderEntity: Record<string, unknown> | undefined;
  },
): Promise<string | null> {
  const notes = (input.orderEntity?.notes as Record<string, unknown> | undefined) ?? (input.paymentEntity?.notes as Record<string, unknown> | undefined) ?? null;
  const noteGymId = notes && typeof notes.gym_id === "string" ? notes.gym_id : null;
  if (noteGymId) {
    return noteGymId;
  }

  const paymentOrderId = (input.paymentEntity?.order_id as string) || (input.orderEntity?.id as string) || "";
  const paymentId = (input.paymentEntity?.id as string) || "";

  if (paymentOrderId || paymentId) {
    const { data: payment } = await adminDb
      .from("payments")
      .select("gym_id")
      .or(paymentOrderId && paymentId
        ? `provider_order_id.eq.${paymentOrderId},provider_payment_id.eq.${paymentId}`
        : paymentOrderId
          ? `provider_order_id.eq.${paymentOrderId}`
          : `provider_payment_id.eq.${paymentId}`)
      .maybeSingle() as never as {
      data: { gym_id: string | null } | null;
      error: { message: string } | null;
    };

    if (payment?.gym_id) {
      return payment.gym_id;
    }
  }

  return null;
}
