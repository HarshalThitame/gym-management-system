export function toMinorUnits(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

const CURRENCY_LOCALE: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "ar-AE",
  SAR: "ar-SA",
  SGD: "en-SG",
  AUD: "en-AU",
  CAD: "en-CA",
};

export function formatCurrency(amount: number, currency = "INR") {
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount / 100);
}

export function calculateDiscount(input: {
  amount: number;
  discountType: "percentage" | "fixed";
  valueAmount: number;
  maxDiscountAmount?: number | null;
}) {
  const rawDiscount = input.discountType === "percentage"
    ? Math.floor((input.amount * input.valueAmount) / 100)
    : input.valueAmount;
  const capped = input.maxDiscountAmount ? Math.min(rawDiscount, input.maxDiscountAmount) : rawDiscount;

  return Math.min(Math.max(capped, 0), input.amount);
}

export function calculateInvoiceTotals(items: Array<{ quantity: number; unitAmount: number; discountAmount: number; taxAmount: number }>) {
  const subtotalAmount = items.reduce((total, item) => total + Math.round(item.quantity * item.unitAmount), 0);
  const discountAmount = items.reduce((total, item) => total + item.discountAmount, 0);
  const taxAmount = items.reduce((total, item) => total + item.taxAmount, 0);
  const totalAmount = Math.max(subtotalAmount - discountAmount + taxAmount, 0);

  return { subtotalAmount, discountAmount, taxAmount, totalAmount };
}
