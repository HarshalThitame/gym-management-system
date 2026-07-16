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
import { normalizeRazorpayProviderConfig } from "./razorpay-provider-config";
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

export function getRazorpayProvider(config: Record<string, string> | undefined, testMode: boolean): IPaymentProvider {
  const normalized = normalizeRazorpayProviderConfig(config, testMode);
  const hasExplicitConfig = config !== undefined && Object.keys(config).length > 0;

  function resolveCredentials() {
    if (normalized) {
      return normalized;
    }
    return null;
  }

  return {
    name: "razorpay",
    label: "Razorpay",
    capabilities: CAPABILITIES,

    async createOrder(input: CreateOrderInput) {
      if (hasExplicitConfig && !resolveCredentials()) {
        return { ok: false, message: "Razorpay configuration is incomplete for this gym." };
      }
      return createRazorpayOrder(input, resolveCredentials());
    },

    async verifyPayment(input: VerifyPaymentInput) {
      if (hasExplicitConfig && !resolveCredentials()) {
        return { isValid: false, error: "Razorpay configuration is incomplete for this gym." };
      }
      return verifyRazorpayCheckoutSignature({
        razorpayOrderId: input.providerOrderId,
        razorpayPaymentId: input.providerPaymentId,
        razorpaySignature: input.providerSignature,
        credentials: resolveCredentials(),
      });
    },

    async createPaymentLink(input: CreatePaymentLinkInput) {
      if (hasExplicitConfig && !resolveCredentials()) {
        return { ok: false, message: "Razorpay configuration is incomplete for this gym." };
      }
      return createRazorpayPaymentLink(input, resolveCredentials());
    },

    async createRefund(input: CreateRefundInput) {
      if (hasExplicitConfig && !resolveCredentials()) {
        return { ok: false, message: "Razorpay configuration is incomplete for this gym." };
      }
      const result = await createRazorpayRefund(input.paymentId, input.amountInPaise, input.notes ?? {}, resolveCredentials());
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
      if (hasExplicitConfig && !resolveCredentials()) {
        return false;
      }
      const result = verifyRazorpayWebhookSignature(input, resolveCredentials());
      return result.isValid;
    },

    getHealth(): PaymentProviderHealth {
      try {
        if (hasExplicitConfig && !normalized) {
          return {
            configured: false,
            environment: null,
            hasKeyId: false,
            hasKeySecret: false,
            hasWebhookSecret: false,
          };
        }

        const cfg = normalized ?? getRazorpayConfig();
        return {
          configured: !!(cfg.keyId && cfg.keySecret && (!hasExplicitConfig || cfg.webhookSecret)),
          environment: cfg.environment,
          hasKeyId: !!cfg.keyId,
          hasKeySecret: !!cfg.keySecret,
          hasWebhookSecret: !!cfg.webhookSecret || !hasExplicitConfig,
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
      if (hasExplicitConfig && !normalized) {
        return "";
      }
      return getRazorpayKeyId(resolveCredentials());
    },

    getEnvironment(): ProviderEnvironment {
      if (hasExplicitConfig && !normalized) {
        return "test";
      }
      return resolveCredentials()?.environment ?? getRazorpayConfig().environment;
    },
  };
}
