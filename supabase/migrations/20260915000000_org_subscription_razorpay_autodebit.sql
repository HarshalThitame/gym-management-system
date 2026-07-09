-- ============================================================================
-- Org subscription Razorpay auto-debit support
-- - Adds provider subscription metadata to organization billing tables.
-- - Stores Razorpay plan ids against package_pricing rows.
-- - Keeps invoice/payment records as accounting artifacts only.
-- ============================================================================

ALTER TABLE public.package_pricing
  ADD COLUMN IF NOT EXISTS provider_plan_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_package_pricing_provider_plan
  ON public.package_pricing (provider_plan_id)
  WHERE provider_plan_id IS NOT NULL;

ALTER TABLE public.org_payment_methods
  ADD COLUMN IF NOT EXISTS provider_payment_method_id text,
  ADD COLUMN IF NOT EXISTS provider_mandate_id text,
  ADD COLUMN IF NOT EXISTS mandate_status text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_payment_methods_provider_payment_method
  ON public.org_payment_methods (organization_id, provider_payment_method_id)
  WHERE provider_payment_method_id IS NOT NULL;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_engine text NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_plan_id text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS provider_mandate_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_method_id text;

ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_billing_engine_check;

ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_billing_engine_check
  CHECK (billing_engine IN ('invoice', 'subscription'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_subscriptions_provider_subscription
  ON public.organization_subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_billing_engine
  ON public.organization_subscriptions (billing_engine, status)
  WHERE billing_engine IS NOT NULL;

ALTER TABLE public.org_subscription_invoices
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

ALTER TABLE public.org_subscription_payments
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_org_sub_payment_provider_subscription
  ON public.org_subscription_payments (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

