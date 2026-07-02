-- Phase 5: Automation & Integration
-- 5.1 Workflow Builder
-- 5.2 Trigger-Based Automation
-- 5.3 Third-Party Integrations
-- 5.4 Feature Flags
-- 5.5 Advanced Analytics

-- ============================================================================
-- 5.1 Workflow Builder
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'schedule', 'webhook', 'manual')),
  trigger_config JSONB DEFAULT '{}',
  steps JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'inactive', 'draft', 'archived')),
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_org ON public.workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON public.workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON public.workflows(trigger_type);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  trigger_event TEXT,
  input_data JSONB DEFAULT '{}',
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);

CREATE TABLE IF NOT EXISTS public.workflow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_index INT NOT NULL,
  step_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  input JSONB DEFAULT '{}',
  output JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_run ON public.workflow_execution_logs(workflow_run_id);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflows_org_select ON public.workflows;
CREATE POLICY workflows_org_select ON public.workflows FOR SELECT USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS workflows_org_insert ON public.workflows;
CREATE POLICY workflows_org_insert ON public.workflows FOR INSERT WITH CHECK (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS workflows_org_update ON public.workflows;
CREATE POLICY workflows_org_update ON public.workflows FOR UPDATE USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS workflows_org_delete ON public.workflows;
CREATE POLICY workflows_org_delete ON public.workflows FOR DELETE USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS workflow_runs_select ON public.workflow_runs;
CREATE POLICY workflow_runs_select ON public.workflow_runs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.workflows WHERE id = workflow_id AND (organization_id = public.current_user_organization_id() OR public.is_super_admin()))
);

DROP POLICY IF EXISTS workflow_execution_logs_select ON public.workflow_execution_logs;
CREATE POLICY workflow_execution_logs_select ON public.workflow_execution_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.workflow_runs WHERE id = workflow_run_id AND EXISTS (SELECT 1 FROM public.workflows WHERE id = workflow_id AND (organization_id = public.current_user_organization_id() OR public.is_super_admin())))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workflow_runs TO authenticated;
GRANT SELECT ON public.workflow_execution_logs TO authenticated;

DROP TRIGGER IF EXISTS set_workflows_updated_at ON public.workflows;
CREATE TRIGGER set_workflows_updated_at
BEFORE UPDATE ON public.workflows
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5.2 Trigger-Based Automation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  event_filters JSONB DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  priority INT NOT NULL DEFAULT 0,
  cooldown_minutes INT DEFAULT 0,
  run_count INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON public.automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_event ON public.automation_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_status ON public.automation_rules(status);

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('triggered', 'completed', 'failed', 'skipped')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON public.automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON public.automation_logs(created_at DESC);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_rules_select ON public.automation_rules;
CREATE POLICY automation_rules_select ON public.automation_rules FOR SELECT USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS automation_rules_insert ON public.automation_rules;
CREATE POLICY automation_rules_insert ON public.automation_rules FOR INSERT WITH CHECK (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS automation_rules_update ON public.automation_rules;
CREATE POLICY automation_rules_update ON public.automation_rules FOR UPDATE USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS automation_rules_delete ON public.automation_rules;
CREATE POLICY automation_rules_delete ON public.automation_rules FOR DELETE USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT SELECT ON public.automation_logs TO authenticated;

DROP TRIGGER IF EXISTS set_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER set_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5.3 Third-Party Integrations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT,
  credentials JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'expired')),
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_org_provider ON public.integrations(organization_id, provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON public.integrations(status);

CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'pending')),
  request_data JSONB DEFAULT '{}',
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON public.integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON public.integration_logs(created_at DESC);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integrations_select ON public.integrations;
CREATE POLICY integrations_select ON public.integrations FOR SELECT USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS integrations_insert ON public.integrations;
CREATE POLICY integrations_insert ON public.integrations FOR INSERT WITH CHECK (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS integrations_update ON public.integrations;
CREATE POLICY integrations_update ON public.integrations FOR UPDATE USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS integrations_delete ON public.integrations;
CREATE POLICY integrations_delete ON public.integrations FOR DELETE USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT SELECT ON public.integration_logs TO authenticated;

DROP TRIGGER IF EXISTS set_integrations_updated_at ON public.integrations;
CREATE TRIGGER set_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5.4 Feature Flags
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INT DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  requires_plan TEXT,
  dependencies TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if table already existed from previous partial run
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='key') THEN
    ALTER TABLE public.feature_flags ADD COLUMN key TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='name') THEN
    ALTER TABLE public.feature_flags ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='category') THEN
    ALTER TABLE public.feature_flags ADD COLUMN category TEXT DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='status') THEN
    ALTER TABLE public.feature_flags ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='metadata') THEN
    ALTER TABLE public.feature_flags ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='default_enabled') THEN
    ALTER TABLE public.feature_flags ADD COLUMN default_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='rollout_percentage') THEN
    ALTER TABLE public.feature_flags ADD COLUMN rollout_percentage INT DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='requires_plan') THEN
    ALTER TABLE public.feature_flags ADD COLUMN requires_plan TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='feature_flags' AND column_name='dependencies') THEN
    ALTER TABLE public.feature_flags ADD COLUMN dependencies TEXT[] DEFAULT '{}';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON public.feature_flags(category);
