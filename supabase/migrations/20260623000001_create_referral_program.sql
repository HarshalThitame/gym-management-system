-- ============================================================================
-- Phase 3.4: Referral Program
-- Extends members table with referral codes and creates reward tracking tables
-- ============================================================================

-- 1. Add referral columns to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_referral_code ON members(referral_code);
CREATE INDEX IF NOT EXISTS idx_members_referred_by ON members(referred_by);

-- 2. Referral rewards table: tracks each successful referral and its payout
CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  referred_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('discount', 'credit', 'free_month')),
  reward_value integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'earned', 'paid', 'expired')),
  earned_at timestamptz,
  paid_at timestamptz,
  expiry_date timestamptz,
  membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_org ON referral_rewards(organization_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_member_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_status ON referral_rewards(status);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- 2b. Policy: organization owners can read their org's rewards
CREATE POLICY "referral_rewards_org_policy" ON referral_rewards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_rewards.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  );

CREATE POLICY "referral_rewards_org_insert" ON referral_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_rewards.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  );

CREATE POLICY "referral_rewards_org_update" ON referral_rewards
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_rewards.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_rewards.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  );

CREATE POLICY "referral_rewards_org_delete" ON referral_rewards
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_rewards.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  );

-- 3. Referral program config: org-level reward configuration
CREATE TABLE IF NOT EXISTS referral_program_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reward_type text NOT NULL DEFAULT 'discount' CHECK (reward_type IN ('discount', 'credit', 'free_month')),
  reward_value integer NOT NULL DEFAULT 10,
  min_membership_days integer DEFAULT 30,
  max_rewards_per_referrer integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE referral_program_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_program_config_org_policy" ON referral_program_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_program_config.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  );

CREATE POLICY "referral_program_config_org_insert" ON referral_program_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_program_config.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  );

CREATE POLICY "referral_program_config_org_update" ON referral_program_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_program_config.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_program_config.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  );

CREATE POLICY "referral_program_config_org_delete" ON referral_program_config
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = referral_program_config.organization_id
      AND organizations.owner_user_id = (select auth.uid())
    )
  );

-- 4. Trigger to auto-update updated_at on referral_rewards and referral_program_config
CREATE OR REPLACE FUNCTION update_referral_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_rewards_updated_at ON referral_rewards;
CREATE TRIGGER trg_referral_rewards_updated_at
  BEFORE UPDATE ON referral_rewards
  FOR EACH ROW EXECUTE FUNCTION update_referral_updated_at();

DROP TRIGGER IF EXISTS trg_referral_program_config_updated_at ON referral_program_config;
CREATE TRIGGER trg_referral_program_config_updated_at
  BEFORE UPDATE ON referral_program_config
  FOR EACH ROW EXECUTE FUNCTION update_referral_updated_at();
