-- Member NPS Surveys (Phase 3.7)
-- Dedicated NPS survey builder for measuring member satisfaction.
-- Separate from the support ticket feedback system (support_customer_feedback).

-- ─── NPS Surveys ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nps_surveys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  question text NOT NULL DEFAULT 'How likely are you to recommend our gym to a friend or colleague?',
  thank_you_message text DEFAULT 'Thank you for your feedback!',
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual', 'after_join', 'after_class', 'after_renewal', 'days_since_join', 'scheduled')),
  trigger_days integer DEFAULT 0,
  target_segment jsonb DEFAULT '{}'::jsonb,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp', 'sms', 'in_app')),
  is_active boolean DEFAULT true,
  sent_count integer DEFAULT 0,
  response_count integer DEFAULT 0,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nps_surveys_org_active ON nps_surveys (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_nps_surveys_trigger ON nps_surveys (trigger_type);

ALTER TABLE nps_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_owner_select_nps_surveys" ON nps_surveys;
CREATE POLICY "org_owner_select_nps_surveys" ON nps_surveys
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
          WHERE g.organization_id = nps_surveys.organization_id
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = (SELECT auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.gyms g
          WHERE g.id = m.gym_id
            AND g.organization_id = nps_surveys.organization_id
        )
    )
  );

DROP POLICY IF EXISTS "org_owner_insert_nps_surveys" ON nps_surveys;
CREATE POLICY "org_owner_insert_nps_surveys" ON nps_surveys
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
          WHERE g.organization_id = nps_surveys.organization_id
        )
    )
  );

DROP POLICY IF EXISTS "org_owner_update_nps_surveys" ON nps_surveys;
CREATE POLICY "org_owner_update_nps_surveys" ON nps_surveys
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
          WHERE g.organization_id = nps_surveys.organization_id
        )
    )
  )
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
          WHERE g.organization_id = nps_surveys.organization_id
        )
    )
  );

DROP POLICY IF EXISTS "org_owner_delete_nps_surveys" ON nps_surveys;
CREATE POLICY "org_owner_delete_nps_surveys" ON nps_surveys
  FOR DELETE
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
          WHERE g.organization_id = nps_surveys.organization_id
        )
    )
  );

-- ─── NPS Responses ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nps_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES nps_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 10),
  nps_category text NOT NULL CHECK (nps_category IN ('promoter', 'passive', 'detractor')),
  feedback text,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms', 'in_app', 'manual')),
  responded_at timestamptz DEFAULT now(),
  UNIQUE (survey_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_nps_responses_org_survey ON nps_responses (organization_id, survey_id);
CREATE INDEX IF NOT EXISTS idx_nps_responses_member ON nps_responses (member_id);
CREATE INDEX IF NOT EXISTS idx_nps_responses_category ON nps_responses (nps_category);
CREATE INDEX IF NOT EXISTS idx_nps_responses_responded ON nps_responses (responded_at);

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_owner_select_nps_responses" ON nps_responses;
CREATE POLICY "org_owner_select_nps_responses" ON nps_responses
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
          WHERE g.organization_id = nps_responses.organization_id
        )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.id = nps_responses.member_id
    )
  );

DROP POLICY IF EXISTS "member_insert_nps_responses" ON nps_responses;
CREATE POLICY "member_insert_nps_responses" ON nps_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.id = nps_responses.member_id
    )
  );

-- ─── NPS Trigger Logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nps_trigger_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES nps_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nps_trigger_survey_member ON nps_trigger_logs (survey_id, member_id);
CREATE INDEX IF NOT EXISTS idx_nps_trigger_sent ON nps_trigger_logs (sent_at);

ALTER TABLE nps_trigger_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_owner_select_nps_trigger_logs" ON nps_trigger_logs;
CREATE POLICY "org_owner_select_nps_trigger_logs" ON nps_trigger_logs
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
          WHERE g.organization_id = nps_trigger_logs.organization_id
        )
    )
  );

DROP POLICY IF EXISTS "org_owner_insert_nps_trigger_logs" ON nps_trigger_logs;
CREATE POLICY "org_owner_insert_nps_trigger_logs" ON nps_trigger_logs
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
          WHERE g.organization_id = nps_trigger_logs.organization_id
        )
    )
  );
