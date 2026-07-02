-- Phase 2.5: Custom Report Builder
-- Creates tables for saved custom reports and report templates

CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL,
  columns TEXT[] NOT NULL,
  filters JSONB DEFAULT '{}',
  sort_by TEXT,
  sort_order TEXT DEFAULT 'asc' CHECK (sort_order IN ('asc', 'desc')),
  limit_count INTEGER,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL,
  default_columns TEXT[] NOT NULL,
  default_filters JSONB DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'financial', 'operations', 'members', 'marketing')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_reports_org ON custom_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_gym ON custom_reports(gym_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_created_by ON custom_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_reports_public ON custom_reports(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);

-- RLS Policies
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON custom_reports FOR SELECT
  USING (auth.uid() = created_by OR is_public = true OR auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Users can create reports"
  ON custom_reports FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own reports"
  ON custom_reports FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own reports"
  ON custom_reports FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Service role can manage all reports"
  ON custom_reports FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Authenticated users can view templates"
  ON report_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage templates"
  ON report_templates FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Seed system templates
INSERT INTO report_templates (name, description, entity_type, default_columns, category, is_system) VALUES
  ('Active Members Report', 'List of all active gym members', 'members', 
   ARRAY['full_name', 'email', 'phone', 'membership_status', 'join_date'], 'members', true),
  ('New Members This Month', 'Members who joined this month', 'members',
   ARRAY['full_name', 'email', 'phone', 'join_date'], 'members', true),
  ('Payment Summary', 'All payments with amounts and dates', 'payments',
   ARRAY['amount', 'payment_type', 'status', 'created_at'], 'financial', true),
  ('Revenue This Month', 'Payments from current month', 'payments',
   ARRAY['amount', 'payment_type', 'status', 'created_at'], 'financial', true),
  ('Equipment Inventory', 'All equipment with status', 'equipment',
   ARRAY['name', 'category', 'status', 'purchase_date', 'warranty_expiry'], 'operations', true),
  ('Maintenance Due', 'Equipment needing maintenance', 'equipment',
   ARRAY['name', 'category', 'status', 'last_maintenance_date'], 'operations', true),
  ('New Leads This Week', 'Leads created this week', 'crm_leads',
   ARRAY['full_name', 'email', 'phone', 'source', 'status', 'created_at'], 'marketing', true),
  ('Lead Conversion Report', 'Converted vs lost leads', 'crm_leads',
   ARRAY['full_name', 'email', 'status', 'source', 'created_at'], 'marketing', true),
  ('Attendance Summary', 'Recent attendance records', 'attendance_sessions',
   ARRAY['user_id', 'check_in_time', 'check_out_time', 'duration_minutes'], 'operations', true)
ON CONFLICT DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_custom_reports_updated_at
  BEFORE UPDATE ON custom_reports
  FOR EACH ROW EXECUTE FUNCTION update_2fa_updated_at();