CREATE INDEX IF NOT EXISTS idx_feature_flags_status ON public.feature_flags(status);

CREATE TABLE IF NOT EXISTS public.org_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, feature_flag_id)
);

CREATE INDEX IF NOT EXISTS idx_org_feature_flags_org ON public.org_feature_flags(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_flag ON public.org_feature_flags(feature_flag_id);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_select ON public.feature_flags;
CREATE POLICY feature_flags_select ON public.feature_flags FOR SELECT USING (true);

DROP POLICY IF EXISTS feature_flags_insert ON public.feature_flags;
CREATE POLICY feature_flags_insert ON public.feature_flags FOR INSERT WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS feature_flags_update ON public.feature_flags;
CREATE POLICY feature_flags_update ON public.feature_flags FOR UPDATE USING (public.is_super_admin());

DROP POLICY IF EXISTS feature_flags_delete ON public.feature_flags;
CREATE POLICY feature_flags_delete ON public.feature_flags FOR DELETE USING (public.is_super_admin());

DROP POLICY IF EXISTS org_feature_flags_select ON public.org_feature_flags;
CREATE POLICY org_feature_flags_select ON public.org_feature_flags FOR SELECT USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS org_feature_flags_insert ON public.org_feature_flags;
CREATE POLICY org_feature_flags_insert ON public.org_feature_flags FOR INSERT WITH CHECK (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS org_feature_flags_update ON public.org_feature_flags;
CREATE POLICY org_feature_flags_update ON public.org_feature_flags FOR UPDATE USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.org_feature_flags TO authenticated;

DROP TRIGGER IF EXISTS set_feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER set_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_org_feature_flags_updated_at ON public.org_feature_flags;
CREATE TRIGGER set_org_feature_flags_updated_at
BEFORE UPDATE ON public.org_feature_flags
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5.5 Advanced Analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if table already existed from previous partial run
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics_events' AND column_name='organization_id') THEN
    ALTER TABLE public.analytics_events ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics_events' AND column_name='event_type') THEN
    ALTER TABLE public.analytics_events ADD COLUMN event_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics_events' AND column_name='event_name') THEN
    ALTER TABLE public.analytics_events ADD COLUMN event_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics_events' AND column_name='properties') THEN
    ALTER TABLE public.analytics_events ADD COLUMN properties JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics_events' AND column_name='session_id') THEN
    ALTER TABLE public.analytics_events ADD COLUMN session_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analytics_events' AND column_name='timestamp') THEN
    ALTER TABLE public.analytics_events ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analytics_events_org ON public.analytics_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON public.analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_org_type ON public.analytics_events(organization_id, event_type);

CREATE TABLE IF NOT EXISTS public.analytics_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  time_window_hours INT DEFAULT 168,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_funnels_org ON public.analytics_funnels(organization_id);

CREATE TABLE IF NOT EXISTS public.analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('dashboard', 'funnel', 'cohort', 'custom', 'export')),
  config JSONB NOT NULL DEFAULT '{}',
  schedule TEXT,
  last_generated_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_org ON public.analytics_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON public.analytics_reports(report_type);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_events_select ON public.analytics_events;
CREATE POLICY analytics_events_select ON public.analytics_events FOR SELECT USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS analytics_events_insert ON public.analytics_events;
CREATE POLICY analytics_events_insert ON public.analytics_events FOR INSERT WITH CHECK (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_funnels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_reports TO authenticated;

DROP TRIGGER IF EXISTS set_analytics_funnels_updated_at ON public.analytics_funnels;
CREATE TRIGGER set_analytics_funnels_updated_at
BEFORE UPDATE ON public.analytics_funnels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_analytics_reports_updated_at ON public.analytics_reports;
CREATE TRIGGER set_analytics_reports_updated_at
BEFORE UPDATE ON public.analytics_reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
