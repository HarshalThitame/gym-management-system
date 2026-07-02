-- Phase 4.2: Database Performance Optimization
-- Adds indexes and optimizations for better query performance

-- Helper function to safely create indexes
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_members_email_lower ON members(LOWER(email));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_members_email_lower: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_members_status_active ON members(gym_id) WHERE status = 'active';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_members_status_active: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_members_created_at_desc ON members(gym_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_members_created_at_desc: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_attendance_check_in_desc ON attendance_sessions(gym_id, check_in_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_attendance_check_in_desc: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON attendance_sessions(member_id, check_in_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_attendance_member_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_attendance_gym_date ON attendance_sessions(gym_id, check_in_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_attendance_gym_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_status_date ON payments(gym_id, status, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_payments_status_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_member_date ON payments(member_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_payments_member_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(gym_id, method);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_payments_method: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_status_source ON leads(organization_id, status, source);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_leads_status_source: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_assigned_date ON leads(assigned_to, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_leads_assigned_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_email_lower ON leads(LOWER(email));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_leads_email_lower: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_equipment_status_category ON equipment(organization_id, status, category);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_equipment_status_category: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_equipment_gym_status ON equipment(gym_id, status);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_equipment_gym_status: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON support_tickets(organization_id, status, priority DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_tickets_status_priority: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_tickets_assigned_date ON support_tickets(assigned_to, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_tickets_assigned_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_classes_date_time ON class_sessions(gym_id, session_date, starts_at);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_classes_date_time: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_classes_instructor ON class_sessions(primary_trainer_id, session_date DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_classes_instructor: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_audit_logs_entity: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action_date ON audit_logs(action, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_audit_logs_action_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_bulk_ops_status_date ON bulk_operations(status, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_bulk_ops_status_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_bulk_ops_items_status ON bulk_operation_items(operation_id, status);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_bulk_ops_items_status: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_scheduled_reports_next_run: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_report_runs_report_date ON scheduled_report_runs(report_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_report_runs_report_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_custom_reports_org_creator ON custom_reports(organization_id, created_by);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_custom_reports_org_creator: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_custom_reports_public ON custom_reports(is_public) WHERE is_public = true;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_custom_reports_public: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_realtime_events_channel_date ON realtime_events(channel, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_realtime_events_channel_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_realtime_subscriptions_active ON realtime_subscriptions(is_active, user_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_realtime_subscriptions_active: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_api_keys_active_expires ON api_keys(is_active, expires_at) WHERE is_active = true;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_api_keys_active_expires: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_logs(created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_api_usage_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_api_usage_key_date ON api_usage_logs(api_key_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_api_usage_key_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_webhooks_active_org ON webhooks(is_active, organization_id);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_webhooks_active_org: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_date ON webhook_deliveries(webhook_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_webhook_deliveries_webhook_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_webhook_deliveries_success: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_notifications_user_read: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_notifications_unread: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_2fa_methods_user_active ON user_2fa_methods(user_id, is_enabled) WHERE is_enabled = true;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_2fa_methods_user_active: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_2fa_attempts_user_date ON user_2fa_attempts(user_id, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_2fa_attempts_user_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_gdpr_export_status ON gdpr_export_requests(status, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_gdpr_export_status: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_status ON gdpr_deletion_requests(status, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_gdpr_deletion_status: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user ON gdpr_consents(user_id, consent_type);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_gdpr_consents_user: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id, is_active) WHERE is_active = true;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_sessions_user_active: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at) WHERE is_active = true;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_sessions_expires: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_ip_whitelist_active ON ip_whitelist(is_active) WHERE is_active = true;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_ip_whitelist_active: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_login_attempts_email_date ON login_attempts(email, created_at DESC);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_login_attempts_email_date: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_lockouts_until ON account_lockouts(locked_until) WHERE locked_until > NOW();
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_lockouts_until: %', SQLERRM;
END $$;

-- Composite indexes
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_members_org_status_email ON members(gym_id, status, email);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_members_org_status_email: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_org_status_amount ON payments(gym_id, status, amount);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_payments_org_status_amount: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_attendance_org_member_time ON attendance_sessions(gym_id, member_id, check_in_at);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_attendance_org_member_time: %', SQLERRM;
END $$;

-- Partial indexes
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_members_active_org ON members(gym_id) WHERE status = 'active';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_members_active_org: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_leads_new_org ON leads(organization_id) WHERE status = 'new';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_leads_new_org: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments(gym_id) WHERE status IN ('pending', 'processing');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_payments_pending: %', SQLERRM;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_tickets_open ON support_tickets(organization_id) WHERE status IN ('open', 'in_progress');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipped idx_tickets_open: %', SQLERRM;
END $$;

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
