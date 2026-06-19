-- Growth Package Comprehensive Update
-- Adds new feature catalog entries and updates Growth package features/limits/pricing

-- Add new feature catalog entries
DO $$
DECLARE
  v_cat_id uuid;
BEGIN
  SELECT id INTO v_cat_id FROM feature_categories WHERE code = 'membership';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('member_tagging_segments', 'Member Tagging & Segments', 'Tags for targeted communication.', v_cat_id, 'boolean', 'false', 7, 'membership.member_tagging_segments'),
    ('member_progress_tracking', 'Member Progress Tracking', 'Weight, body measurements, fitness milestones.', v_cat_id, 'boolean', 'false', 8, 'membership.member_progress_tracking')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  SELECT id INTO v_cat_id FROM feature_categories WHERE code = 'billing';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('payment_failure_handling', 'Payment Failure Handling', 'Auto-retry failed auto-debits.', v_cat_id, 'boolean', 'false', 9, 'billing.payment_failure_handling'),
    ('partial_payment_dues', 'Partial Payment & Dues Tracking', 'Record partial payment, track outstanding balance.', v_cat_id, 'boolean', 'false', 10, 'billing.partial_payment_dues'),
    ('razorpay_payu_integration', 'Razorpay/PayU Integration', 'Full payment gateway integration.', v_cat_id, 'boolean', 'false', 11, 'billing.razorpay_payu_integration')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  SELECT id INTO v_cat_id FROM feature_categories WHERE code = 'trainer';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('class_attendance_tracking', 'Class Attendance Tracking', 'Mark attended vs no-show.', v_cat_id, 'boolean', 'false', 10, 'trainer.class_attendance_tracking'),
    ('payroll_export', 'Payroll Export', 'Export monthly salary and commission report.', v_cat_id, 'boolean', 'false', 11, 'trainer.payroll_export')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  SELECT id INTO v_cat_id FROM feature_categories WHERE code = 'crm';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('lead_followup_reminders', 'Follow-up Reminders', 'Call/visit reminders, lead status pipeline.', v_cat_id, 'boolean', 'false', 3, 'crm.lead_followup_reminders'),
    ('re_engagement_automation', 'Re-engagement Automation', 'Auto-message inactive members.', v_cat_id, 'boolean', 'false', 4, 'crm.re_engagement_automation')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  SELECT id INTO v_cat_id FROM feature_categories WHERE code = 'reports';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('trainer_performance_report', 'Trainer Performance Report', 'Sessions, PT bookings, ratings.', v_cat_id, 'boolean', 'false', 4, 'reports.trainer_performance_report'),
    ('class_occupancy_report', 'Class Occupancy Report', 'Fill rate per class type.', v_cat_id, 'boolean', 'false', 5, 'reports.class_occupancy_report'),
    ('lead_conversion_report', 'Lead Conversion Report', 'Enquiry to paid conversion funnel.', v_cat_id, 'boolean', 'false', 6, 'reports.lead_conversion_report'),
    ('branch_revenue_comparison', 'Branch Revenue Comparison', 'Compare collections across branches.', v_cat_id, 'boolean', 'false', 7, 'reports.branch_revenue_comparison')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  SELECT id INTO v_cat_id FROM feature_categories WHERE code = 'communication';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('whatsapp_business_api', 'WhatsApp Business API', 'Official WABA integration.', v_cat_id, 'boolean', 'false', 8, 'communication.whatsapp_business_api')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  SELECT id INTO v_cat_id FROM feature_categories WHERE code = 'platform';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('google_calendar_sync', 'Google Calendar Sync', 'Class schedule syncs to Google Calendar.', v_cat_id, 'boolean', 'false', 5, 'platform.google_calendar_sync')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  SELECT id INTO v_cat_id FROM feature_categories WHERE code = 'enterprise';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('tally_zoho_books_integration', 'Tally/Zoho Books Integration', 'Accounting software integration.', v_cat_id, 'boolean', 'false', 8, 'enterprise.tally_zoho_books_integration'),
    ('rest_api_access', 'REST API Access', 'Programmatic data access.', v_cat_id, 'boolean', 'false', 9, 'enterprise.rest_api_access'),
    ('role_based_permissions', 'Role-based Permissions', 'Granular roles with scoped dashboard access.', v_cat_id, 'boolean', 'false', 10, 'enterprise.role_based_permissions')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;
