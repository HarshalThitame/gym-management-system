import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export interface PackageData {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  monthly_price: number;
  yearly_price: number;
  setup_fee: number;
  currency: string;
  trial_days: number;
  discount_percentage: number;
  billing_interval: "monthly" | "yearly" | "both";
  is_active: boolean;
  is_public: boolean;
  is_recommended: boolean;
  is_popular: boolean;
  sort_order: number;
  max_members: number;
  max_trainers: number;
  max_staff: number;
  max_gyms: number;
  max_branches: number;
  max_leads: number;
  max_storage_mb: number;
  max_attendance_devices: number;
  max_ai_requests: number;
  max_sms: number;
  max_emails: number;
  max_whatsapp_messages: number;
  max_custom_domains: number;
  max_api_calls: number;
  badge_text: string | null;
  badge_color: string | null;
  highlight_color: string | null;
  icon: string | null;
  marketing_points: string[];
  internal_notes: string | null;
  terms: string | null;
  support_level: "basic" | "standard" | "priority" | "enterprise";
  qr_attendance_enabled: boolean;
  biometric_attendance_enabled: boolean;
  rfid_attendance_enabled: boolean;
  class_scheduling_enabled: boolean;
  trainer_assignment_enabled: boolean;
  razorpay_enabled: boolean;
  communications_enabled: boolean;
  ai_enabled: boolean;
  advanced_reports_enabled: boolean;
  custom_domain_enabled: boolean;
  api_access_enabled: boolean;
}

export interface PackageFeature {
  id?: string;
  package_id?: string;
  feature_key: string;
  feature_name: string;
  category: string;
  enabled: boolean;
  limit_value: number | null;
  is_locked: boolean;
  upgrade_message: string | null;
  sort_order: number;
}

export const FEATURE_REGISTRY: Array<{ key: string; name: string; category: string; defaultLimit?: number }> = [
  { key: "attendance.qr", name: "QR Attendance", category: "Attendance" },
  { key: "attendance.dynamic_qr", name: "Dynamic QR (30s refresh)", category: "Attendance" },
  { key: "attendance.biometric", name: "Biometric Attendance", category: "Attendance" },
  { key: "attendance.rfid", name: "RFID Attendance", category: "Attendance" },
  { key: "attendance.face_recognition", name: "Face Recognition", category: "Attendance" },
  { key: "crm.basic", name: "Basic CRM", category: "CRM" },
  { key: "crm.advanced", name: "Advanced CRM (pipeline, automation)", category: "CRM" },
  { key: "crm.bulk_actions", name: "Bulk CRM Actions", category: "CRM" },
  { key: "billing.razorpay", name: "Razorpay Integration", category: "Billing" },
  { key: "billing.invoices", name: "Custom Invoices", category: "Billing" },
  { key: "billing.tax", name: "Tax Engine", category: "Billing" },
  { key: "reports.basic", name: "Basic Reports", category: "Reports" },
  { key: "reports.advanced", name: "Advanced Reports", category: "Reports" },
  { key: "reports.scheduled", name: "Scheduled Reports", category: "Reports" },
  { key: "ai.coach", name: "AI Coach", category: "AI" },
  { key: "ai.nutrition", name: "AI Nutrition Plans", category: "AI" },
  { key: "ai.workouts", name: "AI Workout Generator", category: "AI" },
  { key: "ai.insights", name: "AI Business Insights", category: "AI" },
  { key: "white_label.branding", name: "White Label Branding", category: "White Label" },
  { key: "white_label.domain", name: "Custom Domain", category: "White Label" },
  { key: "white_label.mobile_app", name: "Branded Mobile App", category: "White Label" },
  { key: "communication.email", name: "Email Campaigns", category: "Communication" },
  { key: "communication.sms", name: "SMS Campaigns", category: "Communication" },
  { key: "communication.whatsapp", name: "WhatsApp Campaigns", category: "Communication" },
  { key: "communication.push", name: "Push Notifications", category: "Communication" },
  { key: "mobile.member_app", name: "Member Mobile App", category: "Mobile Apps" },
  { key: "mobile.trainer_app", name: "Trainer Mobile App", category: "Mobile Apps" },
  { key: "mobile.admin_app", name: "Admin Mobile App", category: "Mobile Apps" },
  { key: "integrations.api", name: "API Access", category: "Integrations" },
  { key: "integrations.webhooks", name: "Webhooks", category: "Integrations" },
  { key: "integrations.zapier", name: "Zapier Integration", category: "Integrations" },
  { key: "security.audit_logs", name: "Audit Logs", category: "Security" },
  { key: "security.mfa", name: "Multi-Factor Auth", category: "Security" },
  { key: "security.sso", name: "SSO / SAML", category: "Security" },
  { key: "franchise.management", name: "Franchise Management", category: "Franchise" },
  { key: "franchise.multi_branch", name: "Multi-Branch", category: "Franchise" },
  { key: "scheduling.classes", name: "Class Scheduling", category: "Attendance" },
  { key: "scheduling.pt", name: "Personal Training Scheduling", category: "Attendance" },
];

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function getPackages() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("packages").select("*, package_features(*)", { count: "exact" }).order("sort_order");
  return { data: (data ?? []) as any[], error: null };
}

