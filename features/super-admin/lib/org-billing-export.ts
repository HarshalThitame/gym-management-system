import type { OrganizationDetailData } from "../services/organization-management-service";

export type BillingTimelineEntry = {
  label: string;
  timestamp: string | null;
  tone: "info" | "success" | "warning" | "neutral";
  details: string;
  category: "invoice" | "attempt" | "payment" | "subscription";
};

export type BillingFailureInsight = {
  headline: string;
  detail: string;
  tone: "info" | "warning" | "neutral";
};

type BillingExportSource = Pick<
  OrganizationDetailData,
  "recentPayments" | "paymentAttempts" | "subscriptionInvoices" | "subscriptionPayments" | "record"
>;

export function buildBillingTimeline(data: BillingExportSource, attemptId?: string | null): BillingTimelineEntry[] {
  const subscription = data.record.subscription;
  const selectedAttempt = attemptId ? data.paymentAttempts.find((attempt) => attempt.id === attemptId) ?? null : null;
  const fallbackAttempt = selectedAttempt ?? data.paymentAttempts[0] ?? null;
  const linkedInvoice =
    (fallbackAttempt?.invoice_id ? data.subscriptionInvoices.find((invoice) => invoice.id === fallbackAttempt.invoice_id) : null)
    ?? (subscription.latestInvoiceId ? data.subscriptionInvoices.find((invoice) => invoice.id === subscription.latestInvoiceId) : null)
    ?? data.subscriptionInvoices[0]
    ?? null;
  const linkedPayment =
    (fallbackAttempt?.provider_payment_id
      ? data.subscriptionPayments.find((payment) => payment.provider_payment_id === fallbackAttempt.provider_payment_id)
      : null)
    ?? (subscription.latestPaymentId ? data.subscriptionPayments.find((payment) => payment.id === subscription.latestPaymentId) : null)
    ?? data.subscriptionPayments[0]
    ?? null;

  return [
    {
      label: "Invoice issued",
      timestamp: linkedInvoice?.issued_at ?? linkedInvoice?.created_at ?? null,
      tone: "info",
      category: "invoice",
      details: linkedInvoice
        ? `${linkedInvoice.invoice_number} · ${linkedInvoice.status}`
        : "No linked invoice found."
    },
    {
      label: "Payment attempt",
      timestamp: fallbackAttempt?.created_at ?? null,
      tone: fallbackAttempt?.status === "failed" ? "warning" : fallbackAttempt ? "info" : "neutral",
      category: "attempt",
      details: fallbackAttempt
        ? `${fallbackAttempt.payment_id} · ${fallbackAttempt.status}`
        : "No payment attempt recorded."
    },
    {
      label: "Payment captured",
      timestamp: linkedPayment?.paid_at ?? linkedPayment?.created_at ?? null,
      tone: linkedPayment?.status === "failed" ? "warning" : linkedPayment ? "success" : "neutral",
      category: "payment",
      details: linkedPayment
        ? `${linkedPayment.payment_number} · ${linkedPayment.status}`
        : "No linked payment found."
    },
    {
      label: "Subscription state",
      timestamp: subscription.nextBillingDate ?? subscription.startedAt ?? null,
      tone: subscription.status === "active" ? "success" : subscription.status === "suspended" ? "warning" : "info",
      category: "subscription",
      details: `${subscription.packageName ?? "Unassigned"} · ${subscription.status ?? "unknown"}`
    }
  ];
}

