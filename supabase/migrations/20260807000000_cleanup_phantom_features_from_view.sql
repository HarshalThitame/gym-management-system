-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Clean up phantom feature columns from legacy views
-- Date: 2026-08-07
-- 
-- Removes face_recognition_attendance_enabled and franchise_management_enabled
-- columns from backward-compat views. These features were removed from
-- packages in Phase 1.1 of the Enterprise Production Plan.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. package_entitlements view ────────────────────────────────────────────

drop view if exists public.package_entitlements;

create view public.package_entitlements as
select
  p.id as package_id,
  p.name as package_name,
  p.slug,
  p.description,
  p.is_active,
  p.sort_order,
  p.trial_days,
  p.color,
  p.icon,
  p.metadata,
  p.archived_at,
  p.created_at,
  p.updated_at,
  -- Limits as columns (for backward compatibility)
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_members'), 0) as max_members,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_branches'), 0) as max_branches,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_gyms'), 0) as max_gyms,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_trainers'), 0) as max_trainers,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_staff'), 0) as max_staff,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_storage_gb'), 0) as max_storage_gb,
  coalesce((select pl.value from public.package_limits pl where pl.package_id = p.id and pl.limit_code = 'max_api_calls'), 0) as max_api_calls,
  -- Features as columns (phantom features removed per Phase 1.1)
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'qr_attendance')::boolean, false) as qr_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'dynamic_qr_attendance')::boolean, false) as dynamic_qr_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'biometric_attendance')::boolean, false) as biometric_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'fingerprint_attendance')::boolean, false) as fingerprint_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'rfid_attendance')::boolean, false) as rfid_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'nfc_attendance')::boolean, false) as nfc_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'geo_fencing_attendance')::boolean, false) as geo_fencing_attendance_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'attendance_api')::boolean, false) as attendance_api_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'member_management')::boolean, false) as member_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'trainer_management')::boolean, false) as trainer_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'staff_management')::boolean, false) as staff_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'lead_management')::boolean, false) as lead_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'trial_management')::boolean, false) as trial_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'class_booking')::boolean, false) as class_booking_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'pt_sessions')::boolean, false) as pt_sessions_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'nutrition_plans')::boolean, false) as nutrition_plans_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'goal_tracking')::boolean, false) as goal_tracking_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'progress_photos')::boolean, false) as progress_photos_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'workout_assignment')::boolean, false) as workout_assignment_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'billing_invoices')::boolean, false) as billing_invoices_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'receipts')::boolean, false) as receipts_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'payment_tracking')::boolean, false) as payment_tracking_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'basic_reports')::boolean, false) as basic_reports_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'advanced_reports')::boolean, false) as advanced_reports_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'email_notifications')::boolean, false) as email_notifications_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'whatsapp_integration')::boolean, false) as whatsapp_integration_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'sms_integration')::boolean, false) as sms_integration_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'in_app_notifications')::boolean, false) as in_app_notifications_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'member_portal')::boolean, false) as member_portal_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'trainer_portal')::boolean, false) as trainer_portal_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'ai_recommendations')::boolean, false) as ai_recommendations_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'ai_coach')::boolean, false) as ai_coach_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'ai_retention_analysis')::boolean, false) as ai_retention_analysis_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'ai_revenue_insights')::boolean, false) as ai_revenue_insights_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'multi_branch_management')::boolean, false) as multi_branch_management_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'white_label')::boolean, false) as white_label_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'custom_domain')::boolean, false) as custom_domain_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'custom_branding')::boolean, false) as custom_branding_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'api_access')::boolean, false) as api_access_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'webhooks')::boolean, false) as webhooks_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'audit_logs')::boolean, false) as audit_logs_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'advanced_rbac')::boolean, false) as advanced_rbac_enabled,
  coalesce((select pf.value #>> '{}' from public.package_features pf where pf.package_id = p.id and pf.feature_code = 'priority_support')::boolean, false) as priority_support_enabled,
  -- Pricing as columns
  (select jsonb_object_agg(pp.billing_period, pp.price) from public.package_pricing pp where pp.package_id = p.id) as pricing,
  (select jsonb_object_agg(pp.billing_period, pp.setup_fee) from public.package_pricing pp where pp.package_id = p.id) as setup_fees
from public.packages p;

comment on view public.package_entitlements is 'Flattened view of packages with features, limits, and pricing as columns for backward compatibility. Phantom features removed.';

-- ─── 2. org_active_entitlements view ─────────────────────────────────────────
-- Removes franchise_management_enabled column

drop view if exists public.org_active_entitlements;

create view public.org_active_entitlements as
select
  organization_id,
  package_id,
  package_name,
  status,
  is_active,
  synced_at,
  expires_at,
  features,
  limits,
  (features ->> 'attendance.qr'::text)::boolean as qr_attendance_enabled,
  (features ->> 'attendance.biometric'::text)::boolean as biometric_attendance_enabled,
  (features ->> 'attendance.rfid'::text)::boolean as rfid_attendance_enabled,
  (features ->> 'attendance.nfc'::text)::boolean as nfc_attendance_enabled,
  (features ->> 'ai.recommendations'::text)::boolean as ai_recommendations_enabled,
  (features ->> 'branding.custom_domain'::text)::boolean as custom_domain_enabled,
  (features ->> 'branding.white_label'::text)::boolean as white_label_enabled,
  (features ->> 'integrations.api'::text)::boolean as api_access_enabled,
  (features ->> 'multi_branch.enabled'::text)::boolean as multi_branch_enabled,
  (limits ->> 'max_members'::text)::integer as max_members,
  (limits ->> 'max_branches'::text)::integer as max_branches,
  (limits ->> 'max_gyms'::text)::integer as max_gyms,
  (limits ->> 'max_trainers'::text)::integer as max_trainers,
  (limits ->> 'max_staff'::text)::integer as max_staff
from public.organization_entitlements oe;

comment on view public.org_active_entitlements is 'Flattened view of active organization entitlements for backward compatibility. Phantom features removed.';
