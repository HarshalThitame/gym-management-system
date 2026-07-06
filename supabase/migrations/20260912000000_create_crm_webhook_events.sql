-- Durable inbound CRM webhook tracking and deduplication.
-- Supports HubSpot and Zoho CRM webhook processing with idempotent event handling.

CREATE TABLE IF NOT EXISTS public.crm_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('hubspot', 'zoho_crm')),
  event_id TEXT NOT NULL,
  external_object_type TEXT NOT NULL DEFAULT 'lead',
  external_object_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'duplicate', 'failed')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (integration_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_webhook_events_org ON public.crm_webhook_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_events_integration ON public.crm_webhook_events(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_webhook_events_external ON public.crm_webhook_events(provider, external_object_id);

ALTER TABLE public.crm_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_webhook_events_select ON public.crm_webhook_events;
CREATE POLICY crm_webhook_events_select ON public.crm_webhook_events FOR SELECT USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

DROP POLICY IF EXISTS crm_webhook_events_write ON public.crm_webhook_events;
CREATE POLICY crm_webhook_events_write ON public.crm_webhook_events FOR ALL USING (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
) WITH CHECK (
  organization_id = public.current_user_organization_id() OR public.is_super_admin()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_webhook_events TO authenticated;

DROP TRIGGER IF EXISTS set_crm_webhook_events_updated_at ON public.crm_webhook_events;
CREATE TRIGGER set_crm_webhook_events_updated_at
BEFORE UPDATE ON public.crm_webhook_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
