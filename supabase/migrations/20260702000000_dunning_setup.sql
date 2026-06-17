-- Add dunning and grace period fields to invoices
ALTER TABLE org_subscription_invoices
  ADD COLUMN IF NOT EXISTS dunning_status text DEFAULT 'none'
    CHECK (dunning_status IN ('none','payment_failed','retry_scheduled','overdue','grace_period','suspended','resolved','waived')),
  ADD COLUMN IF NOT EXISTS dunning_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dunning_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_last_failure_reason text,
  ADD COLUMN IF NOT EXISTS dunning_next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_grace_period_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS dunning_reminder_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dunning_last_reminder_sent_at timestamptz;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inv_dunning_status ON org_subscription_invoices (dunning_status) WHERE dunning_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_dunning_retry ON org_subscription_invoices (dunning_next_retry_at) WHERE dunning_next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_dunning_grace ON org_subscription_invoices (dunning_grace_period_ends_at) WHERE dunning_grace_period_ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_dunning_overdue ON org_subscription_invoices (due_at, dunning_status) WHERE dunning_status IN ('overdue','payment_failed','none');
