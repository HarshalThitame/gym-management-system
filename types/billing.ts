import type { Database } from "./database";

export const paymentStatuses = ["pending", "processing", "paid", "failed", "refunded", "partially_refunded", "cancelled"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const paymentMethods = ["cash", "upi", "credit_card", "debit_card", "net_banking", "razorpay"] as const;
export type PaymentMethodCode = (typeof paymentMethods)[number];

export const paymentTypes = ["membership_purchase", "membership_renewal", "registration_fee", "personal_training", "class_fee", "other"] as const;
export type PaymentType = (typeof paymentTypes)[number];

export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceItemRow = Database["public"]["Tables"]["invoice_items"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type RefundRow = Database["public"]["Tables"]["refunds"]["Row"];
export type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];
export type DiscountRow = Database["public"]["Tables"]["discounts"]["Row"];
export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

export type InvoiceBundle = {
  invoice: InvoiceRow;
  items: InvoiceItemRow[];
  member: {
    id: string;
    member_code: string;
    full_name: string;
    email: string | null;
    phone: string;
    address: string | null;
  } | null;
  payments: PaymentRow[];
  refunds: RefundRow[];
};

export type RevenueMetrics = {
  todayRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  membershipRevenue: number;
  renewalRevenue: number;
  refundTotal: number;
  outstandingAmount: number;
};
