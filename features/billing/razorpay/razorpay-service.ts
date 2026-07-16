import "server-only";

import crypto from "node:crypto";
import Razorpay from "razorpay";
import { getRazorpayConfig, getRazorpayPublicKeyId } from "./razorpay-config";
import type { RazorpayProviderCredentials } from "./razorpay-provider-config";
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

function getClientForCredentials(credentials?: RazorpayProviderCredentials | null): Razorpay {
  if (!credentials) {
    return getClient();
  }

  return new Razorpay({
    key_id: credentials.keyId,
    key_secret: credentials.keySecret,
  });
}

function extractRazorpayErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "string") {
    return err.trim() || fallback;
  }

  if (err instanceof Error) {
    const message = err.message.trim();
    if (message) return message;
  }

  if (err && typeof err === "object") {
    const candidate = err as Record<string, unknown>;
    const nestedError = candidate.error && typeof candidate.error === "object"
      ? candidate.error as Record<string, unknown>
      : null;
    const response = candidate.response && typeof candidate.response === "object"
      ? candidate.response as Record<string, unknown>
      : null;
    const responseBody = response?.body && typeof response.body === "object"
      ? response.body as Record<string, unknown>
      : null;
    const responseBodyError = responseBody?.error && typeof responseBody.error === "object"
      ? responseBody.error as Record<string, unknown>
      : null;

    const pieces = [
      responseBodyError?.description,
      responseBodyError?.message,
      nestedError?.description,
      nestedError?.message,
      candidate.description,
      candidate.message,
      candidate.code,
      responseBodyError?.code,
      nestedError?.code,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim());

    if (pieces.length > 0) {
      return pieces[0];
    }
  }

  return fallback;
}

function sanitizeRazorpayPlanName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
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
  credentials?: RazorpayProviderCredentials | null,
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
    const client = getClientForCredentials(credentials);
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

export type CreatePaymentLinkInput = {
  amountInRupees: number;
  currency?: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  callbackUrl?: string;
  notes?: Record<string, string>;
};

export type CreatePaymentLinkResult = {
  id: string;
  shortUrl: string;
  amount: number;
  currency: string;
  status: string;
};

/**
 * Creates a Razorpay payment link that can be shared with a customer.
 * The link redirects to the callback URL after payment.
 */
export async function createRazorpayPaymentLink(
  input: CreatePaymentLinkInput,
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; data: CreatePaymentLinkResult } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
    const amountInPaise = normalizeRazorpayAmountToPaise(input.amountInRupees);
    const payload: Record<string, unknown> = {
      amount: amountInPaise,
      currency: input.currency || "INR",
      description: input.description,
      customer: {
        name: input.customerName,
        email: input.customerEmail,
        contact: input.customerPhone || "",
      },
      notify: {
        sms: !!input.customerPhone,
        email: true,
      },
      reminder_enable: true,
      notes: input.notes || {},
      callback_url: input.callbackUrl || "",
      callback_method: "get",
    };

    const link = await client.paymentLink.create(payload as never);

    return {
      ok: true,
      data: {
        id: link.id as string,
        shortUrl: link.short_url as string,
        amount: link.amount as number,
        currency: link.currency as string,
        status: link.status as string,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay payment link creation failed";
    return { ok: false, message };
  }
}

export type PaymentLinkInfo = {
  id: string;
  shortUrl: string;
  amount: number;
  currency: string;
  status: string;
};

export async function fetchRazorpayPaymentLink(
  linkId: string,
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; data: PaymentLinkInfo } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
    const link = await client.paymentLink.fetch(linkId);
    return {
      ok: true,
      data: {
        id: link.id as string,
        shortUrl: link.short_url as string,
        amount: link.amount as number,
        currency: link.currency as string,
        status: link.status as string,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch payment link";
    return { ok: false, message };
  }
}

/**
 * Cancels a Razorpay payment link by its ID.
 * Only links in "created" or "partially_paid" status can be cancelled.
 */
export async function cancelRazorpayPaymentLink(
  linkId: string,
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; data: { id: string; status: string } } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
    const link = await client.paymentLink.cancel(linkId);
    return {
      ok: true,
      data: {
        id: link.id as string,
        status: link.status as string,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel payment link";
    return { ok: false, message };
  }
}

export async function createRazorpayRefund(
  paymentId: string,
  amount: number,
  notes: Record<string, string>,
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; refund: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
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
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; payment: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
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
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; data: RazorpayPaymentRecord[] } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
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

export type RazorpayCustomerData = {
  id: string;
  name: string;
  email: string;
  contact: string | null;
};

export async function createRazorpayCustomer(input: {
  name: string;
  email: string;
  contact?: string;
  notes?: Record<string, string>;
  credentials?: RazorpayProviderCredentials | null;
}): Promise<{ ok: true; data: RazorpayCustomerData } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(input.credentials);
    const customer = await client.customers.create({
      name: input.name,
      email: input.email,
      contact: input.contact || "",
      notes: input.notes || {},
    } as never) as never as RazorpayCustomerData;
    return { ok: true, data: customer };
  } catch (err) {
    const message = extractRazorpayErrorMessage(err, "Razorpay customer creation failed");
    return { ok: false, message };
  }
}

