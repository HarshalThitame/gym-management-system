-- ============================================================================
-- Payment System Hardening: Additional constraints, indexes, and safety
-- All changes are idempotent and non-destructive.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. PAYMENTS — Add provider + environment unique constraints
-- ════════════════════════════════════════════════════════════════════════════

-- Unique provider payment id (across provider + environment)
DROP INDEX IF EXISTS idx_payments_provider_payment_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment_env
  ON org_subscription_payments (provider, provider_environment, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- Unique provider order id on payments
DROP INDEX IF EXISTS idx_payments_provider_order;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_env
  ON org_subscription_payments (provider, provider_environment, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. INVOICES — Add provider + environment unique constraints
-- ════════════════════════════════════════════════════════════════════════════

-- Unique provider order id on invoices
DROP INDEX IF EXISTS idx_invoices_provider_order;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_provider_order_env
  ON org_subscription_invoices (provider, provider_environment, razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- Idempotency key uniqueness (already exists as idx_invoices_idempotency)
-- Verify it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_idempotency'
  ) THEN
    CREATE UNIQUE INDEX idx_invoices_idempotency
      ON org_subscription_invoices (idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

-- Unique subscription billing period
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_sub_period_unique
  ON org_subscription_invoices (subscription_id, billing_period_start, billing_period_end, billing_cycle)
  WHERE subscription_id IS NOT NULL AND billing_period_start IS NOT NULL AND billing_period_end IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. WEBHOOK EVENTS — Unique event id per provider + environment
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE payment_provider_events
  ADD COLUMN IF NOT EXISTS provider_environment text CHECK (provider_environment IN ('test', 'live')) DEFAULT 'test';

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'payment_provider_events'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%provider%'
      AND pg_get_constraintdef(c.oid) ILIKE '%event_id%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%provider_environment%'
  LOOP
    EXECUTE format('ALTER TABLE public.payment_provider_events DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event
  ON payment_provider_events (provider, provider_environment, event_id)
  WHERE event_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. BILLING ATTEMPTS — Additional indexes
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice
  ON payment_attempts (invoice_id) WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_provider_order
  ON payment_attempts (provider_order_id) WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_provider_payment
  ON payment_attempts (provider_payment_id) WHERE provider_payment_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. SUBSCRIPTION EVENTS - Additional indexes
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_subscription_events_org
  ON subscription_events (organization_id) WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_events_type
  ON subscription_events (event_type);

CREATE INDEX IF NOT EXISTS idx_subscription_events_created
  ON subscription_events (created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. INVOICE LOOKUP BY PROVIDER ORDER ID
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_invoices_razorpay_order
  ON org_subscription_invoices (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. SUBSCRIPTION LOOKUP BY ORGANIZATION
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_org_subs_org_id
  ON organization_subscriptions (organization_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. WEBHOOK PROCESSING STATUS INDEX
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON payment_provider_events (status) WHERE status IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Run to confirm constraints exist
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'org_subscription_payments';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'org_subscription_invoices';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'payment_provider_events';
-- ============================================================================
