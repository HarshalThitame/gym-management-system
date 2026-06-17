-- ============================================================================
-- Starter Package Comprehensive Update
-- 
-- Updates the existing Starter package with:
--   - Correct pricing: ₹2,999/month (299900 paise)
--   - Updated limits: 200 active members, 3 staff, 10 plan types, 5 classes/week
--   - Complete feature set with included/locked features
--   - New feature catalog entries for Starter-specific features
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- ADD NEW FEATURE CATALOG ENTRIES
-- ════════════════════════════════════════════════════════════════════════════

with cats as (select id, code from public.feature_categories)
insert into public.feature_catalog (code, name, description, category_id, feature_type, default_value, sort_order) values
  -- Membership features
  ('membership_pause_freeze', 'Membership Pause/Freeze', 'Pause memberships for travel or injury with auto-resume', (select id from cats where code = 'membership'), 'boolean', 'false', 6),

  -- Billing features
  ('online_payment_links', 'Online Payment Links', 'Generate Razorpay/PayU one-time payment links', (select id from cats where code = 'billing'), 'boolean', 'false', 4),
  ('renewal_reminders', 'Renewal Reminders', 'Auto reminders before membership expiry', (select id from cats where code = 'billing'), 'boolean', 'false', 5),
  ('auto_billing', 'Auto Billing', 'NACH or card-on-file auto-charge recurring billing', (select id from cats where code = 'billing'), 'boolean', 'false', 6),
  ('discount_promo_codes', 'Discount & Promo Codes', 'Coupon codes for referrals or seasonal offers', (select id from cats where code = 'billing'), 'boolean', 'false', 7),
  ('corporate_bulk_memberships', 'Corporate/Bulk Memberships', 'Company tie-ups for employee memberships', (select id from cats where code = 'billing'), 'boolean', 'false', 8),

  -- Trainer features
  ('waitlist_management', 'Waitlist Management', 'Auto-promote members from waitlist after cancellation', (select id from cats where code = 'trainer'), 'boolean', 'false', 6),
  ('cross_branch_class_booking', 'Cross-Branch Class Booking', 'Members book classes at any branch location', (select id from cats where code = 'trainer'), 'boolean', 'false', 7),
  ('trainer_commissions_payroll', 'Trainer Commissions & Payroll', 'Track earnings per session and export payroll reports', (select id from cats where code = 'trainer'), 'boolean', 'false', 8),
  ('staff_attendance_leave', 'Staff Attendance & Leave', 'Clock-in/out, leave requests, monthly attendance report', (select id from cats where code = 'trainer'), 'boolean', 'false', 9),

  -- Communication features
  ('birthday_greetings', 'Birthday Greetings', 'Auto WhatsApp message on member birthday', (select id from cats where code = 'communication'), 'boolean', 'false', 5),
  ('broadcast_messages', 'Broadcast Messages', 'Send announcements to all or filtered members', (select id from cats where code = 'communication'), 'boolean', 'false', 6),
  ('email_campaigns', 'Email Campaigns', 'Drip emails for leads, re-engagement, and offers', (select id from cats where code = 'communication'), 'boolean', 'false', 7),

  -- Reports features
  ('custom_dashboards', 'Custom Dashboards', 'Build and save custom KPI views', (select id from cats where code = 'reports'), 'boolean', 'false', 3),

  -- Platform features
  ('branded_mobile_app', 'Branded Mobile App', 'iOS and Android app with gym name and logo', (select id from cats where code = 'platform'), 'boolean', 'false', 3),
  ('diet_workout_plans', 'Diet & Workout Plans', 'Trainer-assigned nutrition and workout plans visible to members', (select id from cats where code = 'platform'), 'boolean', 'false', 4)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- ════════════════════════════════════════════════════════════════════════════
