import "server-only";

import crypto from "node:crypto";
import Razorpay from "razorpay";
import { getRazorpayConfig } from "./razorpay-config";
import type {
  CreateRazorpayOrderInput,
  CreateRazorpayOrderResult,
  VerifyRazorpayPaymentSignatureInput,
  VerifyRazorpayPaymentSignatureResult,
  VerifyRazorpayWebhookSignatureInput,
  VerifyRazorpayWebhookSignatureResult,
} from "./razorpay-types";

const RAZORPAY_TIMEOUT_MS = 15_000;
const RAZORPAY_RETRY_COUNT = 3;

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
  const { amountInRupees, currency = "INR", receipt, notes, idempotencyKey } = input;

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
      idempotency_key?: string;
    } = {
      amount: amountInPaise,
      currency,
      receipt,
    };
    if (notes && Object.keys(notes).length > 0) {
      orderPayload.notes = notes;
    }
    if (idempotencyKey) {
      orderPayload.idempotency_key = idempotencyKey;
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
