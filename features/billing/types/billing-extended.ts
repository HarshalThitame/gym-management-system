export const creditNoteStatuses = ["draft", "issued", "applied", "fully_applied", "cancelled"] as const;
export type CreditNoteStatus = (typeof creditNoteStatuses)[number];

export const writeOffStatuses = ["pending_approval", "approved", "applied", "rejected"] as const;
export type WriteOffStatus = (typeof writeOffStatuses)[number];

export const disputeStatuses = ["opened", "under_review", "won", "lost", "closed"] as const;
export type DisputeStatus = (typeof disputeStatuses)[number];

export const disputeReasons = [
  "duplicate_charge", "product_not_received", "service_not_as_described",
  "subscription_cancelled", "amount_incorrect", "fraudulent", "other",
] as const;
export type DisputeReason = (typeof disputeReasons)[number];

export const reconciliationStatuses = ["unmatched", "matched", "flagged", "resolved"] as const;
export type ReconciliationStatus = (typeof reconciliationStatuses)[number];

export const financialPeriodStatuses = ["open", "closing", "closed", "reopened"] as const;
export type FinancialPeriodStatus = (typeof financialPeriodStatuses)[number];

export const paymentMethodTypes = ["card", "upi", "net_banking", "emandate"] as const;
export type PaymentMethodType = (typeof paymentMethodTypes)[number];

export type CreditNote = {
  id: string;
  gym_id: string;
  invoice_id: string;
  member_id: string | null;
  credit_note_number: string;
  reason: string;
  amount: number;
  remaining_amount: number;
  currency: string;
  status: CreditNoteStatus;
  issued_by: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WriteOff = {
  id: string;
  gym_id: string;
  invoice_id: string | null;
  payment_id: string | null;
  amount: number;
  currency: string;
  reason: string;
  status: WriteOffStatus;
  approved_by: string | null;
  requested_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Dispute = {
  id: string;
  gym_id: string;
  payment_id: string;
  invoice_id: string | null;
  member_id: string;
  reason: DisputeReason;
  description: string;
  amount: number;
  currency: string;
  status: DisputeStatus;
  evidence_notes: string | null;
  response_notes: string | null;
  opened_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingReconciliation = {
  id: string;
  gym_id: string;
  date: string;
  provider: string;
  gateway_amount: number;
  system_amount: number;
  difference: number;
  status: ReconciliationStatus;
  notes: string | null;
  reconciled_by: string | null;
  reconciled_at: string | null;
  created_at: string;
};

export type RevenueRecognition = {
  id: string;
  gym_id: string;
  invoice_id: string;
  recognized_amount: number;
  deferred_amount: number;
  recognized_date: string;
  period_start: string;
  period_end: string;
  status: "pending" | "recognized" | "deferred";
  created_at: string;
};

export type FinancialPeriod = {
  id: string;
  gym_id: string;
  period_start: string;
  period_end: string;
  status: FinancialPeriodStatus;
  closed_by: string | null;
  closed_at: string | null;
  lock_version: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgPaymentMethod = {
  id: string;
  organization_id: string;
  provider: string;
  provider_customer_id: string | null;
  payment_type: PaymentMethodType;
  display_name: string;
  last_four: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  card_network: string | null;
  is_default: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BillingMetricsSummary = {
  totalInvoicedMonth: number;
  totalCollectedMonth: number;
  totalRefundedMonth: number;
  totalOutstanding: number;
  totalWrittenOff: number;
  openDisputesCount: number;
  openDisputeAmount: number;
  pendingReconciliationCount: number;
  creditNotesIssued: number;
  creditNotesApplied: number;
  monthOverMonthGrowth: number;
};

export type MonthEndCloseResult = {
  periodId: string;
  periodStart: string;
  periodEnd: string;
  status: FinancialPeriodStatus;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  invoiceCount: number;
  paymentCount: number;
  refundCount: number;
  previousPeriodClosed: boolean;
};
