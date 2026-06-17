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
