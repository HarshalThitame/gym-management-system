import "server-only";

import crypto from "node:crypto";
import type {
  IPaymentProvider,
  PaymentProviderName,
  ProviderEnvironment,
  CreateOrderInput,
  CreateOrderResult,
  CreatePaymentLinkInput,
  CreatePaymentLinkResult,
  CreateRefundInput,
  CreateRefundResult,
  PaymentProviderHealth,
  PaymentProviderCapability,
  VerifyPaymentInput,
  VerifyWebhookInput,
} from "@/features/billing/providers/provider-types";
import { getPayuConfig, getPayuApiBaseUrl, getPayuEnvironment } from "./payu-config";
import { billingLogger } from "@/features/billing/lib/logger";
import type { PayuOrderResponse, PayuVerifyResponse, PayuRefundResponse } from "./payu-types";

const CAPABILITIES: PaymentProviderCapability[] = [
  "orders",
  "refunds",
  "webhooks",
];

export function getPayuProvider(_config: Record<string, string>, _testMode: boolean): IPaymentProvider {
  return new PayuProvider();
}

class PayuProvider implements IPaymentProvider {
  readonly name: PaymentProviderName = "payu";
  readonly label = "PayU";
  readonly capabilities: PaymentProviderCapability[] = CAPABILITIES;

  async createOrder(input: CreateOrderInput): Promise<{ ok: true; data: CreateOrderResult } | { ok: false; message: string }> {
    try {
      const config = getPayuConfig();
      const txnid = input.receipt || `TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const amount = input.amountInRupees.toFixed(2);
      const productinfo = input.notes?.description || "Membership payment";
      const firstname = input.notes?.customer_name || "Member";
      const email = input.notes?.customer_email;
      const phone = input.notes?.customer_phone;

      if (!email || !phone) {
        return { ok: false, message: "Customer email and phone are required for PayU payment" };
      }

      const hashString = `${config.merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${config.merchantSalt}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      const baseUrl = getPayuApiBaseUrl(config.environment);
      const payload = {
        key: config.merchantKey,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        phone,
        surl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/payment?provider=payu`,
        furl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/payment?provider=payu`,
        hash,
        service_provider: "payu_paisa",
        udf1: input.notes?.invoice_id || "",
        udf2: input.notes?.member_id || "",
        udf3: input.notes?.gym_id || "",
        udf4: "",
        udf5: "",
      };

      const response = await fetch(`${baseUrl}/payment/merchant/createOrder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": config.authHeader,
        },
        body: new URLSearchParams(payload).toString(),
      });

      if (!response.ok) {
        const text = await response.text();
        billingLogger.error("PayuProvider.createOrder", "PayU order creation failed", { status: response.status, body: text });
        return { ok: false, message: `PayU API error: ${response.status}` };
      }

      const data: PayuOrderResponse = await response.json();

      if (data.status !== 1 || !data.body?.result?.[0]) {
        return { ok: false, message: "PayU order creation rejected" };
      }

      const result = data.body.result[0];

      return {
        ok: true,
        data: {
          id: result.txnid,
          amount: Math.round(parseFloat(result.amount) * 100),
          currency: "INR",
          receipt: result.txnid,
          status: "created",
          created_at: Math.floor(Date.now() / 1000),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "PayU order creation failed";
      billingLogger.error("PayuProvider.createOrder", message);
      return { ok: false, message };
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<{ isValid: boolean; error?: string }> {
    try {
      const config = getPayuConfig();
      const baseUrl = getPayuApiBaseUrl(config.environment);

      const response = await fetch(`${baseUrl}/payment/payment/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": config.authHeader,
        },
        body: new URLSearchParams({
          key: config.merchantKey,
          command: "verify_payment",
          var1: input.providerOrderId,
        }).toString(),
      });

      if (!response.ok) {
        return { isValid: false, error: "PayU verification request failed" };
      }

      const data: PayuVerifyResponse = await response.json();

      if (data.status !== 1) {
        return { isValid: false, error: data.msg || "PayU verification failed" };
      }

      const txnDetail = data.transaction_details?.[input.providerOrderId];
      if (!txnDetail) {
        return { isValid: false, error: "Transaction not found" };
      }

      if (txnDetail.status !== "success" && txnDetail.status !== "completed") {
        return { isValid: false, error: `Payment status: ${txnDetail.status}` };
      }

      const expectedHash = crypto
        .createHash("sha512")
        .update(`${config.merchantSalt}|${txnDetail.status}|||||||||||${input.providerPaymentId}`)
        .digest("hex")
        .toLowerCase();

      return { isValid: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "PayU verification failed";
      return { isValid: false, error: message };
    }
  }

  async createPaymentLink(_input: CreatePaymentLinkInput): Promise<{ ok: true; data: CreatePaymentLinkResult } | { ok: false; message: string }> {
    return { ok: false, message: "Payment links not supported by PayU. Use Razorpay for payment links." };
  }

  async createRefund(input: CreateRefundInput): Promise<{ ok: true; data: CreateRefundResult } | { ok: false; message: string }> {
    try {
      const config = getPayuConfig();
      const baseUrl = getPayuApiBaseUrl(config.environment);

      const response = await fetch(`${baseUrl}/payment/merchant/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": config.authHeader,
        },
        body: new URLSearchParams({
          key: config.merchantKey,
          command: "cancel_refund_transaction",
          var1: input.paymentId,
          var2: String(input.amountInPaise / 100),
          var3: "Instant Refund",
        }).toString(),
      });

      if (!response.ok) {
        return { ok: false, message: "PayU refund request failed" };
      }

      const data: PayuRefundResponse = await response.json();

      if (data.status !== 1) {
        return { ok: false, message: data.msg || "PayU refund rejected" };
      }

      return {
        ok: true,
        data: {
          id: data.refund_details?.refund_id || `refund_${Date.now()}`,
          paymentId: input.paymentId,
          amount: input.amountInPaise,
          currency: "INR",
          status: data.refund_details?.refund_status || "processing",
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "PayU refund failed";
      return { ok: false, message };
    }
  }

  async verifyWebhookSignature(input: VerifyWebhookInput): Promise<boolean> {
    try {
      const config = getPayuConfig();
      const payload = JSON.parse(input.rawBody) as Record<string, string>;

      const hashString = `${config.merchantSalt}|${payload.status || ""}|${payload.udf1 || ""}|${payload.udf2 || ""}|${payload.udf3 || ""}|${payload.udf4 || ""}|${payload.udf5 || ""}|${payload.udf6 || ""}|${payload.udf7 || ""}|${payload.udf8 || ""}|${payload.udf9 || ""}|${payload.udf10 || ""}|${payload.key || ""}`;
      const expectedHash = crypto.createHash("sha512").update(hashString).digest("hex").toLowerCase();

      return expectedHash === (payload.hash || "").toLowerCase();
    } catch {
      return false;
    }
  }

  getHealth(): PaymentProviderHealth {
    try {
      const config = getPayuConfig();
      return {
        configured: !!(config.merchantKey && config.merchantSalt && config.authHeader),
        environment: config.environment,
        hasKeyId: !!config.merchantKey,
        hasKeySecret: !!config.merchantSalt,
        hasWebhookSecret: !!config.authHeader,
      };
    } catch {
      return {
        configured: false,
        environment: null,
        hasKeyId: false,
        hasKeySecret: false,
        hasWebhookSecret: false,
      };
    }
  }

  getPublicKey(): string {
    try {
      return getPayuConfig().merchantKey;
    } catch {
      return "";
    }
  }

  getEnvironment(): ProviderEnvironment {
    return getPayuEnvironment();
  }
}
