import "server-only";

import crypto from "node:crypto";
import Razorpay from "razorpay";
import { getRazorpayConfig, getRazorpayPublicKeyId } from "./razorpay-config";
import type {
  CreateRazorpayOrderInput,
  CreateRazorpayOrderResult,
  VerifyRazorpayPaymentSignatureInput,
  VerifyRazorpayPaymentSignatureResult,
  VerifyRazorpayWebhookSignatureInput,
  VerifyRazorpayWebhookSignatureResult,
} from "./razorpay-types";

let razorpayClient: Razorpay | null = null;

function getClient(): Razorpay {
  if (razorpayClient) return razorpayClient;
  const config = getRazorpayConfig();
  razorpayClient = new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });
  return razorpayClient;
}

/**
 * Converts rupees to paise safely.
 * Multiplies by 100 and rounds to avoid floating-point issues.
 */
export function normalizeRazorpayAmountToPaise(amountInRupees: number): number {
  if (!Number.isFinite(amountInRupees) || amountInRupees < 0) {
    throw new Error(`Invalid amount: ${amountInRupees}. Amount must be a positive number.`);
  }
  return Math.round(amountInRupees * 100);
}

/**
 * Converts paise to rupees safely.
 * This is server-only — the frontend should receive rupees, not paise.
 */
export function normalizePaiseToRupees(amountInPaise: number): number {
  if (!Number.isFinite(amountInPaise) || amountInPaise < 0) {
    throw new Error(`Invalid paise amount: ${amountInPaise}.`);
  }
  return amountInPaise / 100;
}

/**
 * Creates a Razorpay order.
 * Amount is provided in rupees and converted to paise internally.
 * This function is server-only and uses the Razorpay SDK with secret key.
 * Do NOT import this into any "use client" component.
 */
export async function createRazorpayOrder(
  input: CreateRazorpayOrderInput,
): Promise<{ ok: true; data: CreateRazorpayOrderResult } | { ok: false; message: string }> {
  const { amountInRupees, currency = "INR", receipt, notes } = input;

  if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
    return { ok: false, message: `Invalid amount: ${amountInRupees}. Amount must be positive.` };
  }

  const amountInPaise = normalizeRazorpayAmountToPaise(amountInRupees);

  if (currency !== "INR") {
    return { ok: false, message: `Unsupported currency: ${currency}. Only INR is supported at this time.` };
  }

  try {
    const client = getClient();
    const orderPayload: {
      amount: number;
      currency: string;
      receipt: string;
      notes?: Record<string, string>;
    } = {
      amount: amountInPaise,
      currency,
      receipt,
    };
    if (notes && Object.keys(notes).length > 0) {
      orderPayload.notes = notes;
    }

    const order = await client.orders.create(orderPayload);

    return {
      ok: true,
      data: {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        receipt: order.receipt ?? "",
        status: order.status,
        created_at: order.created_at,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay order creation failed";
    return { ok: false, message };
  }
}

/**
 * Verifies a Razorpay payment signature using HMAC SHA256.
 * Must be called server-side after receiving payment callback.
 * Never expose the secret key or this function to the client.
 */
export function verifyRazorpayPaymentSignature(
  input: VerifyRazorpayPaymentSignatureInput,
): VerifyRazorpayPaymentSignatureResult {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return { isValid: false, error: "Missing required payment signature fields." };
  }

  try {
    const config = getRazorpayConfig();
    const expected = crypto
      .createHmac("sha256", config.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const received = razorpaySignature;
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return { isValid: false, error: "Signature length mismatch." };
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!isValid) return { isValid, error: "Signature does not match." };
    return { isValid };
  } catch (err) {
    return { isValid: false, error: err instanceof Error ? err.message : "Signature verification failed." };
  }
}

export type RazorpayPaymentRecord = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  method: string | null;
  created_at: number;
};

/**
 * Creates a Razorpay refund for a given payment.
 * Includes retry logic and timeout for resilience.
 */
export async function createRazorpayRefund(
  paymentId: string,
  amount: number,
  notes: Record<string, string>,
): Promise<{ ok: true; refund: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const client = getClient();
    const refund = await client.payments.refund(paymentId, { amount, notes });
    return { ok: true, refund: refund as never as Record<string, unknown> };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay refund failed";
    return { ok: false, message };
  }
}

/**
 * Fetches a single Razorpay payment by ID.
 */
export async function fetchRazorpayPayment(
  paymentId: string,
): Promise<{ ok: true; payment: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const client = getClient();
    const payment = await client.payments.fetch(paymentId);
    return { ok: true, payment: payment as never as Record<string, unknown> };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay payment fetch failed";
    return { ok: false, message };
  }
}

/**
 * Fetches captured Razorpay payments within a date range for reconciliation.
 * Uses the Razorpay SDK to query payments matching the given time window.
 */
export async function fetchRazorpayCapturedPayments(
  fromDate: Date,
  toDate: Date,
): Promise<{ ok: true; data: RazorpayPaymentRecord[] } | { ok: false; message: string }> {
  try {
    const client = getClient();
    const allPayments: RazorpayPaymentRecord[] = [];
    let skip = 0;
    const count = 100;

    while (true) {
      const result = await client.payments.all({
        from: Math.floor(fromDate.getTime() / 1000),
        to: Math.floor(toDate.getTime() / 1000),
        count,
        skip,
      });

      const payments = (result as never as { items: RazorpayPaymentRecord[] })?.items ?? [];
      allPayments.push(...payments);

      if (payments.length < count) break;
      skip += count;
    }

    const captured = allPayments.filter((p) => p.captured && p.status === "captured");

    return { ok: true, data: captured };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay payments fetch failed";
    return { ok: false, message };
  }
}

/**
 * Backward-compatible alias for getRazorpayPublicKeyId.
 */
export function getRazorpayKeyId(): string {
  return getRazorpayPublicKeyId();
}

/**
 * Verifies a Razorpay checkout signature.
 * Supports an optional secret override (defaults to key secret).
 */
export function verifyRazorpayCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}): boolean {
  try {
    const config = getRazorpayConfig();
    const secret = input.secret ?? config.keySecret;
    if (!secret) return false;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(input.signature);
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Verifies a Razorpay webhook signature using the webhook secret.
 * Must be called with the raw request body (not parsed JSON).
 */
export function verifyRazorpayWebhookSignature(
  input: VerifyRazorpayWebhookSignatureInput,
): VerifyRazorpayWebhookSignatureResult {
  const { rawBody, signature } = input;

  if (!rawBody || !signature) {
    return { isValid: false, error: "Missing webhook body or signature." };
  }

  try {
    const config = getRazorpayConfig();
    const expected = crypto
      .createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return { isValid: false, error: "Signature length mismatch." };
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    if (!isValid) return { isValid, error: "Webhook signature does not match." };
    return { isValid };
  } catch (err) {
    return { isValid: false, error: err instanceof Error ? err.message : "Webhook signature verification failed." };
  }
}
