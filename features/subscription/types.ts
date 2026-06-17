export const SUBSCRIPTION_REQUEST_TYPES = [
  "purchase",
  "renewal",
  "upgrade",
  "downgrade",
  "cancellation",
  "reactivation",
] as const;

export type SubscriptionRequestType = (typeof SUBSCRIPTION_REQUEST_TYPES)[number];

export const SUBSCRIPTION_REQUEST_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "cancelled_by_organization",
  "completed",
] as const;

export type SubscriptionRequestStatus = (typeof SUBSCRIPTION_REQUEST_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trial",
  "expired",
  "suspended",
  "cancelled",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_PERIODS = [
  "monthly",
  "annual",
] as const;

export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export type SubscriptionRequest = {
  id: string;
  organization_id: string;
  request_type: SubscriptionRequestType;
  status: SubscriptionRequestStatus;
  current_package_id: string | null;
  requested_package_id: string | null;
  requested_billing_period: string | null;
  requested_price: number | null;
  requested_currency: string;
  requested_start_date: string | null;
  requested_end_date: string | null;
  payment_proof_url: string | null;
  payment_proof_uploaded_at: string | null;
  payment_note: string | null;
  requested_by: string;
  approved_by: string | null;
  rejected_by: string | null;
  reason: string | null;
  organization_note: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  requested_at: string;
  under_review_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionRequestWithDetails = SubscriptionRequest & {
  current_package_name?: string;
  requested_package_name?: string;
  requested_by_name?: string;
};

export type OrgSubscriptionDetail = {
  hasSubscription: boolean;
  subscriptionId?: string;
  packageId?: string;
  packageName?: string;
  packageSlug?: string;
  status?: string;
  billingPeriod?: string;
  priceOverride?: number | null;
  startedAt?: string;
  expiresAt?: string | null;
  nextBillingDate?: string | null;
  cancelledAt?: string | null;
  features?: Record<string, unknown>;
  limits?: Record<string, { value: number; label: string }>;
  pendingRequest?: {
    id: string;
    requestType: string;
    status: string;
    requestedAt: string;
    requestedPackageId: string | null;
  } | null;
};

export type PackageInfo = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  trial_days: number;
  color: string | null;
  icon: string | null;
  pricing: Array<{
    billing_period: string;
    price: number;
    currency: string;
    setup_fee: number;
  }>;
  features: Record<string, unknown>;
  limits: Record<string, { value: number; label: string }>;
};

export const REQUEST_TYPE_LABELS: Record<SubscriptionRequestType, string> = {
  purchase: "Purchase",
  renewal: "Renewal",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  cancellation: "Cancellation",
  reactivation: "Reactivation",
};

export const REQUEST_STATUS_LABELS: Record<SubscriptionRequestStatus, string> = {
  pending: "Pending Review",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled_by_organization: "Cancelled",
  completed: "Completed",
};
