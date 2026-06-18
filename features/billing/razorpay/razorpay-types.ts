export type RazorpayEnvironment = "test" | "live";

export type CreateRazorpayOrderInput = {
  amountInRupees: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
  idempotencyKey?: string;
};

export type CreateRazorpayOrderResult = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
};

export type VerifyRazorpayPaymentSignatureInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type VerifyRazorpayPaymentSignatureResult = {
  isValid: boolean;
  error?: string;
};

export type VerifyRazorpayWebhookSignatureInput = {
  rawBody: string;
  signature: string;
};

export type VerifyRazorpayWebhookSignatureResult = {
  isValid: boolean;
  error?: string;
};

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  environment: RazorpayEnvironment;
  isTestMode: boolean;
};

export type RazorpayHealthStatus = {
  configured: boolean;
  environment: RazorpayEnvironment | null;
  hasKeyId: boolean;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  publicKeyMatchesServerKey: boolean;
};

export type SecureCheckoutIntentInput = {
  targetPackageId: string;
  billingCycle: "monthly" | "annual";
  upgradeRequestId?: string;
};

export type SecureCheckoutIntentResult = {
  success: true;
  razorpayKeyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  invoiceId: string;
  packageDisplayName: string;
  organizationDisplayName: string;
  billingCycle: string;
  isTestMode: boolean;
  environmentLabel: string;
} | {
  success: false;
  error: string;
};

export type PaymentAcknowledgementInput = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type PaymentAcknowledgementResult = {
  success: true;
  status: "signature_acknowledged" | "payment_confirmed" | "already_processed";
  invoiceId: string;
  subscriptionStatus?: string;
  paymentId?: string;
  subscriptionId?: string;
  warning?: string;
} | {
  success: false;
  error: string;
};

export type FinalizePaymentInput = {
  providerOrderId: string;
  providerPaymentId: string;
  providerEnvironment: RazorpayEnvironment;
  eventId: string;
};

export type FinalizePaymentResult = {
  success: true;
  invoiceId: string;
  paymentId: string;
  subscriptionId: string;
  wasAlreadyFinalized: boolean;
  entitlementSyncStatus: "completed" | "failed" | "skipped";
} | {
  success: false;
  error: string;
  code?: string;
};

export type CheckoutOrderState =
  | "idle"
  | "creating_order"
  | "checkout_open"
  | "payment_callback_received"
  | "waiting_for_webhook"
  | "payment_confirmed"
  | "payment_failed"
  | "checkout_cancelled"
  | "verification_failed";
