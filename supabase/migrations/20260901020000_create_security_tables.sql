-- Phase 1.4-1.6: Session Management, IP Whitelisting, Password Policy
-- Creates tables for security hardening

-- Active sessions table (may already exist from earlier migration with different schema)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  device_name TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  os_name TEXT,
  browser_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If table already existed from earlier migration, add Phase 1 columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='is_active') THEN
    ALTER TABLE user_sessions ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='session_token') THEN
    ALTER TABLE user_sessions ADD COLUMN session_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='device_name') THEN
    ALTER TABLE user_sessions ADD COLUMN device_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='os_name') THEN
    ALTER TABLE user_sessions ADD COLUMN os_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='browser_name') THEN
    ALTER TABLE user_sessions ADD COLUMN browser_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='last_activity_at') THEN
    ALTER TABLE user_sessions ADD COLUMN last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='expires_at') THEN
    ALTER TABLE user_sessions ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- IP whitelist table
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  ip_range TEXT, -- CIDR notation
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, ip_address)
);

-- Password policy table (may already exist from earlier migration with different schema)
CREATE TABLE IF NOT EXISTS password_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  min_length INTEGER NOT NULL DEFAULT 12,
  require_uppercase BOOLEAN NOT NULL DEFAULT true,
  require_lowercase BOOLEAN NOT NULL DEFAULT true,
  require_numbers BOOLEAN NOT NULL DEFAULT true,
  require_special_chars BOOLEAN NOT NULL DEFAULT true,
  max_age_days INTEGER,
  prevent_reuse_count INTEGER DEFAULT 5,
  max_login_attempts INTEGER NOT NULL DEFAULT 5,
  lockout_duration_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add Phase 1 columns if table already existed from earlier migration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_policies' AND column_name='require_special_chars') THEN
    ALTER TABLE password_policies ADD COLUMN require_special_chars BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_policies' AND column_name='max_age_days') THEN
    ALTER TABLE password_policies ADD COLUMN max_age_days INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_policies' AND column_name='prevent_reuse_count') THEN
    ALTER TABLE password_policies ADD COLUMN prevent_reuse_count INTEGER DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_policies' AND column_name='max_login_attempts') THEN
    ALTER TABLE password_policies ADD COLUMN max_login_attempts INTEGER NOT NULL DEFAULT 5;
  END IF;
END $$;

-- Password history table (for preventing reuse)
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Login attempts table (for rate limiting and lockout)
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Account lockouts
CREATE TABLE IF NOT EXISTS account_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  ip_address TEXT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ NOT NULL,
  reason TEXT,
  unlocked_at TIMESTAMPTZ,
  UNIQUE(email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_org ON ip_whitelist(organization_id);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_gym ON ip_whitelist(gym_id);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_active ON ip_whitelist(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_email ON account_lockouts(email);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_until ON account_lockouts(locked_until);

-- RLS Policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- IP whitelist - service role only for management
CREATE POLICY "Service role can manage IP whitelist"
  ON ip_whitelist FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Authenticated users can view IP whitelist"
  ON ip_whitelist FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Password policies - service role for management
CREATE POLICY "Service role can manage password policies"
  ON password_policies FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Authenticated users can view password policies"
  ON password_policies FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Password history - service role only
CREATE POLICY "Service role can manage password history"
  ON password_history FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Login attempts - service role only
CREATE POLICY "Service role can manage login attempts"
  ON login_attempts FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Account lockouts - service role only
CREATE POLICY "Service role can manage account lockouts"
  ON account_lockouts FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Functions
CREATE OR REPLACE FUNCTION is_ip_whitelisted(p_ip TEXT, p_gym_id UUID DEFAULT NULL, p_org_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_whitelisted BOOLEAN;
  has_rules BOOLEAN;
BEGIN
  -- Check if there are any whitelist rules
  SELECT EXISTS(
    SELECT 1 FROM public.ip_whitelist
    WHERE is_active = true
    AND (gym_id = p_gym_id OR organization_id = p_org_id)
  ) INTO has_rules;

  -- If no rules, allow all
  IF NOT has_rules THEN
    RETURN true;
  END IF;

  -- Check if IP is in whitelist
  SELECT EXISTS(
    SELECT 1 FROM public.ip_whitelist
    WHERE is_active = true
    AND (gym_id = p_gym_id OR organization_id = p_org_id)
    AND (ip_address = p_ip OR p_ip <<= ip_range::inet)
  ) INTO is_whitelisted;

  RETURN is_whitelisted;
END;
$$;

CREATE OR REPLACE FUNCTION is_account_locked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  lock_record RECORD;
BEGIN
  SELECT * INTO lock_record
  FROM public.account_lockouts
  WHERE email = p_email
  AND locked_until > NOW();

  RETURN lock_record.id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION validate_password_strength(p_password TEXT, p_org_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  policy RECORD;
  result JSONB;
  errors TEXT[] := '{}';
BEGIN
  -- Get policy
  SELECT * INTO policy
  FROM public.password_policies
  WHERE organization_id = p_org_id;

  -- Default policy if none found
  IF policy IS NULL THEN
    policy := ROW(
      NULL, NULL, 12, true, true, true, true, NULL, 5, 5, 15, NOW(), NOW()
    )::public.password_policies;
  END IF;

  -- Validate
  IF length(p_password) < policy.min_length THEN
    errors := errors || ('Password must be at least ' || policy.min_length || ' characters');
  END IF;

  IF policy.require_uppercase AND NOT p_password ~ '[A-Z]' THEN
    errors := errors || 'Password must contain at least one uppercase letter';
  END IF;

  IF policy.require_lowercase AND NOT p_password ~ '[a-z]' THEN
    errors := errors || 'Password must contain at least one lowercase letter';
  END IF;

  IF policy.require_numbers AND NOT p_password ~ '[0-9]' THEN
    errors := errors || 'Password must contain at least one number';
  END IF;

  IF policy.require_special_chars AND NOT p_password ~ '[^a-zA-Z0-9]' THEN
    errors := errors || 'Password must contain at least one special character';
  END IF;

  result := jsonb_build_object(
    'valid', array_length(errors, 1) IS NULL,
    'errors', errors
  );

  RETURN result;
END;
$$;

-- Triggers
CREATE TRIGGER update_ip_whitelist_updated_at
  BEFORE UPDATE ON ip_whitelist
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();

CREATE TRIGGER update_password_policies_updated_at
  BEFORE UPDATE ON password_policies
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();
