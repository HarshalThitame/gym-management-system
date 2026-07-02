-- Phase 4.2: Database Performance Optimization
-- Adds indexes and optimizations for better query performance

-- Members table optimizations
CREATE INDEX IF NOT EXISTS idx_members_email_lower ON members(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_members_status_active ON members(organization_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_members_created_at_desc ON members(organization_id, created_at DESC);

-- Attendance sessions optimizations
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_desc ON attendance_sessions(organization_id, check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance_sessions(member_id, check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_gym_date ON attendance_sessions(gym_id, check_in_time DESC);

-- Payments optimizations
CREATE INDEX IF NOT EXISTS idx_payments_status_date ON payments(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_member_date ON payments(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(organization_id, payment_method);

-- CRM Leads optimizations
CREATE INDEX IF NOT EXISTS idx_leads_status_source ON crm_leads(organization_id, status, source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_date ON crm_leads(assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON crm_leads(LOWER(email));

-- Equipment optimizations
CREATE INDEX IF NOT EXISTS idx_equipment_status_category ON equipment(organization_id, status, category);
CREATE INDEX IF NOT EXISTS idx_equipment_gym_status ON equipment(gym_id, status);

-- Support tickets optimizations
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON support_tickets(organization_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_date ON support_tickets(assigned_to, created_at DESC);

-- Classes optimizations
CREATE INDEX IF NOT EXISTS idx_classes_date_time ON classes(organization_id, class_date, start_time);
CREATE INDEX IF NOT EXISTS idx_classes_instructor ON classes(instructor_id, class_date DESC);

-- Audit logs optimizations
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_date ON audit_logs(action, created_at DESC);

-- Bulk operations optimizations
CREATE INDEX IF NOT EXISTS idx_bulk_ops_status_date ON bulk_operations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_ops_items_status ON bulk_operation_items(operation_id, status);

-- Scheduled reports optimizations
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_runs_report_date ON scheduled_report_runs(report_id, created_at DESC);

-- Custom reports optimizations
CREATE INDEX IF NOT EXISTS idx_custom_reports_org_creator ON custom_reports(organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_custom_reports_public ON custom_reports(is_public) WHERE is_public = true;

-- Realtime events optimizations
CREATE INDEX IF NOT EXISTS idx_realtime_events_channel_date ON realtime_events(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_active ON realtime_subscriptions(is_active, user_id);

-- API keys optimizations
CREATE INDEX IF NOT EXISTS idx_api_keys_active_expires ON api_keys(is_active, expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_key_date ON api_usage_logs(api_key_id, created_at DESC);

-- Webhooks optimizations
CREATE INDEX IF NOT EXISTS idx_webhooks_active_org ON webhooks(is_active, organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_date ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success, created_at DESC);

-- Notifications optimizations
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- 2FA optimizations
CREATE INDEX IF NOT EXISTS idx_2fa_methods_user_active ON user_2fa_methods(user_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_2fa_attempts_user_date ON user_2fa_attempts(user_id, created_at DESC);

-- GDPR optimizations
CREATE INDEX IF NOT EXISTS idx_gdpr_export_status ON gdpr_export_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_status ON gdpr_deletion_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user ON gdpr_consents(user_id, consent_type);

-- Security optimizations
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_active ON ip_whitelist(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_date ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lockouts_until ON account_lockouts(locked_until) WHERE locked_until > NOW();

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_members_org_status_email ON members(organization_id, status, email);
CREATE INDEX IF NOT EXISTS idx_payments_org_status_amount ON payments(organization_id, status, amount);
CREATE INDEX IF NOT EXISTS idx_attendance_org_member_time ON attendance_sessions(organization_id, member_id, check_in_time);

-- Partial indexes for frequently filtered queries
CREATE INDEX IF NOT EXISTS idx_members_active_org ON members(organization_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_leads_new_org ON crm_leads(organization_id) WHERE status = 'new';
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(organization_id) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_tickets_open ON support_tickets(organization_id) WHERE status IN ('open', 'in_progress');

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION analyze_table_stats(table_name TEXT)
RETURNS TABLE(
  row_count BIGINT,
  table_size TEXT,
  index_size TEXT,
  total_size TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = table_name) AS row_count,
    pg_size_pretty(pg_table_size(table_name::regclass)) AS table_size,
    pg_size_pretty(pg_indexes_size(table_name::regclass)) AS index_size,
    pg_size_pretty(pg_total_relation_size(table_name::regclass)) AS total_size;
END;
$$;

-- Function to find missing indexes
CREATE OR REPLACE FUNCTION find_missing_indexes()
RETURNS TABLE(
  schemaname TEXT,
  tablename TEXT,
  attname TEXT,
  n_distinct REAL,
  correlated REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.schemaname::TEXT,
    s.tablename::TEXT,
    s.attname::TEXT,
    s.n_distinct,
    s.correlated
  FROM pg_stats s
  WHERE s.schemaname = 'public'
    AND s.n_distinct > 0.1
    AND NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = (s.schemaname || '.' || s.tablename)::regclass
        AND s.attname = ANY(ARRAY(SELECT attname FROM pg_attribute WHERE attrelid = i.indrelid AND attnum = ANY(i.indkey)))
    )
  ORDER BY s.n_distinct DESC
  LIMIT 50;
END;
$$;

-- Function to get slow queries
CREATE OR REPLACE FUNCTION get_slow_queries(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  query TEXT,
  calls BIGINT,
  total_time NUMERIC,
  mean_time NUMERIC,
  rows BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.query::TEXT,
    p.calls,
    p.total_exec_time AS total_time,
    p.mean_exec_time AS mean_time,
    p.rows
  FROM pg_stat_statements p
  WHERE p.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
  ORDER BY p.mean_exec_time DESC
  LIMIT limit_count;
END;
$$;
