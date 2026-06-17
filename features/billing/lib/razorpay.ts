import "server-only";

/**
 * DEPRECATED: This file is maintained for backward compatibility only.
 * All new code should import from features/billing/razorpay/razorpay-config.ts
 * and features/billing/razorpay/razorpay-service.ts directly.
 *
 * This module re-exports all canonical Razorpay functionality and
 * provides backward-compatible wrappers for older functions.
 *
 * TODO: Migrate all callers to canonical modules and remove this shim.
 */

import crypto from "node:crypto";
import Razorpay from "razorpay";
import { billingLogger } from "@/features/billing/lib/logger";
import { withTimeout, withRetry } from "@/lib/async-utils";

const RAZORPAY_TIMEOUT_MS = 15_000;
const RAZORPAY_RETRY_COUNT = 3;

// Canonical re-exports
export {
  getRazorpayConfig,
  getRazorpayPublicKeyId,
  getRazorpayEnvironment,
  isRazorpayLiveMode,
  isRazorpayTestMode,
  maskRazorpayKey,
  getRazorpayWebhookSecret,
} from "../razorpay/razorpay-config";

export {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  normalizeRazorpayAmountToPaise,
  normalizePaiseToRupees,
} from "../razorpay/razorpay-service";

import { getRazorpayPublicKeyId as getCanonicalPublicKeyId, getRazorpayConfig as getCanonicalConfig } from "../razorpay/razorpay-config";

// Backward-compatible functions used by older code (payment-processing.ts, etc.)

export function getRazorpayKeyId() {
  return getCanonicalPublicKeyId();
}

let razorpayClient: Razorpay | null = null;

function getRazorpayClient() {
  if (razorpayClient) return razorpayClient;
  try {
    const config = getCanonicalConfig();
    razorpayClient = new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret,
    });
    return razorpayClient;
  } catch {
    return null;
  }
}

export async function createRazorpayRefund(paymentId: string, amount: number, notes: Record<string, string>) {
  const client = getRazorpayClient();
  if (!client) {
    billingLogger.warn("createRazorpayRefund", "Razorpay not configured");
    return { ok: false, message: "Razorpay is not configured." } as const;
  }
  try {
    const refund = await withRetry(
      () => withTimeout(
        () => client.payments.refund(paymentId, { amount, notes }),
        RAZORPAY_TIMEOUT_MS,
      ),
      RAZORPAY_RETRY_COUNT,
    );
    billingLogger.info("createRazorpayRefund", `Refund ${refund.id} created`, { paymentId, amount });
    return { ok: true, refund } as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay refund failed";
    billingLogger.error("createRazorpayRefund", message, { paymentId, amount });
    return { ok: false, message } as const;
  }
}

export async function fetchRazorpayPayment(paymentId: string) {
  const client = getRazorpayClient();
  if (!client) {
    billingLogger.warn("fetchRazorpayPayment", "Razorpay not configured");
    return { ok: false, message: "Razorpay is not configured." } as const;
  }
  try {
    const payment = await withRetry(
      () => withTimeout(
        () => client.payments.fetch(paymentId),
        RAZORPAY_TIMEOUT_MS,
      ),
      RAZORPAY_RETRY_COUNT,
    );
    return { ok: true, payment } as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay payment fetch failed";
    billingLogger.error("fetchRazorpayPayment", message, { paymentId });
    return { ok: false, message } as const;
  }
}

export function verifyRazorpayCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}) {
  try {
    const config = getCanonicalConfig();
    const secret = input.secret ?? config.keySecret;
    if (!secret) return false;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest("hex");
    return timingSafeEqual(expected, input.signature);
  } catch {
    return false;
  }
}

function timingSafeEqual(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
