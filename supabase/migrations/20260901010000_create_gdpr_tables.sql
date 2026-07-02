-- Phase 1.3: GDPR Compliance Tools
-- Creates tables for data protection compliance

-- Data export requests
CREATE TABLE IF NOT EXISTS gdpr_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'csv', 'pdf')),
  download_url TEXT,
  download_expires_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Data deletion requests (right to be forgotten)
CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'processing', 'completed', 'rejected')),
  reason TEXT,
  rejection_reason TEXT,
  legal_hold BOOLEAN NOT NULL DEFAULT false,
  legal_hold_reason TEXT,
  data_summary JSONB, -- Summary of data that will be deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ
);

-- Consent records
CREATE TABLE IF NOT EXISTS gdpr_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- e.g., 'marketing_emails', 'sms_notifications', 'data_processing', 'cookies'
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  version TEXT, -- Version of the consent text
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, consent_type)
);

-- Consent definitions (what consents are available)
CREATE TABLE IF NOT EXISTS gdpr_consent_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT 'optional' CHECK (category IN ('required', 'functional', 'analytics', 'marketing')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data processing records (Article 30)
CREATE TABLE IF NOT EXISTS gdpr_processing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  gym_id UUID REFERENCES gyms(id),
  purpose TEXT NOT NULL,
  legal_basis TEXT NOT NULL CHECK (legal_basis IN ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests')),
  data_categories TEXT[] NOT NULL,
  data_subjects TEXT[] NOT NULL,
  retention_period TEXT NOT NULL,
  security_measures TEXT,
  third_party_recipients TEXT[],
  international_transfers BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data breach records
CREATE TABLE IF NOT EXISTS gdpr_breach_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reported_to_authority_at TIMESTAMPTZ,
  reported_to_subjects_at TIMESTAMPTZ,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  data_categories TEXT[],
  affected_subjects_count INTEGER,
  containment_actions TEXT,
  remediation_actions TEXT,
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'contained', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_user_id ON gdpr_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_export_requests_status ON gdpr_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_user_id ON gdpr_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_requests_status ON gdpr_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user_id ON gdpr_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_consents_type ON gdpr_consents(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_processing_records_org ON gdpr_processing_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_breach_records_org ON gdpr_breach_records(organization_id);

-- RLS Policies
ALTER TABLE gdpr_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_consent_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_processing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_breach_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own export requests"
  ON gdpr_export_requests FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = requested_by);

CREATE POLICY "Users can create own export requests"
  ON gdpr_export_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own deletion requests"
  ON gdpr_deletion_requests FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = requested_by);

CREATE POLICY "Users can create own deletion requests"
  ON gdpr_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can manage their own consents
CREATE POLICY "Users can view own consents"
  ON gdpr_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consents"
  ON gdpr_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consents"
  ON gdpr_consents FOR UPDATE
  USING (auth.uid() = user_id);

-- Consent types are readable by all authenticated users
CREATE POLICY "Authenticated users can view consent types"
  ON gdpr_consent_types FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role policies
CREATE POLICY "Service role can manage all export requests"
  ON gdpr_export_requests FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage all deletion requests"
  ON gdpr_deletion_requests FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage all consents"
  ON gdpr_consents FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage consent types"
  ON gdpr_consent_types FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage processing records"
  ON gdpr_processing_records FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage breach records"
  ON gdpr_breach_records FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Seed default consent types
INSERT INTO gdpr_consent_types (key, label, description, is_required, category) VALUES
  ('terms_of_service', 'Terms of Service', 'Required to use the platform', true, 'required'),
  ('privacy_policy', 'Privacy Policy', 'How we handle your data', true, 'required'),
  ('marketing_emails', 'Marketing Emails', 'Receive promotional emails and offers', false, 'marketing'),
  ('sms_notifications', 'SMS Notifications', 'Receive text messages about your account', false, 'marketing'),
  ('push_notifications', 'Push Notifications', 'Receive push notifications on your device', false, 'functional'),
  ('analytics_cookies', 'Analytics Cookies', 'Help us improve by collecting usage data', false, 'analytics'),
  ('functional_cookies', 'Functional Cookies', 'Required for the site to work properly', true, 'functional'),
  ('data_processing', 'Data Processing', 'Consent to process your personal data', true, 'required')
ON CONFLICT (key) DO NOTHING;

-- Function to get user data summary for export
CREATE OR REPLACE FUNCTION get_user_data_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  profile_data JSONB;
  membership_data JSONB;
  payment_data JSONB;
  attendance_data JSONB;
BEGIN
  -- Get profile data
  SELECT jsonb_build_object(
    'full_name', full_name,
    'email', email,
    'phone', phone,
    'created_at', created_at
  ) INTO profile_data
  FROM public.profiles WHERE id = p_user_id;

  -- Get membership count
  SELECT jsonb_build_object('count', COUNT(*))
  INTO membership_data
  FROM public.memberships WHERE user_id = p_user_id;

  -- Get payment count and total
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'total_amount', COALESCE(SUM(amount), 0)
  )
  INTO payment_data
  FROM public.payments WHERE user_id = p_user_id;

  -- Get attendance count
  SELECT jsonb_build_object('count', COUNT(*))
  INTO attendance_data
  FROM public.attendance_sessions WHERE user_id = p_user_id;

  result := jsonb_build_object(
    'profile', profile_data,
    'memberships', membership_data,
    'payments', payment_data,
    'attendance', attendance_data
  );

  RETURN result;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_gdpr_consents_updated_at
  BEFORE UPDATE ON gdpr_consents
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();

CREATE TRIGGER update_gdpr_consent_types_updated_at
  BEFORE UPDATE ON gdpr_consent_types
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();

CREATE TRIGGER update_gdpr_processing_records_updated_at
  BEFORE UPDATE ON gdpr_processing_records
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();

CREATE TRIGGER update_gdpr_breach_records_updated_at
  BEFORE UPDATE ON gdpr_breach_records
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();
