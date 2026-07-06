-- Enterprise CRM sync framework
-- Adds durable outbound sync jobs and external-ID mappings for HubSpot / Zoho CRM.

CREATE TABLE IF NOT EXISTS public.crm_sync_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  external_object_type TEXT NOT NULL DEFAULT 'lead',
  external_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error', 'ignored')),
  last_payload_hash TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_id, entity_type, entity_id),
  UNIQUE (integration_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_mappings_org ON public.crm_sync_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_mappings_integration ON public.crm_sync_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_mappings_entity ON public.crm_sync_mappings(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.crm_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'retry', 'dead_letter')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 6,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  external_id TEXT,
  response_data JSONB,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_jobs_org_status ON public.crm_sync_jobs(organization_id, status, run_after);
CREATE INDEX IF NOT EXISTS idx_crm_sync_jobs_integration ON public.crm_sync_jobs(integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_jobs_entity ON public.crm_sync_jobs(entity_type, entity_id);

ALTER TABLE public.crm_sync_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_sync_mappings_select ON public.crm_sync_mappings;
CREATE POLICY crm_sync_mappings_select ON public.crm_sync_mappings FOR SELECT USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS crm_sync_mappings_write ON public.crm_sync_mappings;
CREATE POLICY crm_sync_mappings_write ON public.crm_sync_mappings FOR ALL USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
) WITH CHECK (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS crm_sync_jobs_select ON public.crm_sync_jobs;
CREATE POLICY crm_sync_jobs_select ON public.crm_sync_jobs FOR SELECT USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS crm_sync_jobs_write ON public.crm_sync_jobs;
CREATE POLICY crm_sync_jobs_write ON public.crm_sync_jobs FOR ALL USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
) WITH CHECK (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_sync_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_sync_jobs TO authenticated;

DROP TRIGGER IF EXISTS set_crm_sync_mappings_updated_at ON public.crm_sync_mappings;
CREATE TRIGGER set_crm_sync_mappings_updated_at
BEFORE UPDATE ON public.crm_sync_mappings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_crm_sync_jobs_updated_at ON public.crm_sync_jobs;
CREATE TRIGGER set_crm_sync_jobs_updated_at
BEFORE UPDATE ON public.crm_sync_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
