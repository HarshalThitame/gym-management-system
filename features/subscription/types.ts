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
