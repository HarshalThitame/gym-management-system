-- ============================================================================
-- Phase 3: Razorpay Test Mode — Database Layer Preparation
--
-- Adds missing columns, indexes, and constraints for safe enterprise
-- Razorpay payment flow. All changes are idempotent and non-destructive.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. INVOICES — Add missing fields for Razorpay
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE org_subscription_invoices
  ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IN ('monthly', 'annual', 'quarterly', 'half_yearly', 'custom')),
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS provider_environment text CHECK (provider_environment IN ('test', 'live')) DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES packages(id) ON DELETE SET NULL;

-- Idempotency: unique invoice per subscription + billing period
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_sub_period
  ON org_subscription_invoices (subscription_id, billing_period_start, billing_period_end)
  WHERE billing_period_start IS NOT NULL AND billing_period_end IS NOT NULL;

-- Idempotency key uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_idempotency
  ON org_subscription_invoices (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Razorpay order id uniqueness on invoices
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_provider_order
  ON org_subscription_invoices (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- Enterprise scale indexes
CREATE INDEX IF NOT EXISTS idx_invoices_status ON org_subscription_invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON org_subscription_invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_provider_payment ON org_subscription_invoices (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PAYMENTS — Add missing fields for Razorpay
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE org_subscription_payments
  ADD COLUMN IF NOT EXISTS provider_environment text CHECK (provider_environment IN ('test', 'live')) DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS provider_signature_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Idempotency on payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency
  ON org_subscription_payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Unique provider order id on payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order
  ON org_subscription_payments (provider_order_id)
  WHERE provider_order_id IS NOT NULL;

-- Unique provider payment id on payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment
  ON org_subscription_payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- Enterprise scale indexes
CREATE INDEX IF NOT EXISTS idx_payments_status ON org_subscription_payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON org_subscription_payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_org ON org_subscription_payments (organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_sub ON org_subscription_payments (subscription_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PAYMENT ATTEMPTS — Add organization/subscription columns (migrate from gym_id)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE payment_attempts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempt_type text CHECK (attempt_type IN (
    'order_create', 'payment_verify', 'webhook_process', 'retry_payment', 'invoice_generate'
  )),
  ADD COLUMN IF NOT EXISTS billing_period text CHECK (billing_period IN ('monthly', 'annual', 'quarterly', 'half_yearly', 'custom'));

-- Indexes for billing attempts
CREATE INDEX IF NOT EXISTS idx_payment_attempts_org ON payment_attempts (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_sub ON payment_attempts (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_type ON payment_attempts (attempt_type) WHERE attempt_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created ON payment_attempts (created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. WEBHOOK EVENTS (payment_provider_events) — Add missing fields
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE payment_provider_events
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES org_subscription_invoices(id) ON DELETE SET NULL;

-- Indexes for webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON payment_provider_events (event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON payment_provider_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_org ON payment_provider_events (organization_id) WHERE organization_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. SUBSCRIPTION TABLE — Add billing provider fields
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS provider_environment text CHECK (provider_environment IN ('test', 'live')) DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS latest_invoice_id uuid REFERENCES org_subscription_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latest_payment_id uuid REFERENCES org_subscription_payments(id) ON DELETE SET NULL;

-- Enterprise scale indexes
CREATE INDEX IF NOT EXISTS idx_org_subs_billing_cycle ON organization_subscriptions (billing_period) WHERE billing_period IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_subs_next_billing ON organization_subscriptions (next_billing_date) WHERE next_billing_date IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. SUBSCRIPTION EVENTS — Support for payment/order event types
-- ════════════════════════════════════════════════════════════════════════════
-- The subscription_events table already supports:
--   organization_id, subscription_id, event_type, previous_state, new_state,
--   actor_id, reason, metadata, created_at
-- No additional columns needed. The existing table is ready.

-- ════════════════════════════════════════════════════════════════════════════
-- 7. IDEMPOTENCY — payment_idempotency_keys already has all required fields.
--    Unique constraint on idempotency_key already exists.
--    No changes needed.

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERY (run separately to confirm):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='org_subscription_invoices'
-- AND column_name IN ('billing_cycle','provider','provider_environment','payment_link','idempotency_key','package_id');
-- ============================================================================
