import { createSupabaseServerClient } from "@/lib/supabase/server";
import { organizationHasFeature } from "@/features/super-admin/services/entitlement-service";
import type { OrgFeatureFlags, FeatureFlagKey } from "./feature-flags";

type Sb = ReturnType<typeof createSupabaseServerClient> extends Promise<infer R> ? R : never;

const SAFE_DEFAULT: OrgFeatureFlags = {
  maxMembers: 0, maxBranches: 0, maxGyms: 0, maxTrainers: 0, maxStaff: 0, maxStorageGb: 0, maxApiCalls: 0,
  manualAttendance: false, qrAttendanceEnabled: false, dynamicQrAttendance: false,
  trainerAttendance: false, staffAttendance: false, branchAttendance: false,
  biometricAttendanceEnabled: false, fingerprintAttendance: false, faceRecognitionAttendance: false,
  rfidAttendanceEnabled: false, nfcAttendance: false, geoFencingAttendance: false,
  attendanceApi: false, attendanceReports: false,
  memberManagement: false, membershipRenewals: false, expiryTracking: false,
  goalTracking: false, progressPhotos: false,
  leadManagement: false, trialManagement: false,
  trainerManagement: false, workoutAssignment: false, nutritionPlans: false,
  ptSessions: false, classBooking: false,
  billingInvoices: false, receipts: false, paymentTracking: false,
  basicReports: false, advancedReportsEnabled: false,
  emailNotifications: false, inAppNotifications: false,
  whatsappIntegration: false, smsIntegration: false,
  memberPortal: false, trainerPortal: false,
  aiEnabled: false, aiCoach: false, aiRetentionAnalysis: false, aiRevenueInsights: false,
  whiteLabelEnabled: false, customDomainEnabled: false, customBranding: false,
  multiBranchManagement: false, franchiseManagement: false,
  apiAccessEnabled: false, webhooks: false, auditLogs: false,
  advancedRbac: false, prioritySupport: false, staffManagement: false,
  // Legacy aliases
  classSchedulingEnabled: false, communicationsEnabled: false,
  trainerAssignmentEnabled: false, razorpayEnabled: false,
};

// Map of feature flag keys to feature_catalog codes and limit keys
const FEATURE_MAP: Record<string, { type: "feature"; code: string } | { type: "limit"; code: string }> = {
  // Limits
  maxMembers: { type: "limit", code: "max_members" },
  maxBranches: { type: "limit", code: "max_branches" },
  maxGyms: { type: "limit", code: "max_gyms" },
  maxTrainers: { type: "limit", code: "max_trainers" },
  maxStaff: { type: "limit", code: "max_staff" },
  maxStorageGb: { type: "limit", code: "max_storage_gb" },
  maxApiCalls: { type: "limit", code: "max_api_calls" },

  // Attendance features
  manualAttendance: { type: "feature", code: "manual_attendance" },
  qrAttendanceEnabled: { type: "feature", code: "qr_attendance" },
  dynamicQrAttendance: { type: "feature", code: "dynamic_qr_attendance" },
  trainerAttendance: { type: "feature", code: "trainer_attendance" },
  staffAttendance: { type: "feature", code: "staff_attendance" },
  branchAttendance: { type: "feature", code: "branch_attendance" },
  biometricAttendanceEnabled: { type: "feature", code: "biometric_attendance" },
  fingerprintAttendance: { type: "feature", code: "fingerprint_attendance" },
  faceRecognitionAttendance: { type: "feature", code: "face_recognition_attendance" },
  rfidAttendanceEnabled: { type: "feature", code: "rfid_attendance" },
  nfcAttendance: { type: "feature", code: "nfc_attendance" },
  geoFencingAttendance: { type: "feature", code: "geo_fencing_attendance" },
  attendanceApi: { type: "feature", code: "attendance_api" },
  attendanceReports: { type: "feature", code: "attendance_reports" },

  // Membership
  memberManagement: { type: "feature", code: "member_management" },
  membershipRenewals: { type: "feature", code: "membership_renewals" },
  expiryTracking: { type: "feature", code: "expiry_tracking" },
  goalTracking: { type: "feature", code: "goal_tracking" },
  progressPhotos: { type: "feature", code: "progress_photos" },

  // CRM
  leadManagement: { type: "feature", code: "lead_management" },
  trialManagement: { type: "feature", code: "trial_management" },

  // Trainer
  trainerManagement: { type: "feature", code: "trainer_management" },
  trainerAssignmentEnabled: { type: "feature", code: "workout_assignment" },  // backward compat
  workoutAssignment: { type: "feature", code: "workout_assignment" },
  nutritionPlans: { type: "feature", code: "nutrition_plans" },
  ptSessions: { type: "feature", code: "pt_sessions" },
  classBooking: { type: "feature", code: "class_booking" },
  classSchedulingEnabled: { type: "feature", code: "class_booking" },  // backward compat

  // Billing
  billingInvoices: { type: "feature", code: "billing_invoices" },
  razorpayEnabled: { type: "feature", code: "billing_invoices" },  // backward compat
  receipts: { type: "feature", code: "receipts" },
  paymentTracking: { type: "feature", code: "payment_tracking" },

  // Reports
  basicReports: { type: "feature", code: "basic_reports" },
  advancedReportsEnabled: { type: "feature", code: "advanced_reports" },

  // Communication
  emailNotifications: { type: "feature", code: "email_notifications" },
  inAppNotifications: { type: "feature", code: "in_app_notifications" },
  whatsappIntegration: { type: "feature", code: "whatsapp_integration" },
  smsIntegration: { type: "feature", code: "sms_integration" },
  communicationsEnabled: { type: "feature", code: "whatsapp_integration" },  // backward compat

  // Portals
  memberPortal: { type: "feature", code: "member_portal" },
  trainerPortal: { type: "feature", code: "trainer_portal" },

  // AI
  aiEnabled: { type: "feature", code: "ai_recommendations" },
  aiCoach: { type: "feature", code: "ai_coach" },
  aiRetentionAnalysis: { type: "feature", code: "ai_retention_analysis" },
  aiRevenueInsights: { type: "feature", code: "ai_revenue_insights" },

  // White Label
  whiteLabelEnabled: { type: "feature", code: "white_label" },
  customDomainEnabled: { type: "feature", code: "custom_domain" },
  customBranding: { type: "feature", code: "custom_branding" },

  // Enterprise
  multiBranchManagement: { type: "feature", code: "multi_branch_management" },
  franchiseManagement: { type: "feature", code: "franchise_management" },
  apiAccessEnabled: { type: "feature", code: "api_access" },
  webhooks: { type: "feature", code: "webhooks" },
  auditLogs: { type: "feature", code: "audit_logs" },
  advancedRbac: { type: "feature", code: "advanced_rbac" },
  prioritySupport: { type: "feature", code: "priority_support" },
  staffManagement: { type: "feature", code: "staff_management" },
};