END $$;

-- Update Growth package metadata
UPDATE packages SET
  name = 'Growth',
  description = 'Growth plan is for growing gyms, studios, and small gym chains that need multi-branch access, advanced billing, biometric attendance, CRM, broadcasts, trainer management, analytics, integrations, and branded member experience.',
  is_active = true,
  trial_days = 14,
  color = '#2563eb',
  icon = 'trending-up',
  sort_order = 2,
  price = 749900,
  billing_period = 'monthly',
  metadata = '{"target_customer": "Mid-size gyms and multi-branch setups", "short_description": "Up to 1,000 active members, 3 branches, 15 staff. Includes advanced billing, CRM, analytics."}'::jsonb
WHERE slug = 'growth';

-- Update Growth package features
DO $$
DECLARE
  v_pkg_id uuid;
BEGIN
  SELECT id INTO v_pkg_id FROM packages WHERE slug = 'growth';
  DELETE FROM package_features WHERE package_id = v_pkg_id;

  INSERT INTO package_features (package_id, feature_code, value) VALUES
    (v_pkg_id, 'member_management', 'true'),
    (v_pkg_id, 'manual_attendance', 'true'),
    (v_pkg_id, 'qr_attendance', 'true'),
    (v_pkg_id, 'attendance_reports', 'true'),
    (v_pkg_id, 'dynamic_qr_attendance', 'true'),
    (v_pkg_id, 'biometric_attendance', 'true'),
    (v_pkg_id, 'multi_branch_management', 'true'),
    (v_pkg_id, 'membership_pause_freeze', 'true'),
    (v_pkg_id, 'expiry_tracking', 'true'),
    (v_pkg_id, 'membership_renewals', 'true'),
    (v_pkg_id, 'member_tagging_segments', 'true'),
    (v_pkg_id, 'fingerprint_attendance', 'false'),
    (v_pkg_id, 'billing_invoices', 'true'),
    (v_pkg_id, 'receipts', 'true'),
    (v_pkg_id, 'payment_tracking', 'true'),
    (v_pkg_id, 'online_payment_links', 'true'),
    (v_pkg_id, 'renewal_reminders', 'true'),
    (v_pkg_id, 'auto_billing', 'true'),
    (v_pkg_id, 'discount_promo_codes', 'true'),
    (v_pkg_id, 'payment_failure_handling', 'true'),
    (v_pkg_id, 'partial_payment_dues', 'true'),
    (v_pkg_id, 'razorpay_payu_integration', 'true'),
    (v_pkg_id, 'corporate_bulk_memberships', 'false'),
    (v_pkg_id, 'class_booking', 'true'),
    (v_pkg_id, 'waitlist_management', 'true'),
    (v_pkg_id, 'pt_sessions', 'true'),
    (v_pkg_id, 'class_attendance_tracking', 'true'),
    (v_pkg_id, 'goal_tracking', 'true'),
    (v_pkg_id, 'progress_photos', 'true'),
    (v_pkg_id, 'cross_branch_class_booking', 'false'),
    (v_pkg_id, 'staff_management', 'true'),
    (v_pkg_id, 'role_based_permissions', 'true'),
    (v_pkg_id, 'trainer_management', 'true'),
    (v_pkg_id, 'trainer_commissions_payroll', 'true'),
    (v_pkg_id, 'payroll_export', 'true'),
    (v_pkg_id, 'workout_assignment', 'true'),
    (v_pkg_id, 'nutrition_plans', 'true'),
    (v_pkg_id, 'staff_attendance_leave', 'false'),
    (v_pkg_id, 'advanced_rbac', 'false'),
    (v_pkg_id, 'whatsapp_integration', 'true'),
    (v_pkg_id, 'whatsapp_business_api', 'true'),
    (v_pkg_id, 'sms_integration', 'true'),
    (v_pkg_id, 'email_notifications', 'true'),
    (v_pkg_id, 'in_app_notifications', 'true'),
    (v_pkg_id, 'birthday_greetings', 'true'),
    (v_pkg_id, 'broadcast_messages', 'true'),
    (v_pkg_id, 'email_campaigns', 'true'),
    (v_pkg_id, 'lead_management', 'true'),
    (v_pkg_id, 'lead_followup_reminders', 'true'),
    (v_pkg_id, 're_engagement_automation', 'true'),
    (v_pkg_id, 'trial_management', 'true'),
    (v_pkg_id, 'basic_reports', 'true'),
    (v_pkg_id, 'advanced_reports', 'true'),
    (v_pkg_id, 'ai_retention_analysis', 'true'),
    (v_pkg_id, 'trainer_performance_report', 'true'),
    (v_pkg_id, 'class_occupancy_report', 'true'),
    (v_pkg_id, 'lead_conversion_report', 'true'),
    (v_pkg_id, 'branch_revenue_comparison', 'true'),
    (v_pkg_id, 'custom_dashboards', 'false'),
    (v_pkg_id, 'member_portal', 'true'),
    (v_pkg_id, 'trainer_portal', 'true'),
    (v_pkg_id, 'member_progress_tracking', 'true'),
    (v_pkg_id, 'diet_workout_plans', 'true'),
    (v_pkg_id, 'custom_branding', 'true'),
    (v_pkg_id, 'branded_mobile_app', 'false'),
    (v_pkg_id, 'google_calendar_sync', 'true'),
    (v_pkg_id, 'tally_zoho_books_integration', 'false'),
    (v_pkg_id, 'rest_api_access', 'false'),
    (v_pkg_id, 'api_access', 'false'),
    (v_pkg_id, 'ai_recommendations', 'true'),
    (v_pkg_id, 'white_label', 'false'),
    (v_pkg_id, 'custom_domain', 'false'),
    (v_pkg_id, 'webhooks', 'false'),
    (v_pkg_id, 'audit_logs', 'false'),
    (v_pkg_id, 'priority_support', 'false'),
    (v_pkg_id, 'nfc_attendance', 'true'),
    (v_pkg_id, 'rfid_attendance', 'true'),
    (v_pkg_id, 'branch_attendance', 'true'),
    (v_pkg_id, 'trainer_attendance', 'true'),
    (v_pkg_id, 'staff_attendance', 'true'),
    (v_pkg_id, 'geo_fencing_attendance', 'false'),
    (v_pkg_id, 'attendance_api', 'false'),
    (v_pkg_id, 'ai_coach', 'false'),
    (v_pkg_id, 'ai_revenue_insights', 'false');
