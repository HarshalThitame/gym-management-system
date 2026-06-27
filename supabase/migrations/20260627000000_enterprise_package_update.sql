DO $$
DECLARE
  v_cat uuid;
  v_pkg uuid;
BEGIN
  -- Members & Access category
  SELECT id INTO v_cat FROM feature_categories WHERE code = 'membership';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('custom_member_fields', 'Custom Member Fields', 'Add unlimited custom profile fields.', v_cat, 'boolean', 'false', 9, 'membership.custom_member_fields'),
    ('member_data_import_export', 'Member Data Import/Export', 'Bulk import from CSV, migration support, full data export.', v_cat, 'boolean', 'false', 10, 'membership.member_data_import_export')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  -- Billing category
  SELECT id INTO v_cat FROM feature_categories WHERE code = 'billing';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('multi_gstin_support', 'Multi-GSTIN Support', 'Each branch can have its own GST number.', v_cat, 'boolean', 'false', 14, 'billing.multi_gstin_support'),
    ('branch_revenue_split', 'Revenue Split Across Branches', 'Track and split collections branch-wise.', v_cat, 'boolean', 'false', 16, 'billing.branch_revenue_split')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  -- Class Scheduling category (trainer)
  SELECT id INTO v_cat FROM feature_categories WHERE code = 'trainer';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('network_wide_class_calendar', 'Network-Wide Class Calendar', 'Super Admin/Org Owner can view unified class schedule across all branches.', v_cat, 'boolean', 'false', 12, 'trainer.network_wide_class_calendar'),
    ('trainer_sharing_across_branches', 'Trainer Sharing Across Branches', 'Assign trainer to classes at multiple branches with conflict prevention.', v_cat, 'boolean', 'false', 13, 'trainer.trainer_sharing_across_branches')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  -- Staff category (enterprise)
  SELECT id INTO v_cat FROM feature_categories WHERE code = 'enterprise';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('multi_branch_staff_assignment', 'Multi-Branch Staff Assignment', 'Assign staff to one or multiple branches, track hours per location.', v_cat, 'boolean', 'false', 11, 'enterprise.multi_branch_staff_assignment'),
    ('hr_document_storage', 'HR Document Storage', 'Upload contracts, certificates, ID proofs, joining letters.', v_cat, 'boolean', 'false', 12, 'enterprise.hr_document_storage')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  -- CRM category
  SELECT id INTO v_cat FROM feature_categories WHERE code = 'crm';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('advanced_crm_lead_pipeline', 'Advanced CRM & Lead Pipeline', 'Full sales funnel, lead stages, scoring, task assignment, conversion forecasting.', v_cat, 'boolean', 'false', 5, 'crm.advanced_crm_lead_pipeline'),
    ('referral_program', 'Referral Program', 'Members earn rewards for referrals, auto-apply referral discounts.', v_cat, 'boolean', 'false', 6, 'crm.referral_program'),
    ('loyalty_points_system', 'Loyalty Points System', 'Points for check-ins, renewals, referrals, purchases. Redeem against membership or POS.', v_cat, 'boolean', 'false', 7, 'crm.loyalty_points_system'),
    ('network_wide_campaign_manager', 'Network-Wide Campaign Manager', 'Run one campaign across all branches targeting specific segments.', v_cat, 'boolean', 'false', 8, 'crm.network_wide_campaign_manager'),
    ('member_nps_surveys', 'Member NPS Surveys', 'Auto-trigger satisfaction surveys, track NPS score.', v_cat, 'boolean', 'false', 9, 'crm.member_nps_surveys')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  -- Reports category
  SELECT id INTO v_cat FROM feature_categories WHERE code = 'reports';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('scheduled_report_delivery', 'Scheduled Report Delivery', 'Auto-email weekly/monthly reports to owners, managers, or investors.', v_cat, 'boolean', 'false', 9, 'reports.scheduled_report_delivery'),
    ('equipment_inventory_maintenance', 'Equipment Inventory & Maintenance', 'Track gym equipment, service schedules, AMC expiry, maintenance alerts.', v_cat, 'boolean', 'false', 10, 'reports.equipment_inventory_maintenance'),
    ('data_export_csv_download', 'Data Export & CSV Download', 'Export reports and member datasets as CSV.', v_cat, 'boolean', 'false', 11, 'reports.data_export_csv_download'),
    ('custom_dashboards_kpis', 'Custom Dashboards & KPIs', 'Build, save, and share personalized KPI views.', v_cat, 'boolean', 'false', 13, 'reports.custom_dashboards_kpis')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  -- Communication category
  SELECT id INTO v_cat FROM feature_categories WHERE code = 'communication';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('cross_branch_member_access', 'Cross-Branch Member Access', 'Members can check in at any branch including franchise partner locations.', v_cat, 'boolean', 'false', 9, 'communication.cross_branch_member_access')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  -- Platform category
  SELECT id INTO v_cat FROM feature_categories WHERE code = 'platform';
  INSERT INTO feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order, feature_key) VALUES
    ('in_app_push_notifications', 'In-App Push Notifications', 'Class reminders, offers, renewal prompts, system alerts.', v_cat, 'boolean', 'false', 7, 'platform.in_app_push_notifications'),
    ('digital_membership_card', 'Digital Membership Card', 'Members carry digital card in app showing status, plan, and expiry.', v_cat, 'boolean', 'false', 8, 'platform.digital_membership_card'),
    ('loyalty_rewards_in_app', 'Loyalty & Rewards In-App', 'Members view points balance, redeem rewards, see referral status.', v_cat, 'boolean', 'false', 9, 'platform.loyalty_rewards_in_app')
  ON CONFLICT (code) DO UPDATE SET name = excluded.name, description = excluded.description, feature_key = excluded.feature_key;

  -- Enterprise category (infrastructure) — phantom features removed per Phase 1.1

  -- ============================================================
  -- UPDATE ENTERPRISE PACKAGE
  -- ============================================================
  SELECT id INTO v_pkg FROM packages WHERE slug = 'enterprise';

  UPDATE packages SET
    name = 'Enterprise',
    description = 'Enterprise plan is for large gym chains and multi-branch networks that need unlimited branches, unlimited members, advanced CRM, custom roles, API access, accounting integrations, and premium enterprise controls.',
    is_active = true,
    trial_days = 30,
    color = '#7c3aed',
    icon = 'crown',
    sort_order = 3,
    price = NULL,
    billing_period = 'monthly',
    metadata = '{"target_customer": "Large gym chains, multi-branch networks, premium fitness brands, and enterprise organizations.", "price_label": "Contact Sales", "price_type": "custom", "short_description": "Unlimited everything. Advanced CRM, custom roles, API access, priority support."}'::jsonb
  WHERE id = v_pkg;

  -- Update Enterprise package features (all true for enterprise)
  DELETE FROM package_features WHERE package_id = v_pkg;

  INSERT INTO package_features (package_id, feature_code, value) VALUES
    -- Members & Access
    (v_pkg, 'member_management', 'true'),
    (v_pkg, 'manual_attendance', 'true'),
    (v_pkg, 'qr_attendance', 'true'),
    (v_pkg, 'attendance_reports', 'true'),
    (v_pkg, 'dynamic_qr_attendance', 'true'),
    (v_pkg, 'biometric_attendance', 'true'),
    (v_pkg, 'fingerprint_attendance', 'true'),
    (v_pkg, 'multi_branch_management', 'true'),
    (v_pkg, 'membership_pause_freeze', 'true'),
    (v_pkg, 'expiry_tracking', 'true'),
    (v_pkg, 'membership_renewals', 'true'),
    (v_pkg, 'member_tagging_segments', 'true'),
    (v_pkg, 'member_progress_tracking', 'true'),
    (v_pkg, 'cross_branch_member_access', 'true'),
    (v_pkg, 'custom_member_fields', 'true'),
    (v_pkg, 'member_data_import_export', 'true'),
    -- Billing
    (v_pkg, 'billing_invoices', 'true'),
    (v_pkg, 'receipts', 'true'),
    (v_pkg, 'payment_tracking', 'true'),
    (v_pkg, 'online_payment_links', 'true'),
    (v_pkg, 'renewal_reminders', 'true'),
    (v_pkg, 'auto_billing', 'true'),
    (v_pkg, 'discount_promo_codes', 'true'),
    (v_pkg, 'payment_failure_handling', 'true'),
    (v_pkg, 'partial_payment_dues', 'true'),
    (v_pkg, 'razorpay_payu_integration', 'true'),
    (v_pkg, 'corporate_bulk_memberships', 'true'),
    (v_pkg, 'multi_gstin_support', 'true'),
    (v_pkg, 'branch_revenue_split', 'true'),
    -- Class Scheduling
    (v_pkg, 'class_booking', 'true'),
    (v_pkg, 'waitlist_management', 'true'),
    (v_pkg, 'pt_sessions', 'true'),
    (v_pkg, 'class_attendance_tracking', 'true'),
    (v_pkg, 'goal_tracking', 'true'),
    (v_pkg, 'progress_photos', 'true'),
    (v_pkg, 'cross_branch_class_booking', 'true'),
    (v_pkg, 'network_wide_class_calendar', 'true'),
    (v_pkg, 'trainer_sharing_across_branches', 'true'),
    -- Staff
    (v_pkg, 'staff_management', 'true'),
    (v_pkg, 'role_based_permissions', 'true'),
    (v_pkg, 'advanced_rbac', 'true'),
    (v_pkg, 'trainer_management', 'true'),
    (v_pkg, 'trainer_commissions_payroll', 'true'),
    (v_pkg, 'payroll_export', 'true'),
    (v_pkg, 'staff_attendance_leave', 'true'),
    (v_pkg, 'multi_branch_staff_assignment', 'true'),
    (v_pkg, 'hr_document_storage', 'true'),
    (v_pkg, 'workout_assignment', 'true'),
    (v_pkg, 'nutrition_plans', 'true'),
    -- Communication & CRM
    (v_pkg, 'whatsapp_integration', 'true'),
    (v_pkg, 'whatsapp_business_api', 'true'),
    (v_pkg, 'sms_integration', 'true'),
    (v_pkg, 'email_notifications', 'true'),
    (v_pkg, 'in_app_notifications', 'true'),
    (v_pkg, 'birthday_greetings', 'true'),
    (v_pkg, 'broadcast_messages', 'true'),
    (v_pkg, 'email_campaigns', 'true'),
    (v_pkg, 'lead_management', 'true'),
    (v_pkg, 'lead_followup_reminders', 'true'),
    (v_pkg, 're_engagement_automation', 'true'),
    (v_pkg, 'trial_management', 'true'),
    (v_pkg, 'advanced_crm_lead_pipeline', 'true'),
    (v_pkg, 'referral_program', 'true'),
    (v_pkg, 'loyalty_points_system', 'true'),
    (v_pkg, 'network_wide_campaign_manager', 'true'),
    (v_pkg, 'member_nps_surveys', 'true'),
    -- Reports
    (v_pkg, 'basic_reports', 'true'),
    (v_pkg, 'advanced_reports', 'true'),
    (v_pkg, 'ai_retention_analysis', 'true'),
    (v_pkg, 'trainer_performance_report', 'true'),
    (v_pkg, 'class_occupancy_report', 'true'),
    (v_pkg, 'lead_conversion_report', 'true'),
    (v_pkg, 'branch_revenue_comparison', 'true'),
    (v_pkg, 'custom_dashboards', 'true'),
    (v_pkg, 'custom_dashboards_kpis', 'true'),
    (v_pkg, 'scheduled_report_delivery', 'true'),
    (v_pkg, 'equipment_inventory_maintenance', 'true'),
    (v_pkg, 'data_export_csv_download', 'true'),
    -- Portal
    (v_pkg, 'member_portal', 'true'),
    (v_pkg, 'trainer_portal', 'true'),
    (v_pkg, 'diet_workout_plans', 'true'),
    (v_pkg, 'custom_branding', 'true'),
    (v_pkg, 'white_label', 'true'),
    (v_pkg, 'custom_domain', 'true'),
    (v_pkg, 'branded_mobile_app', 'true'),
    (v_pkg, 'in_app_push_notifications', 'true'),
    (v_pkg, 'digital_membership_card', 'true'),
    (v_pkg, 'loyalty_rewards_in_app', 'true'),
    -- Integrations
    (v_pkg, 'google_calendar_sync', 'true'),
    (v_pkg, 'tally_zoho_books_integration', 'true'),
    (v_pkg, 'rest_api_access', 'true'),
    (v_pkg, 'api_access', 'true'),
    (v_pkg, 'webhooks', 'true'),
    -- AI
    (v_pkg, 'ai_recommendations', 'true'),
    (v_pkg, 'ai_coach', 'true'),
    (v_pkg, 'ai_revenue_insights', 'true'),
    -- Infrastructure features
    (v_pkg, 'nfc_attendance', 'true'),
    (v_pkg, 'rfid_attendance', 'true'),
    (v_pkg, 'branch_attendance', 'true'),
    (v_pkg, 'trainer_attendance', 'true'),
    (v_pkg, 'staff_attendance', 'true'),
    (v_pkg, 'geo_fencing_attendance', 'true'),
    (v_pkg, 'attendance_api', 'true'),
    (v_pkg, 'audit_logs', 'true'),
    (v_pkg, 'priority_support', 'true')
  ON CONFLICT (package_id, feature_code) DO UPDATE SET value = excluded.value;

  -- Update Enterprise limits (all -1 for unlimited)
  DELETE FROM package_limits WHERE package_id = v_pkg;

  INSERT INTO package_limits (package_id, limit_code, label, value, sort_order) VALUES
    (v_pkg, 'max_members', 'Active Members', -1, 1),
    (v_pkg, 'max_branches', 'Branches', -1, 2),
    (v_pkg, 'max_staff', 'Staff Users', -1, 3),
    (v_pkg, 'max_trainers', 'Trainers', -1, 4),
    (v_pkg, 'max_gyms', 'Gyms', -1, 5),
    (v_pkg, 'max_storage_gb', 'Storage (GB)', -1, 6),
    (v_pkg, 'max_api_calls', 'Monthly API Calls', -1, 7),
    (v_pkg, 'sms_monthly', 'Monthly SMS Limit', -1, 8),
    (v_pkg, 'weekly_classes', 'Weekly Classes', -1, 9),
    (v_pkg, 'membership_plan_types', 'Membership Plan Types', -1, 10);

  -- Update Enterprise pricing
  DELETE FROM package_pricing WHERE package_id = v_pkg;

  INSERT INTO package_pricing (package_id, billing_period, price, currency) VALUES
    (v_pkg, 'monthly', 999900, 'INR'),
    (v_pkg, 'annual', 9999900, 'INR');
END $$;
