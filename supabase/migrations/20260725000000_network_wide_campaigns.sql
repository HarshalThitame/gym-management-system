-- Network-Wide Campaign Manager (Phase 3.6)
-- Extends the campaigns table for multi-branch, multi-channel campaigns
-- with advanced member segment targeting and per-recipient delivery tracking.

-- ─── Extend campaigns table ─────────────────────────────────────────────────
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS target_gym_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS channels text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS segment_filters jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS message_body jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sent_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opened_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count integer DEFAULT 0;

-- ─── Per-recipient delivery tracking ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_deliveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced')),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cdeliveries_campaign ON campaign_deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS idx_cdeliveries_member ON campaign_deliveries (member_id);
CREATE INDEX IF NOT EXISTS idx_cdeliveries_org ON campaign_deliveries (organization_id);
CREATE INDEX IF NOT EXISTS idx_cdeliveries_channel_status ON campaign_deliveries (channel, status);

-- ─── RLS: campaign_deliveries ───────────────────────────────────────────────
ALTER TABLE campaign_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_owner_select_campaign_deliveries" ON campaign_deliveries;
CREATE POLICY "org_owner_select_campaign_deliveries" ON campaign_deliveries
  FOR SELECT
  USING (
    public.is_super_admin()
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name = 'organization_owner'
        AND ur.gym_id IN (
          SELECT g.id FROM public.gyms g
          WHERE g.organization_id = campaign_deliveries.organization_id
        )
    )
  );

DROP POLICY IF EXISTS "org_owner_insert_campaign_deliveries" ON campaign_deliveries;
CREATE POLICY "org_owner_insert_campaign_deliveries" ON campaign_deliveries
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name = 'organization_owner'
        AND ur.gym_id IN (
          SELECT g.id FROM public.gyms g
          WHERE g.organization_id = campaign_deliveries.organization_id
        )
    )
  );

DROP POLICY IF EXISTS "org_owner_update_campaign_deliveries" ON campaign_deliveries;
CREATE POLICY "org_owner_update_campaign_deliveries" ON campaign_deliveries
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name = 'organization_owner'
        AND ur.gym_id IN (
          SELECT g.id FROM public.gyms g
          WHERE g.organization_id = campaign_deliveries.organization_id
        )
    )
  );