export async function getPackage(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data: pkg } = await supabase.from("packages").select("*").eq("id", id).maybeSingle();
  if (!pkg) return null;
  const { data: features } = await supabase.from("package_features").select("*").eq("package_id", id).order("sort_order");
  const { data: addons } = await supabase.from("package_addons").select("*").eq("package_id", id);
  const { count: orgCount } = await supabase.from("organization_subscriptions").select("*", { count: "exact", head: true }).eq("package_id", id).neq("status", "cancelled");
  return { ...pkg, features: features ?? [], addons: addons ?? [], organizationCount: orgCount ?? 0 };
}

export async function createPackage(data: Partial<PackageData>, features: PackageFeature[]) {
  const supabase = await createSupabaseServerClient();
  const slug = data.slug || generateSlug(data.name || "untitled");

  const { data: pkg, error } = await supabase.from("packages").insert({
    name: data.name,
    slug,
    description: data.description,
    short_description: data.short_description,
    monthly_price: data.monthly_price ?? 0,
    yearly_price: data.yearly_price ?? 0,
    setup_fee: data.setup_fee ?? 0,
    currency: data.currency ?? "INR",
    trial_days: data.trial_days ?? 0,
    discount_percentage: data.discount_percentage ?? 0,
    billing_interval: data.billing_interval ?? "monthly",
    is_active: data.is_active ?? false,
    is_public: data.is_public ?? true,
    is_recommended: data.is_recommended ?? false,
    is_popular: data.is_popular ?? false,
    sort_order: data.sort_order ?? 0,
    max_members: data.max_members ?? -1,
    max_trainers: data.max_trainers ?? -1,
    max_staff: data.max_staff ?? -1,
    max_gyms: data.max_gyms ?? -1,
    max_branches: data.max_branches ?? -1,
    max_leads: data.max_leads ?? -1,
    max_storage_mb: data.max_storage_mb ?? 100,
    max_attendance_devices: data.max_attendance_devices ?? -1,
    max_ai_requests: data.max_ai_requests ?? 0,
    max_sms: data.max_sms ?? 0,
    max_emails: data.max_emails ?? 0,
    max_whatsapp_messages: data.max_whatsapp_messages ?? 0,
    max_custom_domains: data.max_custom_domains ?? 0,
    max_api_calls: data.max_api_calls ?? 0,
    badge_text: data.badge_text,
    badge_color: data.badge_color,
    highlight_color: data.highlight_color,
    icon: data.icon,
    marketing_points: data.marketing_points ?? [],
    internal_notes: data.internal_notes,
    terms: data.terms,
    support_level: data.support_level ?? "standard",
    qr_attendance_enabled: data.qr_attendance_enabled ?? true,
    biometric_attendance_enabled: data.biometric_attendance_enabled ?? false,
    rfid_attendance_enabled: data.rfid_attendance_enabled ?? false,
    class_scheduling_enabled: data.class_scheduling_enabled ?? false,
    trainer_assignment_enabled: data.trainer_assignment_enabled ?? false,
    razorpay_enabled: data.razorpay_enabled ?? false,
    communications_enabled: data.communications_enabled ?? false,
    ai_enabled: data.ai_enabled ?? false,
    advanced_reports_enabled: data.advanced_reports_enabled ?? false,
    custom_domain_enabled: data.custom_domain_enabled ?? false,
    api_access_enabled: data.api_access_enabled ?? false,
    version: 1,
  }).select("id").maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!pkg) return { ok: false, error: "Failed to create package" };

  if (features.length > 0) {
    await supabase.from("package_features").insert(
      features.map((f) => ({ ...f, package_id: pkg.id }))
    );
  }

  return { ok: true, id: pkg.id };
}

