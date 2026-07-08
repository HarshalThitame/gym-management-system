export type ProviderEnvironment = "test" | "live";

export type PaymentProviderName = "razorpay" | "payu";

export type CreateOrderInput = {
  amountInRupees: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
  idempotencyKey?: string;
};

export type CreateOrderResult = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
};

export type VerifyPaymentInput = {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
};

export type VerifyPaymentResult = {
  isValid: boolean;
  error?: string;
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

export type CreateRefundInput = {
  paymentId: string;
  amountInPaise: number;
  notes?: Record<string, string>;
};

export type CreateRefundResult = {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
};

export type VerifyWebhookInput = {
  rawBody: string;
  signature: string;
};

export type PaymentProviderHealth = {
  configured: boolean;
  environment: ProviderEnvironment | null;
  hasKeyId: boolean;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
};

export type ProviderConfig = {
  provider: PaymentProviderName;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  testMode: boolean;
  config: Record<string, string>;
};

export type PaymentProviderCapability =
  | "orders"
  | "payment_links"
  | "refunds"
  | "webhooks"
  | "reconciliation"
  | "subscriptions"
  | "saved_cards";

export interface IPaymentProvider {
  readonly name: PaymentProviderName;
  readonly label: string;
  readonly capabilities: PaymentProviderCapability[];

  createOrder(input: CreateOrderInput): Promise<{ ok: true; data: CreateOrderResult } | { ok: false; message: string }>;

  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;

  createPaymentLink(input: CreatePaymentLinkInput): Promise<{ ok: true; data: CreatePaymentLinkResult } | { ok: false; message: string }>;

  createRefund(input: CreateRefundInput): Promise<{ ok: true; data: CreateRefundResult } | { ok: false; message: string }>;

  verifyWebhookSignature(input: VerifyWebhookInput): Promise<boolean>;

  getHealth(): PaymentProviderHealth;

  getPublicKey(): string;

  getEnvironment(): ProviderEnvironment;
}
