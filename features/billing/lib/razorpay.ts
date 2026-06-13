import crypto from "node:crypto";
import Razorpay from "razorpay";
import { billingLogger } from "@/features/billing/lib/logger";
import { withTimeout, withRetry } from "@/lib/async-utils";

type RazorpayOrderInput = {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
};

let razorpayClient: Razorpay | null = null;

const RAZORPAY_TIMEOUT_MS = 15_000;
const RAZORPAY_RETRY_COUNT = 3;

export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  razorpayClient ??= new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayClient;
}

export async function createRazorpayOrder(input: RazorpayOrderInput) {
  const client = getRazorpayClient();

  if (!client) {
    billingLogger.warn("createRazorpayOrder", "Razorpay not configured");
    return { ok: false, message: "Razorpay is not configured." } as const;
  }

  const orderPayload = {
    amount: input.amount,
    currency: input.currency,
    receipt: input.receipt,
    ...(input.notes ? { notes: input.notes } : {}),
  };

  try {
    const order = await withRetry(
      () => withTimeout(
        () => client.orders.create(orderPayload),
        RAZORPAY_TIMEOUT_MS,
      ),
      RAZORPAY_RETRY_COUNT,
    );
    billingLogger.info("createRazorpayOrder", `Order ${order.id} created`, { amount: input.amount, currency: input.currency });
    return { ok: true, order } as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay order creation failed";
    billingLogger.error("createRazorpayOrder", message, { amount: input.amount, retries: RAZORPAY_RETRY_COUNT });
    return { ok: false, message } as const;
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
  const secret = input.secret ?? process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  return timingSafeEqual(expected, input.signature);
}

export function verifyRazorpayWebhookSignature(input: {
  rawBody: string;
  signature: string;
  secret?: string;
}) {
  const secret = input.secret ?? process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(input.rawBody)
    .digest("hex");

  return timingSafeEqual(expected, input.signature);
}

function timingSafeEqual(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