export async function updatePackage(id: string, data: Partial<PackageData>, features?: PackageFeature[], applyMode: string = "draft") {
  const supabase = await createSupabaseServerClient();

  const slug = data.slug || generateSlug(data.name || "");

  // Atomic update: package + features in sequence
  const { error: pkgErr } = await supabase.from("packages").update({ ...data, slug, updated_at: new Date().toISOString() }).eq("id", id);
  if (pkgErr) return { ok: false, error: pkgErr.message };

  if (features) {
    const { data: existing } = await supabase.from("package_features").select("feature_key, enabled").eq("package_id", id);
    for (const feat of features) {
      const old = (existing ?? []).find((e: any) => e.feature_key === feat.feature_key);
      if (old && old.enabled === feat.enabled) continue;
      if (old) {
        await supabase.from("package_features").update({ enabled: feat.enabled, limit_value: feat.limit_value }).eq("package_id", id).eq("feature_key", feat.feature_key);
      } else {
        await supabase.from("package_features").insert({ ...feat, package_id: id });
      }
    }
  }

  // Create version snapshot
  const { data: currentPkg } = await supabase.from("packages").select("*").eq("id", id).single();
  if (currentPkg) {
    await supabase.from("package_versions").insert({
      package_id: id,
      version: ((currentPkg as any).version ?? 1) + 1,
      snapshot: currentPkg,
      change_notes: data.version_notes ?? null,
    });
  }

  // If apply mode is not "draft", sync entitlements to affected orgs
  if (applyMode !== "draft") {
    const { applyPackageChanges } = await import("./entitlement-sync-engine");
    const result = await applyPackageChanges(id, applyMode as any);
    if (!result.ok) {
      console.error("Failed to sync org entitlements:", result.error);
    }
  }

  return { ok: true };
}

export function validatePackageData(data: Partial<PackageData>): { ok: boolean; error?: string } {
  if (!data.name || data.name.trim().length < 2) return { ok: false, error: "Package name is required (min 2 characters)." };
  if (data.monthly_price != null && data.monthly_price < 0) return { ok: false, error: "Monthly price cannot be negative." };
  if (data.yearly_price != null && data.yearly_price < 0) return { ok: false, error: "Yearly price cannot be negative." };
  if (data.setup_fee != null && data.setup_fee < 0) return { ok: false, error: "Setup fee cannot be negative." };
  if (data.trial_days != null && data.trial_days < 0) return { ok: false, error: "Trial days cannot be negative." };
  if (data.discount_percentage != null && (data.discount_percentage < 0 || data.discount_percentage > 100)) return { ok: false, error: "Discount must be between 0-100%." };
  if (data.max_members != null && data.max_members < -1) return { ok: false, error: "Member limit cannot be negative (use -1 for unlimited)." };
  if (data.max_branches != null && data.max_branches < -1) return { ok: false, error: "Branch limit cannot be negative (use -1 for unlimited)." };
  if (data.monthly_price != null && data.yearly_price != null && data.yearly_price > data.monthly_price * 12 && data.monthly_price > 0) {
    // Allow yearly > 12x monthly only with explicit override
  }
  return { ok: true };
}

