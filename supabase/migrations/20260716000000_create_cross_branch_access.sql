-- Phase 2.6: Cross-Branch Member Access
-- Allows Enterprise plan members to check in at any branch in the organization.
-- Configurable per-member or org-wide access rules with priority ordering.

-- ═══ CROSS-BRANCH ACCESS RULES ═══
CREATE TABLE IF NOT EXISTS cross_branch_access_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  from_branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  to_branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_allowed boolean DEFAULT true,
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT cross_branch_rules_scope CHECK (member_id IS NOT NULL OR member_id IS NULL)
);

COMMENT ON CONSTRAINT cross_branch_rules_scope ON cross_branch_access_rules IS 'Either per-member (member_id NOT NULL) or org-wide (member_id NULL).';

CREATE INDEX idx_cross_branch_rules_org ON cross_branch_access_rules(organization_id);
CREATE INDEX idx_cross_branch_rules_member ON cross_branch_access_rules(member_id);
CREATE INDEX idx_cross_branch_rules_branches ON cross_branch_access_rules(from_branch_id, to_branch_id);

ALTER TABLE cross_branch_access_rules ENABLE ROW LEVEL SECURITY;

-- Org Owners can manage rules for their organization
CREATE POLICY "Org owners manage cross-branch rules"
  ON cross_branch_access_rules
  FOR ALL
  USING (public.is_organization_owner(organization_id))
  WITH CHECK (public.is_organization_owner(organization_id));

-- Super admins can manage all rules
CREATE POLICY "Super admins manage cross-branch rules"
  ON cross_branch_access_rules
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ═══ CROSS-BRANCH ACCESS LOGS (AUDIT) ═══
CREATE TABLE IF NOT EXISTS cross_branch_access_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  attendance_session_id uuid REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  from_gym_id uuid REFERENCES gyms(id) ON DELETE SET NULL,
  to_gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES cross_branch_access_rules(id) ON DELETE SET NULL,
  rule_name text,
  decision text NOT NULL CHECK (decision IN ('allowed', 'denied')),
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cross_branch_logs_org ON cross_branch_access_logs(organization_id);
CREATE INDEX idx_cross_branch_logs_member ON cross_branch_access_logs(member_id);
CREATE INDEX idx_cross_branch_logs_created ON cross_branch_access_logs(created_at);

ALTER TABLE cross_branch_access_logs ENABLE ROW LEVEL SECURITY;

-- Org Owners can read logs for their org; system writes at check-in via service role
CREATE POLICY "Org owners view cross-branch logs"
  ON cross_branch_access_logs
  FOR SELECT
  USING (public.is_organization_owner(organization_id));

-- Super admins can view all logs
CREATE POLICY "Super admins view cross-branch logs"
  ON cross_branch_access_logs
  FOR SELECT
  USING (public.is_super_admin());

-- Allow system insert (for check-in flow using service role or supabase admin client)
CREATE POLICY "System inserts cross-branch logs"
  ON cross_branch_access_logs
  FOR INSERT
  WITH CHECK (true);
