import type { OrgFeatureFlags } from "@/lib/tenant/feature-flags";

/**
 * Maps organization-owner modules to their required feature keys.
 * The sidebar filters modules based on the org's entitlements.
 */
export const MODULE_ENTITLEMENT_MAP: Record<string, { featureKey: string; name: string; plan: string; description: string }> = {
  gyms:         { featureKey: "multi_branch_management", name: "Multi-Gym Management", plan: "Growth", description: "Manage multiple gyms and branches" },
  staff:        { featureKey: "staff_management", name: "Staff Management", plan: "Growth", description: "Manage staff accounts and roles" },
  members:      { featureKey: "member_management", name: "Member Management", plan: "Starter", description: "Manage gym members" },
  memberships:  { featureKey: "member_management", name: "Membership Plans", plan: "Starter", description: "Manage membership plans" },
  revenue:      { featureKey: "billing_invoices", name: "Revenue & Billing", plan: "Starter", description: "Track revenue and payments" },
  trainers:     { featureKey: "trainer_management", name: "Trainer Management", plan: "Starter", description: "Manage trainers and assignments" },
  attendance:   { featureKey: "attendance_reports", name: "Attendance", plan: "Starter", description: "View attendance logs and reports" },
  classes:      { featureKey: "class_booking", name: "Class Booking", plan: "Growth", description: "Schedule and manage classes" },
  communications: { featureKey: "whatsapp_integration", name: "Communications", plan: "Growth", description: "Send notifications and campaigns" },
  analytics:    { featureKey: "advanced_reports", name: "Advanced Analytics", plan: "Growth", description: "View advanced reports and BI" },
  branding:     { featureKey: "custom_branding", name: "White Label Branding", plan: "Enterprise", description: "Custom branding and themes" },
  domains:      { featureKey: "custom_domain", name: "Custom Domains", plan: "Enterprise", description: "Add and manage custom domains" },
  billing:      { featureKey: "billing_invoices", name: "Billing", plan: "Starter", description: "Manage subscription and invoices" },
  nutrition:    { featureKey: "nutrition_plans", name: "Nutrition Plans", plan: "Growth", description: "Create and assign nutrition plans" },
  support:      { featureKey: "priority_support", name: "Priority Support", plan: "Enterprise", description: "Priority customer support" },
  security:     { featureKey: "audit_logs", name: "Security & Audit", plan: "Enterprise", description: "View audit logs and security events" },
  profile:      { featureKey: "member_management", name: "Organization Profile", plan: "Starter", description: "Manage organization settings" },
  settings:     { featureKey: "member_management", name: "Settings", plan: "Starter", description: "Organization settings" },
};

/**
 * Returns list of module slugs that the org has access to based on their feature flags.
 */
export function getAccessibleModules(features: OrgFeatureFlags): string[] {
  return Object.entries(MODULE_ENTITLEMENT_MAP)
    .filter(([slug, mapping]) => {
      const featureValue = features[mapping.featureKey as keyof OrgFeatureFlags];
      return featureValue === true;
    })
    .map(([slug]) => slug);
}

/**
 * Returns the required plan name for a module (for upgrade prompts).
 */
export function getRequiredPlan(slug: string): string | null {
  return MODULE_ENTITLEMENT_MAP[slug]?.plan ?? null;
}

/**
 * Returns the feature description for upgrade prompts.
 */
export function getModuleFeatureInfo(slug: string): { name: string; plan: string; description: string } | null {
  return MODULE_ENTITLEMENT_MAP[slug] ?? null;
}
