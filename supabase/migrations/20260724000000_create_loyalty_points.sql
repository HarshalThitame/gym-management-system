-- Loyalty Points System (Phase 3.5)
-- Enterprise plan: members earn points for check-ins, renewals, referrals, purchases
-- Points can be redeemed against membership renewal invoices

-- ─── Loyalty points configuration (one per organization) ───────────────────
CREATE TABLE IF NOT EXISTS loyalty_points_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  points_per_check_in integer NOT NULL DEFAULT 10,
  points_per_renewal_percentage integer NOT NULL DEFAULT 5,  -- 5 points per 100 INR spent
  points_per_referral integer NOT NULL DEFAULT 100,
  points_redemption_rate integer NOT NULL DEFAULT 100,       -- 100 points = 1 INR discount
  min_points_to_redeem integer NOT NULL DEFAULT 0,
  max_redemption_percentage integer DEFAULT 100,             -- max % of invoice redeemable with points
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id)
);

-- Enable RLS
ALTER TABLE loyalty_points_config ENABLE ROW LEVEL SECURITY;

-- ─── Loyalty points ledger ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_points (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points != 0),  -- positive = earned, negative = redeemed
  source_type text NOT NULL CHECK (source_type IN ('check_in', 'renewal', 'referral', 'purchase', 'redemption', 'adjustment')),
  source_id uuid,  -- reference to the event (attendance_session, membership, referral_reward, etc.)
  description text,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_loyalty_points_org_member ON loyalty_points (organization_id, member_id);
CREATE INDEX idx_loyalty_points_member_created ON loyalty_points (member_id, created_at);
CREATE INDEX idx_loyalty_points_source_type ON loyalty_points (source_type);

-- Enable RLS
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

-- ─── Member points balance function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_member_points_balance(member_uuid uuid)
RETURNS integer AS $$
  SELECT COALESCE(SUM(points), 0) FROM loyalty_points WHERE member_id = member_uuid;
$$ LANGUAGE sql STABLE;

-- ─── RLS policies ──────────────────────────────────────────────────────────
-- Config: organization owners can read/manage their own config
CREATE POLICY "loyalty_config_org_select" ON loyalty_points_config
  FOR SELECT
  USING (public.is_organization_owner(organization_id));

CREATE POLICY "loyalty_config_org_insert" ON loyalty_points_config
  FOR INSERT
  WITH CHECK (public.is_organization_owner(organization_id));

CREATE POLICY "loyalty_config_org_update" ON loyalty_points_config
  FOR UPDATE
  USING (public.is_organization_owner(organization_id));

-- Config: super admins can manage all configs
CREATE POLICY "loyalty_config_super_admin" ON loyalty_points_config
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Points: organization owners can read points for their org
CREATE POLICY "loyalty_points_org_select" ON loyalty_points
  FOR SELECT
  USING (public.is_organization_owner(organization_id));

-- Points: super admins can read all points
CREATE POLICY "loyalty_points_super_admin" ON loyalty_points
  FOR SELECT
  USING (public.is_super_admin());

-- Points: server-side inserts only (earn/redeem actions use service role)
CREATE POLICY "loyalty_points_service_insert" ON loyalty_points
  FOR INSERT
  WITH CHECK (true);

-- ─── RPC: get top loyalty members by balance ───────────────────────────────
CREATE OR REPLACE FUNCTION get_top_loyalty_members(org_id uuid, limit_count integer DEFAULT 10)
RETURNS TABLE (
  member_id uuid,
  full_name text,
  balance integer
) AS $$
  SELECT
    lp.member_id,
    m.full_name,
    SUM(lp.points)::integer AS balance
  FROM loyalty_points lp
  INNER JOIN members m ON m.id = lp.member_id
  WHERE lp.organization_id = org_id
  GROUP BY lp.member_id, m.full_name
  ORDER BY balance DESC
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;
