-- Phase 3.1: WebSocket/SSE Integration
-- Creates tables for real-time subscriptions and event tracking

CREATE TABLE IF NOT EXISTS realtime_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS realtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_user ON realtime_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_channel ON realtime_subscriptions(channel);
CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_active ON realtime_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_realtime_events_channel ON realtime_events(channel);
CREATE INDEX IF NOT EXISTS idx_realtime_events_created ON realtime_events(created_at DESC);

-- RLS Policies
ALTER TABLE realtime_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON realtime_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions"
  ON realtime_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON realtime_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON realtime_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions"
  ON realtime_subscriptions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Authenticated users can view events"
  ON realtime_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage all events"
  ON realtime_events FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Function to publish real-time event
CREATE OR REPLACE FUNCTION publish_realtime_event(
  p_channel TEXT,
  p_event_type TEXT,
  p_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.realtime_events (channel, event_type, payload)
  VALUES (p_channel, p_event_type, p_payload)
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;

-- Function to clean up old events (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_realtime_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.realtime_events
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Trigger to update last_seen_at
CREATE OR REPLACE FUNCTION update_realtime_subscription_last_seen()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_seen_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_realtime_subscriptions_last_seen
  BEFORE UPDATE ON realtime_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_realtime_subscription_last_seen();
