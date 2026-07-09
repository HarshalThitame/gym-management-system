export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  order_id?: string;
  subscription_id?: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    method?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    hide_topbar?: boolean;
  };
  modal?: {
    ondismiss?: () => void;
    animation?: boolean;
    backdropopacity?: string;
    confirm_close?: boolean;
  };
  handler: (response: RazorpayCheckoutResponse) => void;
  retry?: {
    enabled?: boolean;
    max_count?: number;
  };
}

export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutInstance {
  open(): void;
  close(): void;
  on(event: string, callback: (response: unknown) => void): void;
}

export type PaymentState =
  | "idle"
  | "creating_order"
  | "checkout_open"
  | "success_pending_verification"
  | "failed"
  | "cancelled"
  | "script_error";

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
