-- Phase 1.1: Two-Factor Authentication (2FA/MFA)
-- Creates tables for TOTP-based 2FA implementation

-- 2FA methods table
CREATE TABLE IF NOT EXISTS user_2fa_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('totp', 'email', 'sms')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  secret_key TEXT, -- Encrypted TOTP secret
  phone_number TEXT, -- For SMS 2FA
  backup_codes TEXT[], -- Encrypted backup codes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, method_type)
);

-- 2FA verification attempts table (for rate limiting and audit)
CREATE TABLE IF NOT EXISTS user_2fa_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2FA recovery codes table
CREATE TABLE IF NOT EXISTS user_2fa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL, -- Hashed recovery code
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- User 2FA preferences
CREATE TABLE IF NOT EXISTS user_2fa_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  require_2fa BOOLEAN NOT NULL DEFAULT false,
  preferred_method TEXT CHECK (preferred_method IN ('totp', 'email', 'sms')),
  remember_device_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_2fa_methods_user_id ON user_2fa_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_methods_enabled ON user_2fa_methods(user_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_user_2fa_attempts_user_id ON user_2fa_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_attempts_created_at ON user_2fa_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_user_2fa_recovery_codes_user_id ON user_2fa_recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_recovery_codes_unused ON user_2fa_recovery_codes(user_id) WHERE used_at IS NULL;

-- RLS Policies
ALTER TABLE user_2fa_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only view/manage their own 2FA methods
CREATE POLICY "Users can view own 2FA methods"
  ON user_2fa_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own 2FA methods"
  ON user_2fa_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own 2FA methods"
  ON user_2fa_methods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own 2FA methods"
  ON user_2fa_methods FOR DELETE
  USING (auth.uid() = user_id);

-- Users can insert their own attempts
CREATE POLICY "Users can insert own 2FA attempts"
  ON user_2fa_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own attempts
CREATE POLICY "Users can view own 2FA attempts"
  ON user_2fa_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can manage their own recovery codes
CREATE POLICY "Users can view own recovery codes"
  ON user_2fa_recovery_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recovery codes"
  ON user_2fa_recovery_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recovery codes"
  ON user_2fa_recovery_codes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recovery codes"
  ON user_2fa_recovery_codes FOR DELETE
  USING (auth.uid() = user_id);

-- Users can manage their own preferences
CREATE POLICY "Users can view own 2FA preferences"
  ON user_2fa_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own 2FA preferences"
  ON user_2fa_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own 2FA preferences"
  ON user_2fa_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can access all (for admin operations)
CREATE POLICY "Service role can manage all 2FA methods"
  ON user_2fa_methods FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage all 2FA attempts"
  ON user_2fa_attempts FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage all recovery codes"
  ON user_2fa_recovery_codes FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can manage all 2FA preferences"
  ON user_2fa_preferences FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Function to check if user has 2FA enabled
CREATE OR REPLACE FUNCTION user_has_2fa_enabled(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  has_2fa BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.user_2fa_methods
    WHERE user_id = p_user_id
    AND is_enabled = true
    AND is_verified = true
  ) INTO has_2fa;
  RETURN has_2fa;
END;
$$;

-- Function to get recent failed attempts count (for rate limiting)
CREATE OR REPLACE FUNCTION get_recent_2fa_failed_attempts(p_user_id UUID, p_minutes INTEGER DEFAULT 15)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.user_2fa_attempts
  WHERE user_id = p_user_id
    AND success = false
    AND created_at > NOW() - (p_minutes || ' minutes')::INTERVAL;
  RETURN attempt_count;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_2fa_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_2fa_methods_updated_at
  BEFORE UPDATE ON user_2fa_methods
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();

CREATE TRIGGER update_user_2fa_preferences_updated_at
  BEFORE UPDATE ON user_2fa_preferences
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();
