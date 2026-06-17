-- Billing hardening: add idempotency and constraints

-- Add idempotency_key to invoices for duplicate prevention
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_idempotency ON org_subscription_invoices (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Add unique constraint per subscription + billing period to prevent duplicate invoices
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS billing_period_label text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_sub_period ON org_subscription_invoices (subscription_id, billing_period_start, billing_period_end);

-- Add payment provider fields if missing
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'razorpay';
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS provider_order_id text;
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS provider_payment_link_id text;
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS dunning_attempts integer DEFAULT 0;

-- Tax/GST support
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS subtotal_amount integer;
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS tax_amount integer DEFAULT 0;
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS discount_amount integer DEFAULT 0;
ALTER TABLE org_subscription_invoices ADD COLUMN IF NOT EXISTS total_amount integer;

-- Add billing_cycle support columns to organization_subscriptions if missing
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS dunning_attempts integer DEFAULT 0;
