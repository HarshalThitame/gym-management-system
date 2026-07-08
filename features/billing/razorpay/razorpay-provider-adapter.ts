import "server-only";

import type {
  IPaymentProvider,
  PaymentProviderCapability,
  CreateOrderInput,
  CreatePaymentLinkInput,
  CreateRefundInput,
  PaymentProviderHealth,
  ProviderEnvironment,
  VerifyPaymentInput,
  VerifyWebhookInput,
} from "../providers/provider-types";

import { getRazorpayConfig } from "./razorpay-config";
import {
  createRazorpayOrder,
  createRazorpayPaymentLink,
  createRazorpayRefund,
  getRazorpayKeyId,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "./razorpay-service";

const CAPABILITIES: PaymentProviderCapability[] = [
  "orders",
  "payment_links",
  "refunds",
  "webhooks",
  "reconciliation",
  "subscriptions",
  "saved_cards",
];

export function getRazorpayProvider(_config: Record<string, string>, _testMode: boolean): IPaymentProvider {
  return {
    name: "razorpay",
    label: "Razorpay",
    capabilities: CAPABILITIES,

    async createOrder(input: CreateOrderInput) {
      return createRazorpayOrder(input);
    },

    async verifyPayment(input: VerifyPaymentInput) {
      return verifyRazorpayCheckoutSignature({
        razorpayOrderId: input.providerOrderId,
        razorpayPaymentId: input.providerPaymentId,
        razorpaySignature: input.providerSignature,
      });
    },

    async createPaymentLink(input: CreatePaymentLinkInput) {
      return createRazorpayPaymentLink(input);
    },

    async createRefund(input: CreateRefundInput) {
      const result = await createRazorpayRefund(input.paymentId, input.amountInPaise, input.notes ?? {});
      if (!result.ok) return { ok: false, message: result.message };
      const r = result.refund as Record<string, unknown>;
      return {
        ok: true,
        data: {
          id: String(r.id ?? ""),
          paymentId: String(r.payment_id ?? input.paymentId),
          amount: Number(r.amount ?? input.amountInPaise),
          currency: String(r.currency ?? "INR"),
          status: String(r.status ?? "processing"),
        },
      };
    },

    async verifyWebhookSignature(input: VerifyWebhookInput): Promise<boolean> {
      const result = verifyRazorpayWebhookSignature(input);
      return result.isValid;
    },

    getHealth(): PaymentProviderHealth {
      try {
        const cfg = getRazorpayConfig();
        return {
          configured: !!(cfg.keyId && cfg.keySecret && cfg.webhookSecret),
          environment: cfg.environment,
          hasKeyId: !!cfg.keyId,
          hasKeySecret: !!cfg.keySecret,
          hasWebhookSecret: !!cfg.webhookSecret,
        };
      } catch {
        return {
          configured: false,
          environment: null,
          hasKeyId: false,
          hasKeySecret: false,
          hasWebhookSecret: false,
        };
      }
    },

    getPublicKey(): string {
      return getRazorpayKeyId();
    },

    getEnvironment(): ProviderEnvironment {
      return getRazorpayConfig().environment;
    },
  };
}