-- UPDATE STARTER PACKAGE - Complete Redefinition
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pkg_id uuid;
begin
  -- Get existing Starter package or create if missing
  select id into v_pkg_id from public.packages where slug = 'starter';

  if not found then
    insert into public.packages (name, slug, description, is_active, trial_days, color, icon)
    values (
      'Starter',
      'starter',
      'Starter plan for independent studios and small gyms that need basic member management, billing, attendance, class scheduling, staff accounts, communication, reports, and member portal features.',
      true, 14, '#16a34a', 'rocket'
    )
    returning id into v_pkg_id;
  end if;

  -- Update package metadata
  update public.packages set
    name = 'Starter',
    description = 'Starter plan for independent studios and small gyms that need basic member management, billing, attendance, class scheduling, staff accounts, communication, reports, and member portal features.',
    is_active = true,
    trial_days = 14,
    color = '#16a34a',
    icon = 'rocket',
    sort_order = 10,
    metadata = jsonb_build_object(
      'target_customer', 'Independent studios and small gyms',
      'short_description', 'Up to 200 active members, basic features for small gyms'
    )
  where id = v_pkg_id;

  -- ════════════════════════════════════════════════════════════════════════
  -- UPDATE STARTER PACKAGE FEATURES
  -- ════════════════════════════════════════════════════════════════════════

  -- First, clear existing features to avoid stale entries
  delete from public.package_features where package_id = v_pkg_id;

  -- Insert complete feature set for Starter
  insert into public.package_features (package_id, feature_code, value) values
    -- A. Members & Access - Included
    (v_pkg_id, 'member_management', 'true'),
    (v_pkg_id, 'manual_attendance', 'true'),
    (v_pkg_id, 'qr_attendance', 'true'),
    (v_pkg_id, 'attendance_reports', 'true'),
    (v_pkg_id, 'membership_renewals', 'true'),
    (v_pkg_id, 'expiry_tracking', 'true'),
    (v_pkg_id, 'membership_pause_freeze', 'true'),

    -- A. Members & Access - Locked
    (v_pkg_id, 'biometric_attendance', 'false'),
    (v_pkg_id, 'multi_branch_management', 'false'),

    -- B. Membership Plans & Billing - Included
    (v_pkg_id, 'billing_invoices', 'true'),
    (v_pkg_id, 'receipts', 'true'),
    (v_pkg_id, 'payment_tracking', 'true'),
    (v_pkg_id, 'online_payment_links', 'true'),
    (v_pkg_id, 'renewal_reminders', 'true'),

    -- B. Membership Plans & Billing - Locked
    (v_pkg_id, 'auto_billing', 'false'),
    (v_pkg_id, 'discount_promo_codes', 'false'),
    (v_pkg_id, 'corporate_bulk_memberships', 'false'),

    -- C. Class Scheduling - Included
    (v_pkg_id, 'class_booking', 'true'),

    -- C. Class Scheduling - Locked
    (v_pkg_id, 'waitlist_management', 'false'),
    (v_pkg_id, 'pt_sessions', 'false'),
    (v_pkg_id, 'cross_branch_class_booking', 'false'),

    -- D. Staff & Trainer - Included
    (v_pkg_id, 'staff_management', 'true'),
    (v_pkg_id, 'trainer_management', 'true'),

    -- D. Staff & Trainer - Locked
    (v_pkg_id, 'trainer_commissions_payroll', 'false'),
    (v_pkg_id, 'staff_attendance_leave', 'false'),
    (v_pkg_id, 'advanced_rbac', 'false'),

    -- E. Communication - Included
    (v_pkg_id, 'whatsapp_integration', 'true'),
    (v_pkg_id, 'sms_integration', 'true'),
    (v_pkg_id, 'birthday_greetings', 'true'),
    (v_pkg_id, 'email_notifications', 'true'),
    (v_pkg_id, 'in_app_notifications', 'true'),

    -- E. Communication - Locked
    (v_pkg_id, 'broadcast_messages', 'false'),
    (v_pkg_id, 'email_campaigns', 'false'),
    (v_pkg_id, 'lead_management', 'false'),

    -- F. Reports & Analytics - Included
    (v_pkg_id, 'basic_reports', 'true'),
    (v_pkg_id, 'goal_tracking', 'true'),
    (v_pkg_id, 'progress_photos', 'true'),

    -- F. Reports & Analytics - Locked
    (v_pkg_id, 'ai_retention_analysis', 'false'),
    (v_pkg_id, 'advanced_reports', 'false'),
    (v_pkg_id, 'custom_dashboards', 'false'),
    (v_pkg_id, 'api_access', 'false'),

    -- G. Member-Facing Experience - Included
    (v_pkg_id, 'member_portal', 'true'),

    -- G. Member-Facing Experience - Locked
    (v_pkg_id, 'branded_mobile_app', 'false'),
    (v_pkg_id, 'diet_workout_plans', 'false')
  on conflict (package_id, feature_code) do update set value = excluded.value;

  -- ════════════════════════════════════════════════════════════════════════
  -- UPDATE STARTER PACKAGE LIMITS
  -- ════════════════════════════════════════════════════════════════════════

  -- Clear existing limits
  delete from public.package_limits where package_id = v_pkg_id;

  insert into public.package_limits (package_id, limit_code, label, value, sort_order) values
    (v_pkg_id, 'max_members', 'Active Members', 200, 1),
    (v_pkg_id, 'max_branches', 'Branches', 1, 2),
    (v_pkg_id, 'max_staff', 'Staff Users', 3, 3),
    (v_pkg_id, 'max_trainers', 'Trainers', 3, 4),
    (v_pkg_id, 'max_gyms', 'Gyms', 1, 5),
    (v_pkg_id, 'max_storage_gb', 'Storage (GB)', 5, 6),
    (v_pkg_id, 'max_api_calls', 'Monthly API Calls', 0, 7),
    (v_pkg_id, 'sms_monthly', 'Monthly SMS Limit', 500, 8),
    (v_pkg_id, 'weekly_classes', 'Weekly Classes', 5, 9),
    (v_pkg_id, 'membership_plan_types', 'Membership Plan Types', 10, 10)
  on conflict (package_id, limit_code) do update set
    value = excluded.value, label = excluded.label;

  -- ════════════════════════════════════════════════════════════════════════
  -- UPDATE STARTER PACKAGE PRICING
  -- ════════════════════════════════════════════════════════════════════════

  -- Clear existing pricing
  delete from public.package_pricing where package_id = v_pkg_id;

  insert into public.package_pricing (package_id, billing_period, price, currency) values
    (v_pkg_id, 'monthly', 299900, 'INR'),
    (v_pkg_id, 'quarterly', 849900, 'INR'),
    (v_pkg_id, 'half_yearly', 1599900, 'INR'),
    (v_pkg_id, 'annual', 2999900, 'INR')
  on conflict (package_id, billing_period) do update set price = excluded.price;