export function buildOrganizationBillingExportRows(data: BillingExportSource): string[][] {
  return [
    ["section", "record_type", "id", "status", "amount", "currency", "provider", "provider_order_id", "provider_payment_id", "invoice_id", "subscription_id", "created_at", "paid_at", "due_at", "failure_reason", "error_code", "error_description"],
    ...summaryRows(data),
    ...data.subscriptionInvoices.map((invoice) => [
      "subscription",
      "invoice",
      invoice.id,
      invoice.status,
      String(invoice.total_amount ?? invoice.amount_due ?? 0),
      invoice.currency,
      invoice.provider,
      invoice.provider_order_id ?? "",
      invoice.razorpay_payment_id ?? "",
      "",
      invoice.subscription_id ?? "",
      invoice.created_at,
      invoice.paid_at ?? "",
      invoice.due_at ?? "",
      invoice.failure_reason ?? "",
      "",
      invoice.dunning_last_failure_reason ?? ""
    ]),
    ...data.subscriptionPayments.map((payment) => [
      "subscription",
      "payment",
      payment.id,
      payment.status,
      String(payment.amount),
      payment.currency,
      payment.provider,
      payment.provider_order_id ?? "",
      payment.provider_payment_id ?? "",
      payment.invoice_id ?? "",
      payment.subscription_id ?? "",
      payment.created_at,
      payment.paid_at ?? "",
      "",
      payment.failure_reason ?? "",
      "",
      payment.failure_reason ?? ""
    ]),
    ...data.paymentAttempts.map((attempt) => [
      "attempt",
      "payment_attempt",
      attempt.id,
      attempt.status,
      String(attempt.amount),
      attempt.currency,
      attempt.provider,
      attempt.provider_order_id ?? "",
      attempt.provider_payment_id ?? "",
      attempt.invoice_id ?? "",
      attempt.subscription_id ?? "",
      attempt.created_at,
      "",
      "",
      "",
      attempt.error_code ?? "",
      attempt.error_description ?? ""
    ]),
    ...data.recentPayments.map((payment) => [
      "operational",
      "payment",
      payment.id,
      payment.status,
      String(payment.amount),
      payment.currency,
      payment.provider ?? "",
      payment.provider_order_id ?? "",
      "",
      payment.invoice_id ?? "",
      "",
      payment.created_at,
      payment.paid_at ?? "",
      "",
      "",
      "",
      ""
    ])
  ];
}

function summaryRows(data: BillingExportSource) {
  const subscription = data.record.subscription;
  return [
    ["summary", "organization", data.record.organization.id, data.record.organization.status, "", "", subscription.billingEngine ?? "", "", "", "", "", "", "", "", "", "", ""],
    ["summary", "package", subscription.packageId ?? "", subscription.packageName ?? "Unassigned", "", "", "", "", "", "", "", subscription.startedAt ?? "", subscription.expiresAt ?? "", "", "", "", ""],
    ["summary", "dunning", subscription.subscriptionId ?? "", subscription.dunningStatus ?? "clear", "", "", "", "", "", "", "", subscription.dunningNextRetry ?? "", "", "", "", "", ""]
  ];
}

export function formatBillingFailureInsight(provider: string | null | undefined, errorCode: string | null | undefined, errorDescription: string | null | undefined): BillingFailureInsight {
  const providerName = normalizeProvider(provider);
  const normalizedCode = normalizeToken(errorCode);
  const normalizedDescription = errorDescription?.trim() ?? "";

  if (providerName === "razorpay") {
    const mapping = razorpayFailureMap[normalizedCode ?? ""] ?? razorpayFailureMap[normalizedDescription.toLowerCase()] ?? null;
    if (mapping) {
      return mapping;
    }
  }

  if (normalizedDescription) {
    return {
      headline: normalizedCode ? humanizeToken(normalizedCode) : "Payment provider error",
      detail: normalizedDescription,
      tone: "warning",
    };
  }

  if (normalizedCode) {
    return {
      headline: humanizeToken(normalizedCode),
      detail: providerName ? `Reported by ${providerName}.` : "Reported by the payment provider.",
      tone: "warning",
    };
  }

  return {
    headline: "No failure reason recorded",
    detail: providerName ? `Provider: ${providerName}.` : "The provider did not return a detailed error.",
    tone: "neutral",
  };
}

export function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function normalizeProvider(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase() || null;
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase() || null;
}

function humanizeToken(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const razorpayFailureMap: Record<string, BillingFailureInsight> = {
  bad_request_error: {
    headline: "Provider rejected the request",
    detail: "Razorpay returned a bad request error. Check the order payload and payment metadata.",
    tone: "warning",
  },
  gateway_error: {
    headline: "Gateway error",
    detail: "The payment gateway reported an execution issue. Retry after verifying provider health.",
    tone: "warning",
  },
  invalid_signature: {
    headline: "Signature verification failed",
    detail: "The payment signature could not be verified. Treat this as a webhook or checkout integrity issue.",
    tone: "warning",
  },
  insufficient_funds: {
    headline: "Insufficient funds",
    detail: "The customer’s payment method did not have enough balance to complete the charge.",
    tone: "warning",
  },
  card_declined: {
    headline: "Card declined",
    detail: "The issuing bank declined the transaction. The customer may need to use another card.",
    tone: "warning",
  },
  authentication_failed: {
    headline: "Authentication failed",
    detail: "The payment requires customer re-authentication or 3DS confirmation.",
    tone: "warning",
  },
  payment_cancelled: {
    headline: "Payment cancelled",
    detail: "The customer cancelled the payment flow before completion.",
    tone: "neutral",
  },
  expired_card: {
    headline: "Expired card",
    detail: "The payment method on file is expired and needs to be updated.",
    tone: "warning",
  },
};