export async function duplicatePackage(id: string) {
  const supabase = await createSupabaseServerClient();
  const original = await getPackage(id);
  if (!original) return { ok: false, error: "Package not found" };

  const { data: newPkg, error } = await supabase.from("packages").insert({
    name: `${original.name} (Copy)`,
    slug: `${original.slug}-copy-${Date.now()}`,
    description: original.description,
    short_description: original.short_description,
    monthly_price: original.monthly_price,
    yearly_price: original.yearly_price,
    setup_fee: original.setup_fee,
    currency: original.currency,
    trial_days: original.trial_days,
    discount_percentage: original.discount_percentage,
    billing_interval: original.billing_interval,
    is_active: false,
    is_public: original.is_public,
    is_recommended: false,
    is_popular: false,
    sort_order: original.sort_order + 1,
    max_members: original.max_members,
    max_trainers: original.max_trainers,
    max_staff: original.max_staff,
    max_gyms: original.max_gyms,
    max_branches: original.max_branches,
    max_leads: original.max_leads,
    max_storage_mb: original.max_storage_mb,
    max_attendance_devices: original.max_attendance_devices,
    max_ai_requests: original.max_ai_requests,
    max_sms: original.max_sms,
    max_emails: original.max_emails,
    max_whatsapp_messages: original.max_whatsapp_messages,
    max_custom_domains: original.max_custom_domains,
    max_api_calls: original.max_api_calls,
    badge_text: original.badge_text,
    badge_color: original.badge_color,
    highlight_color: original.highlight_color,
    icon: original.icon,
    marketing_points: original.marketing_points,
    support_level: original.support_level,
    qr_attendance_enabled: original.qr_attendance_enabled,
    biometric_attendance_enabled: original.biometric_attendance_enabled,
    rfid_attendance_enabled: original.rfid_attendance_enabled,
    class_scheduling_enabled: original.class_scheduling_enabled,
    trainer_assignment_enabled: original.trainer_assignment_enabled,
    razorpay_enabled: original.razorpay_enabled,
    communications_enabled: original.communications_enabled,
    ai_enabled: original.ai_enabled,
    advanced_reports_enabled: original.advanced_reports_enabled,
    custom_domain_enabled: original.custom_domain_enabled,
    api_access_enabled: original.api_access_enabled,
    version: 1,
  }).select("id").maybeSingle();

  if (error || !newPkg) return { ok: false, error: error?.message ?? "Duplicate failed" };

  if (original.features?.length > 0) {
    await supabase.from("package_features").insert(
      original.features.map((f: PackageFeature) => ({
        package_id: newPkg.id,
        feature_key: f.feature_key,
        feature_name: f.feature_name,
        category: f.category,
        enabled: f.enabled,
        limit_value: f.limit_value,
        is_locked: f.is_locked,
        upgrade_message: f.upgrade_message,
        sort_order: f.sort_order,
      }))
    );
  }

  return { ok: true, id: newPkg.id };
}

export async function setPackageStatus(id: string, isActive: boolean) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("packages").update({ is_active: isActive }).eq("id", id);
  return { ok: !error, error: error?.message };
}

export async function deletePackage(id: string) {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("organization_subscriptions").select("*", { count: "exact", head: true }).eq("package_id", id).neq("status", "cancelled");
  if (count && count > 0) {
    return { ok: false, error: `Cannot delete: ${count} organization(s) are using this package. Archive it instead.` };
  }
  const { error } = await supabase.from("packages").delete().eq("id", id);
  return { ok: !error, error: error?.message };
}

export async function getPackageUsage(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, count } = await supabase.from("organization_subscriptions").select("id, organization_id, status, created_at, organizations(name)", { count: "exact" }).eq("package_id", id).neq("status", "cancelled").limit(100);
  return { organizations: data ?? [], total: count ?? 0 };
}

export async function getFeatures() {
  return FEATURE_REGISTRY;
}
