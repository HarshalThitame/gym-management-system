-- Phase 2.4: Scheduled Reports
-- Creates tables for scheduled report generation and delivery

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('members', 'leads', 'equipment', 'payments', 'attendance', 'custom')),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_config JSONB NOT NULL DEFAULT '{}', -- Cron expression or specific config
  format TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'excel', 'pdf', 'json')),
  recipients TEXT[] NOT NULL DEFAULT '{}', -- Email addresses
  filters JSONB DEFAULT '{}',
  columns TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  records_count INTEGER DEFAULT 0,
  file_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_org ON scheduled_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_gym ON scheduled_reports(gym_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_report_runs_report ON scheduled_report_runs(report_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_report_runs_status ON scheduled_report_runs(status);

-- RLS Policies
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON scheduled_reports FOR SELECT
  USING (auth.uid() = created_by OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can create reports"
  ON scheduled_reports FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own reports"
  ON scheduled_reports FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own reports"
  ON scheduled_reports FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Service role can manage all reports"
  ON scheduled_reports FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can view own report runs"
  ON scheduled_report_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_reports
      WHERE id = report_id
      AND (created_by = auth.uid() OR auth.jwt()->>'role' = 'service_role')
    )
  );

CREATE POLICY "Service role can manage all report runs"
  ON scheduled_report_runs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Function to calculate next run time
CREATE OR REPLACE FUNCTION calculate_next_run(schedule_type TEXT, schedule_config JSONB)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  next_run TIMESTAMPTZ;
  now_time TIMESTAMPTZ := NOW();
BEGIN
  CASE schedule_type
    WHEN 'daily' THEN
      next_run := date_trunc('day', now_time) + INTERVAL '1 day' + (schedule_config->>'time')::INTERVAL;
    WHEN 'weekly' THEN
      next_run := date_trunc('week', now_time) + 
                  ((schedule_config->>'day')::INTEGER || ' days')::INTERVAL + 
                  (schedule_config->>'time')::INTERVAL;
      IF next_run <= now_time THEN
        next_run := next_run + INTERVAL '1 week';
      END IF;
    WHEN 'monthly' THEN
      next_run := date_trunc('month', now_time) + 
                  ((schedule_config->>'day')::INTEGER - 1 || ' days')::INTERVAL + 
                  (schedule_config->>'time')::INTERVAL;
      IF next_run <= now_time THEN
        next_run := next_run + INTERVAL '1 month';
      END IF;
    ELSE
      next_run := now_time + INTERVAL '1 day';
  END CASE;
  
  RETURN next_run;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();
