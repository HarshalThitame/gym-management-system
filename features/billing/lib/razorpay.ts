import crypto from "node:crypto";
import Razorpay from "razorpay";

type RazorpayOrderInput = {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
};

let razorpayClient: Razorpay | null = null;

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
    key_secret: keySecret
  });

  return razorpayClient;
}

export async function createRazorpayOrder(input: RazorpayOrderInput) {
  const client = getRazorpayClient();

  if (!client) {
    return { ok: false, message: "Razorpay is not configured." } as const;
  }

  const orderPayload = {
    amount: input.amount,
    currency: input.currency,
    receipt: input.receipt,
    ...(input.notes ? { notes: input.notes } : {})
  };

  const order = await client.orders.create(orderPayload);

  return { ok: true, order } as const;
}

export async function createRazorpayRefund(paymentId: string, amount: number, notes: Record<string, string>) {
  const client = getRazorpayClient();

  if (!client) {
    return { ok: false, message: "Razorpay is not configured." } as const;
  }

  const refund = await client.payments.refund(paymentId, {
    amount,
    notes
  });

  return { ok: true, refund } as const;
}

export function verifyRazorpayCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}) {
  const secret = input.secret ?? process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    return false;
  }

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

  if (!secret) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(input.rawBody)
    .digest("hex");

  return timingSafeEqual(expected, input.signature);
}

function timingSafeEqual(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