export async function fetchRazorpayCustomer(
  customerId: string,
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; data: RazorpayCustomerData } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
    const customer = await client.customers.fetch(customerId) as never as RazorpayCustomerData;
    return { ok: true, data: customer };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay customer fetch failed";
    return { ok: false, message };
  }
}

export type RazorpayPlanData = {
  id: string;
  period: string;
  interval: number;
  item: { name: string; amount: number; currency: string };
};

export async function createRazorpayPlan(input: {
  period: "monthly" | "quarterly" | "half_yearly" | "annual";
  interval?: number;
  amount: number;
  currency?: string;
  name: string;
  notes?: Record<string, string>;
  credentials?: RazorpayProviderCredentials | null;
}): Promise<{ ok: true; data: RazorpayPlanData } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(input.credentials);
    const period = input.period === "half_yearly"
      ? "monthly"
      : input.period === "annual"
        ? "yearly"
        : input.period;
    const interval = input.period === "half_yearly"
      ? 6
      : input.period === "annual"
        ? 1
        : input.interval ?? 1;
    const amountInPaise = normalizeRazorpayAmountToPaise(input.amount);
    const safeName = sanitizeRazorpayPlanName(input.name);

    if (!safeName) {
      return { ok: false, message: "Razorpay plan name cannot be empty." };
    }
    if (amountInPaise < 100) {
      return { ok: false, message: "Razorpay plans require a minimum amount of INR 1.00." };
    }

    const plan = await client.plans.create({
      period,
      interval,
      item: {
        name: safeName,
        amount: amountInPaise,
        currency: input.currency || "INR",
      },
      notes: Object.fromEntries(
        Object.entries(input.notes || {}).map(([key, value]) => [
          key.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, 40),
          String(value)
            .normalize("NFKD")
            .replace(/[^\x20-\x7E]/g, " ")
            .replace(/[\u0000-\u001F\u007F]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 256),
        ]),
      ),
    } as never) as never as RazorpayPlanData;
    return { ok: true, data: plan };
  } catch (err) {
    const message = extractRazorpayErrorMessage(err, "Razorpay plan creation failed");
    return { ok: false, message };
  }
}

export type RazorpaySubscriptionData = {
  id: string;
  plan_id: string;
  customer_id: string;
  status: string;
  current_start: number | null;
  current_end: number | null;
  ended_at: number | null;
  charge_at: number;
  total_count: number;
  paid_count: number;
};

export async function createRazorpaySubscription(input: {
  planId: string;
  customerId: string;
  totalCount?: number;
  notes?: Record<string, string>;
  credentials?: RazorpayProviderCredentials | null;
}): Promise<{ ok: true; data: RazorpaySubscriptionData } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(input.credentials);
    const subscription = await client.subscriptions.create({
      plan_id: input.planId,
      customer_id: input.customerId,
      total_count: input.totalCount ?? 12,
      notes: input.notes || {},
    } as never) as never as RazorpaySubscriptionData;
    return { ok: true, data: subscription };
  } catch (err) {
    const message = extractRazorpayErrorMessage(err, "Razorpay subscription creation failed");
    return { ok: false, message };
  }
}

export async function fetchRazorpaySubscription(
  subscriptionId: string,
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; data: RazorpaySubscriptionData } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
    const subscription = await client.subscriptions.fetch(subscriptionId) as never as RazorpaySubscriptionData;
    return { ok: true, data: subscription };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay subscription fetch failed";
    return { ok: false, message };
  }
}

export async function cancelRazorpaySubscription(
  subscriptionId: string,
  credentials?: RazorpayProviderCredentials | null,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const client = getClientForCredentials(credentials);
    await client.subscriptions.cancel(subscriptionId);
    return { ok: true, message: "Subscription cancelled" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Razorpay subscription cancellation failed";
    return { ok: false, message };
  }
}

export function verifyRazorpaySubscriptionSignature(input: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
  secret?: string;
  credentials?: RazorpayProviderCredentials | null;
}): boolean {
  try {
    const config = input.credentials ?? getRazorpayConfig();
    const secret = input.secret ?? config.keySecret;
    if (!secret) return false;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${input.paymentId}|${input.subscriptionId}`)
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
 * Backward-compatible alias for getRazorpayPublicKeyId.
 */
export function getRazorpayKeyId(credentials?: RazorpayProviderCredentials | null): string {
  if (credentials?.keyId) {
    return credentials.keyId;
  }
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
  credentials?: RazorpayProviderCredentials | null;
}): boolean {
  try {
    const config = input.credentials ?? getRazorpayConfig();
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
  credentials?: RazorpayProviderCredentials | null,
): VerifyRazorpayWebhookSignatureResult {
  const { rawBody, signature } = input;

  if (!rawBody || !signature) {
    return { isValid: false, error: "Missing webhook body or signature." };
  }

  try {
    const config = credentials ?? getRazorpayConfig();
    const webhookSecret = config.webhookSecret;
    if (!webhookSecret) {
      return { isValid: false, error: "Webhook secret is not configured." };
    }

    const expected = crypto
      .createHmac("sha256", webhookSecret)
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