END $$;

-- Update Growth limits
DO $$
DECLARE
  v_pkg_id uuid;
BEGIN
  SELECT id INTO v_pkg_id FROM packages WHERE slug = 'growth';
  DELETE FROM package_limits WHERE package_id = v_pkg_id;

  INSERT INTO package_limits (package_id, limit_code, label, value, sort_order) VALUES
    (v_pkg_id, 'max_members', 'Active Members', 1000, 1),
    (v_pkg_id, 'max_branches', 'Branches', 3, 2),
    (v_pkg_id, 'max_staff', 'Staff Users', 15, 3),
    (v_pkg_id, 'max_trainers', 'Trainers', 30, 4),
    (v_pkg_id, 'max_gyms', 'Gyms', 3, 5),
    (v_pkg_id, 'max_storage_gb', 'Storage (GB)', 50, 6),
    (v_pkg_id, 'max_api_calls', 'Monthly API Calls', 10000, 7),
    (v_pkg_id, 'sms_monthly', 'Monthly SMS Limit', 5000, 8),
    (v_pkg_id, 'weekly_classes', 'Weekly Classes', -1, 9),
    (v_pkg_id, 'membership_plan_types', 'Membership Plan Types', -1, 10);
END $$;

-- Update Growth pricing
DO $$
DECLARE
  v_pkg_id uuid;
BEGIN
  SELECT id INTO v_pkg_id FROM packages WHERE slug = 'growth';
  DELETE FROM package_pricing WHERE package_id = v_pkg_id;

  INSERT INTO package_pricing (package_id, billing_period, price, currency) VALUES
    (v_pkg_id, 'monthly', 749900, 'INR'),
    (v_pkg_id, 'quarterly', 2129900, 'INR'),
    (v_pkg_id, 'half_yearly', 4049900, 'INR'),
    (v_pkg_id, 'annual', 7499900, 'INR');
END $$;