end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ALSO UPDATE GROWTH AND ENTERPRISE PACKAGES with new features
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_growth_id uuid;
  v_enterprise_id uuid;
begin
  -- Update Growth package with new features
  select id into v_growth_id from public.packages where slug = 'growth';
  if found then
    insert into public.package_features (package_id, feature_code, value) values
      (v_growth_id, 'membership_pause_freeze', 'true'),
      (v_growth_id, 'online_payment_links', 'true'),
      (v_growth_id, 'renewal_reminders', 'true'),
      (v_growth_id, 'auto_billing', 'true'),
      (v_growth_id, 'discount_promo_codes', 'true'),
      (v_growth_id, 'waitlist_management', 'true'),
      (v_growth_id, 'trainer_commissions_payroll', 'true'),
      (v_growth_id, 'birthday_greetings', 'true'),
      (v_growth_id, 'broadcast_messages', 'true'),
      (v_growth_id, 'email_campaigns', 'true'),
      (v_growth_id, 'custom_dashboards', 'false'),
      (v_growth_id, 'branded_mobile_app', 'false'),
      (v_growth_id, 'diet_workout_plans', 'false'),
      (v_growth_id, 'cross_branch_class_booking', 'false'),
      (v_growth_id, 'corporate_bulk_memberships', 'false'),
      (v_growth_id, 'staff_attendance_leave', 'false')
    on conflict (package_id, feature_code) do update set value = excluded.value;

    -- Update Growth limits
    insert into public.package_limits (package_id, limit_code, label, value, sort_order) values
      (v_growth_id, 'sms_monthly', 'Monthly SMS Limit', 5000, 8),
      (v_growth_id, 'weekly_classes', 'Weekly Classes', 50, 9),
      (v_growth_id, 'membership_plan_types', 'Membership Plan Types', 50, 10)
    on conflict (package_id, limit_code) do update set value = excluded.value, label = excluded.label;
  end if;

  -- Update Enterprise package with new features
  select id into v_enterprise_id from public.packages where slug = 'enterprise';
  if found then
    insert into public.package_features (package_id, feature_code, value) values
      (v_growth_id, 'membership_pause_freeze', 'true'),
      (v_enterprise_id, 'membership_pause_freeze', 'true'),
      (v_enterprise_id, 'online_payment_links', 'true'),
      (v_enterprise_id, 'renewal_reminders', 'true'),
      (v_enterprise_id, 'auto_billing', 'true'),
      (v_enterprise_id, 'discount_promo_codes', 'true'),
      (v_enterprise_id, 'corporate_bulk_memberships', 'true'),
      (v_enterprise_id, 'waitlist_management', 'true'),
      (v_enterprise_id, 'cross_branch_class_booking', 'true'),
      (v_enterprise_id, 'trainer_commissions_payroll', 'true'),
      (v_enterprise_id, 'staff_attendance_leave', 'true'),
      (v_enterprise_id, 'birthday_greetings', 'true'),
      (v_enterprise_id, 'broadcast_messages', 'true'),
      (v_enterprise_id, 'email_campaigns', 'true'),
      (v_enterprise_id, 'custom_dashboards', 'true'),
      (v_enterprise_id, 'branded_mobile_app', 'true'),
      (v_enterprise_id, 'diet_workout_plans', 'true')
    on conflict (package_id, feature_code) do update set value = excluded.value;

    -- Update Enterprise limits
    insert into public.package_limits (package_id, limit_code, label, value, sort_order) values
      (v_enterprise_id, 'sms_monthly', 'Monthly SMS Limit', -1, 8),
      (v_enterprise_id, 'weekly_classes', 'Weekly Classes', -1, 9),
      (v_enterprise_id, 'membership_plan_types', 'Membership Plan Types', -1, 10)
    on conflict (package_id, limit_code) do update set value = excluded.value, label = excluded.label;
  end if;
end $$;