/**
 * Resolves all feature flags and limits for an organization.
 * Queries the new package_features and package_limits tables dynamically.
 * Adding a new feature to the catalog automatically makes it resolvable here.
 */
export async function getOrgFeatureFlags(organizationId: string): Promise<OrgFeatureFlags> {
  try {
    const supabase = await createSupabaseServerClient();
    const s = supabase as never as {
      from(t: string): {
        select(c: string): {
          eq(k: string, v: string): {
            in(k: string, v: string[]): {
              order(k: string, o: { ascending: boolean }): {
                limit(n: number): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
              };
            };
          };
        };
      };
    };

    const { data: subs } = await s
      .from("organization_subscriptions")
      .select("status, trial_ends_at, package_id")
      .eq("organization_id", organizationId)
      .in("status", ["active", "trial"])
      .order("started_at", { ascending: false } as never)
      .limit(1);

    const sub = (subs ?? [])[0];
    if (!sub) return { ...SAFE_DEFAULT };

    const status = sub.status as string;
    if (status !== "active" && status !== "trial") return { ...SAFE_DEFAULT };
    if (status === "trial") {
      const trialEnds = sub.trial_ends_at as string | null;
      if (trialEnds && new Date(trialEnds).getTime() < Date.now()) return { ...SAFE_DEFAULT };
    }

    const packageId = sub.package_id as string;
    if (!packageId) return { ...SAFE_DEFAULT };

    // Fetch all features and limits for the package in parallel
    const [featuresData, limitsData] = await Promise.all([
      (s as never as {
        from(t: string): {
          select(c: string): {
            eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
          };
        };
      }).from("package_features").select("feature_code, value").eq("package_id", packageId),
      (s as never as {
        from(t: string): {
          select(c: string): {
            eq(k: string, v: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
          };
        };
      }).from("package_limits").select("limit_code, value").eq("package_id", packageId),
    ]);

    // Build feature lookup
    const featureValues: Record<string, boolean> = {};
    for (const f of (featuresData.data ?? [])) {
      const val = f.value;
      featureValues[f.feature_code as string] = val === true || val === "true";
    }

    // Build limit lookup
    const limitValues: Record<string, number> = {};
    for (const l of (limitsData.data ?? [])) {
      limitValues[l.limit_code as string] = l.value as number;
    }

    // Build the full OrgFeatureFlags object from the map
    const result: Record<string, unknown> = {};
    for (const [key, mapping] of Object.entries(FEATURE_MAP)) {
      if (mapping.type === "feature") {
        result[key] = featureValues[mapping.code] ?? false;
      } else {
        result[key] = limitValues[mapping.code] ?? 0;
      }
    }

    return result as unknown as OrgFeatureFlags;
  } catch (error) {
    console.error("Feature resolver failed:", error instanceof Error ? error.message : "Unknown error");
    return { ...SAFE_DEFAULT };
  }
}

/**
 * Checks a single feature for an organization.
 * Logs a warning if the feature key is not recognized (prevents silent false returns).
 */
export async function hasFeature(organizationId: string, feature: FeatureFlagKey): Promise<boolean> {
  const mapping = FEATURE_MAP[feature];
  if (!mapping) {
    console.error(`[feature-resolver] Unknown feature key: "${feature}". Add it to FEATURE_MAP.`);
    return false;
  }
  if (mapping.type !== "feature") {
    // This is a limit key, not a feature flag
    return false;
  }
  return organizationHasFeature(organizationId, mapping.code);
}

/**
 * Throws if an organization does not have a required feature.
 */
export async function assertFeature(organizationId: string, feature: FeatureFlagKey): Promise<void> {
  const enabled = await hasFeature(organizationId, feature);
  if (!enabled) throw new Error("Feature not available on your current plan.");
}

/**
 * Checks whether an organization can add another member.
 */
export async function isWithinMemberLimit(organizationId: string, currentMemberCount: number): Promise<boolean> {
  const flags = await getOrgFeatureFlags(organizationId);
  if (flags.maxMembers === -1) return true;
  return currentMemberCount < flags.maxMembers;
}

/**
 * Checks whether an organization can add another branch.
 */
export async function isWithinBranchLimit(organizationId: string, currentBranchCount: number): Promise<boolean> {
  const flags = await getOrgFeatureFlags(organizationId);
  if (flags.maxBranches === -1) return true;
  return currentBranchCount < flags.maxBranches;
}
