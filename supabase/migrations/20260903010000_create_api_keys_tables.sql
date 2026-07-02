-- Phase 3.2: Public REST API
-- Creates tables for API keys and API usage tracking

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  scopes TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['read:members', 'write:leads']
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_key ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at DESC);

-- RLS Policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all API keys"
  ON api_keys FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can view all usage logs"
  ON api_usage_logs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  key TEXT;
BEGIN
  -- Generate a secure random key (32 bytes = 64 hex chars)
  key := encode(encode(gen_random_bytes(32), 'hex'), 'base64');
  -- Remove any non-alphanumeric characters and trim to 64 chars
  key := regexp_replace(key, '[^a-zA-Z0-9]', '', 'g');
  key := substring(key, 1, 64);
  
  RETURN 'gms_' || key; -- Prefix with gms_ for gym management system
END;
$$;

-- Function to hash API key
CREATE OR REPLACE FUNCTION hash_api_key(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN crypt(p_key, gen_salt('bf', 10));
END;
$$;

-- Function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(p_key TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key_id UUID;
BEGIN
  SELECT id INTO v_key_id
  FROM public.api_keys
  WHERE key_hash = crypt(p_key, key_hash)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
  
  -- Update last_used_at
  IF v_key_id IS NOT NULL THEN
    UPDATE public.api_keys
    SET last_used_at = NOW()
    WHERE id = v_key_id;
  END IF;
  
  RETURN v_key_id;
END;
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();
