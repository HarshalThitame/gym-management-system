import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assertFeature,
  getOrgFeatureFlags,
  hasFeature,
  isWithinBranchLimit,
  isWithinMemberLimit
} from "@/lib/tenant/feature-resolver";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import type { OrgFeatureFlags } from "@/lib/tenant/feature-flags";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn()
}));

const getSupabaseAdminClientMock = vi.mocked(getSupabaseAdminClient);
const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);

const safeDefaultFlags: OrgFeatureFlags = {
  maxMembers: 0, maxBranches: 0, maxTrainers: 0, maxStaff: 0, maxStorageGb: 0, maxApiCalls: 0,
  membershipPlanTypes: 0, weeklyClasses: 0, smsMonthly: 0,
  manualAttendance: false, qrAttendanceEnabled: false, dynamicQrAttendance: false,
  trainerAttendance: false, staffAttendance: false, branchAttendance: false,
  biometricAttendanceEnabled: false, fingerprintAttendance: false,
  rfidAttendanceEnabled: false, nfcAttendance: false, geoFencingAttendance: false,
  attendanceApi: false, attendanceReports: false,
  memberManagement: false, membershipRenewals: false, expiryTracking: false,
  goalTracking: false, progressPhotos: false, membershipPauseFreeze: false,
  memberTaggingSegments: false, memberProgressTracking: false,
  crossBranchMemberAccess: false, customMemberFields: false, memberDataImportExport: false,
  leadManagement: false, trialManagement: false,
  leadFollowupReminders: false, reEngagementAutomation: false,
  advancedCrmLeadPipeline: false, referralProgram: false, loyaltyPointsSystem: false,
  networkWideCampaignManager: false, memberNpsSurveys: false,
  trainerManagement: false, workoutAssignment: false, nutritionPlans: false,
  ptSessions: false, classBooking: false, waitlistManagement: false,
  crossBranchClassBooking: false, trainerCommissionsPayroll: false, staffAttendanceLeave: false,
  classAttendanceTracking: false, payrollExport: false, roleBasedPermissions: false,
  networkWideClassCalendar: false, trainerSharingAcrossBranches: false,
  customRolesGranularPermissions: false, multiBranchStaffAssignment: false, hrDocumentStorage: false,
  billingInvoices: false, receipts: false, paymentTracking: false,
  onlinePaymentLinks: false, renewalReminders: false,
  autoBilling: false, discountPromoCodes: false, corporateBulkMemberships: false,
  paymentFailureHandling: false, partialPaymentDues: false, razorpayPayuIntegration: false,
  multiGstinSupport: false,
  branchRevenueSplit: false,
  basicReports: false, advancedReportsEnabled: false, customDashboards: false,
  customDashboardsKpis: false,
  trainerPerformanceReport: false, classOccupancyReport: false, leadConversionReport: false,
  branchRevenueComparison: false,
  scheduledReportDelivery: false, equipmentInventoryMaintenance: false, dataExportCsvDownload: false,
  emailNotifications: false, inAppNotifications: false,
  whatsappIntegration: false, smsIntegration: false,
  birthdayGreetings: false, broadcastMessages: false, emailCampaigns: false,
  whatsappBusinessApi: false,
  memberPortal: false, trainerPortal: false, brandedMobileApp: false, dietWorkoutPlans: false,
  googleCalendarSync: false,
  inAppPushNotifications: false, digitalMembershipCard: false, loyaltyRewardsInApp: false,
  aiEnabled: false, aiCoach: false, aiRetentionAnalysis: false, aiRevenueInsights: false,
  whiteLabelEnabled: false, customDomainEnabled: false, customBranding: false,
  multiBranchManagement: false,
  apiAccessEnabled: false, webhooks: false, auditLogs: false,
  advancedRbac: false, prioritySupport: false, staffManagement: false,
  tallyZohoBooksIntegration: false, restApiAccess: false,

  classSchedulingEnabled: false, communicationsEnabled: false,
  trainerAssignmentEnabled: false, razorpayEnabled: false,
};
const standardPackage = {
  max_members: 500,
  max_branches: 3,
  max_gyms: 3,
  max_trainers: 20,
  max_storage_gb: 50,
  max_api_calls: 10000,
  qr_attendance_enabled: true,
  biometric_attendance_enabled: true,
  rfid_attendance_enabled: false,
  class_scheduling_enabled: true,
  trainer_assignment_enabled: true,
  razorpay_enabled: true,
  communications_enabled: true,
  ai_enabled: false,
  advanced_reports_enabled: true,
  custom_domain_enabled: false,
  api_access_enabled: false
};

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type QueryMock = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function createQuery(result: QueryResult, listResult?: QueryResult): QueryMock {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result)
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue(listResult ?? {
    data: Array.isArray(result.data) ? result.data : result.data ? [result.data] : [],
    error: result.error
  });

  return query;
}

function createThrowingQuery(error: Error): QueryMock {
  const query = createQuery({ data: null, error: null });
  query.maybeSingle.mockRejectedValue(error);
  query.limit.mockRejectedValue(error);
  return query;
}

function mockClientForQuery(query: QueryMock) {
  return {
    from: vi.fn().mockReturnValue(query)
  };
}

function mockFeatureClient(data: unknown, error: { message: string } | null = null) {
  getSupabaseAdminClientMock.mockReturnValue(createFeatureClient(data, error) as never);
}

function mockFeatureClientThrow(error: Error) {
  getSupabaseAdminClientMock.mockReturnValue(mockClientForQuery(createThrowingQuery(error)) as never);
}

function activeSubscription(packageRow = standardPackage) {
  return {
    status: "active",
    trial_ends_at: null,
    package_id: "package_1",
    packages: packageRow
  };
}

function createFeatureClient(data: unknown, error: { message: string } | null = null) {
  const sub = data && typeof data === "object" ? data as Record<string, unknown> : null;
  const packageRow = sub?.packages && typeof sub.packages === "object" ? sub.packages as Record<string, unknown> : {};
  const subscriptionRow = sub ? { ...sub, packages: undefined } : null;

  return {
    from: vi.fn((table: string) => {
      if (table === "organization_subscriptions") {
        return createQuery(
          { data: subscriptionRow, error },
          { data: subscriptionRow ? [subscriptionRow] : [], error }
        );
      }

      if (table === "package_features") {
        return createImmediateEqQuery({ data: packageFeatureRows(packageRow), error: null });
      }

      if (table === "package_limits") {
        return createImmediateEqQuery({ data: packageLimitRows(packageRow), error: null });
      }

      return createQuery({ data: null, error: null });
    })
  };
}

function createImmediateEqQuery(result: QueryResult) {
  let featureCode: string | null = null;
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    then: vi.fn((resolve: (value: QueryResult) => unknown) => resolve(readResult()))
  };
  query.select.mockReturnValue(query);
  query.eq.mockImplementation((column: string, value: string) => {
    if (column === "feature_code") featureCode = value;
    return query;
  });

  function readResult(): QueryResult {
    if (!featureCode || !Array.isArray(result.data)) return result;
    return {
      data: result.data.filter((row) => {
        return Boolean(row) && typeof row === "object" && (row as Record<string, unknown>).feature_code === featureCode;
      }),
      error: result.error
    };
  }

  return query;
}

function packageFeatureRows(packageRow: Record<string, unknown>) {
  return [
    ["qr_attendance", packageRow.qr_attendance_enabled],
    ["biometric_attendance", packageRow.biometric_attendance_enabled],
    ["rfid_attendance", packageRow.rfid_attendance_enabled],
    ["class_booking", packageRow.class_scheduling_enabled],
    ["workout_assignment", packageRow.trainer_assignment_enabled],
    ["billing_invoices", packageRow.razorpay_enabled],
    ["whatsapp_integration", packageRow.communications_enabled],
    ["ai_recommendations", packageRow.ai_enabled],
    ["advanced_reports", packageRow.advanced_reports_enabled],
    ["custom_domain", packageRow.custom_domain_enabled],
    ["api_access", packageRow.api_access_enabled]
  ].map(([feature_code, value]) => ({ feature_code, value: Boolean(value) }));
}

function packageLimitRows(packageRow: Record<string, unknown>) {
  return [
    ["max_members", packageRow.max_members],
    ["max_branches", packageRow.max_branches ?? packageRow.max_gyms],
    ["max_trainers", packageRow.max_trainers],
    ["max_staff", packageRow.max_staff],
    ["max_storage_gb", packageRow.max_storage_gb],
    ["max_api_calls", packageRow.max_api_calls]
  ].map(([limit_code, value]) => ({ limit_code, value: typeof value === "number" ? value : 0 }));
}

describe("feature resolver", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns safe defaults when no subscription exists", async () => {
    mockFeatureClient(null);

    await expect(getOrgFeatureFlags("org_1")).resolves.toEqual(safeDefaultFlags);
  });

  it("maps active subscription package flags to camelCase values", async () => {
    mockFeatureClient(activeSubscription());

    await expect(getOrgFeatureFlags("org_1")).resolves.toMatchObject({
      maxMembers: 500,
      maxBranches: 3,
      qrAttendanceEnabled: true,
      biometricAttendanceEnabled: true,
      rfidAttendanceEnabled: false,
      classBooking: true,
      workoutAssignment: true,
      billingInvoices: true,
      aiEnabled: false,
      advancedReportsEnabled: true,
      customDomainEnabled: false,
      apiAccessEnabled: false
    });
  });

  it("returns safe defaults when the Supabase query throws", async () => {
    mockFeatureClientThrow(new Error("database unavailable"));

    await expect(getOrgFeatureFlags("org_1")).resolves.toEqual(safeDefaultFlags);
  });

  it("hasFeature returns the requested feature state", async () => {
    mockFeatureClient(activeSubscription());
    await expect(hasFeature("org_1", "classBooking")).resolves.toBe(true);

    mockFeatureClient(activeSubscription());
    await expect(hasFeature("org_1", "aiEnabled")).resolves.toBe(false);
  });

  it("assertFeature resolves when the feature is enabled", async () => {
    mockFeatureClient(activeSubscription());

    await expect(assertFeature("org_1", "classBooking")).resolves.toBeUndefined();
  });

  it("assertFeature throws when the feature is disabled", async () => {
    mockFeatureClient(activeSubscription());

    await expect(assertFeature("org_1", "aiEnabled")).rejects.toThrow("Feature not available on your current plan");
  });

  it("isWithinMemberLimit allows unlimited member capacity", async () => {
    mockFeatureClient(activeSubscription({ ...standardPackage, max_members: -1 }));

    await expect(isWithinMemberLimit("org_1", 100_000)).resolves.toBe(true);
  });

  it("isWithinMemberLimit blocks counts at or above the limit", async () => {
    mockFeatureClient(activeSubscription({ ...standardPackage, max_members: 5 }));
    await expect(isWithinMemberLimit("org_1", 4)).resolves.toBe(true);

    mockFeatureClient(activeSubscription({ ...standardPackage, max_members: 5 }));
    await expect(isWithinMemberLimit("org_1", 5)).resolves.toBe(false);
  });

  it("isWithinBranchLimit follows unlimited and finite branch limits", async () => {
    mockFeatureClient(activeSubscription({ ...standardPackage, max_branches: -1 }));
    await expect(isWithinBranchLimit("org_1", 100)).resolves.toBe(true);

    mockFeatureClient(activeSubscription({ ...standardPackage, max_branches: 3 }));
    await expect(isWithinBranchLimit("org_1", 2)).resolves.toBe(true);

    mockFeatureClient(activeSubscription({ ...standardPackage, max_branches: 3 }));
    await expect(isWithinBranchLimit("org_1", 3)).resolves.toBe(false);
  });

  it("getOrgPlanContext marks active future trials as trialing and past trials as not trialing", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const pastDate = new Date(Date.now() - 86_400_000).toISOString();

    mockFeatureClient(activeSubscription());
    createSupabaseServerClientMock.mockResolvedValueOnce(mockClientForQuery(createQuery({
      data: {
        status: "trial",
        expires_at: null,
        trial_ends_at: futureDate,
        packages: { name: "Example Plan" }
      },
      error: null
    })) as never);

    await expect(getOrgPlanContext("org_1")).resolves.toMatchObject({
      packageName: "Example Plan",
      status: "trial",
      isTrialing: true
    });

    mockFeatureClient(activeSubscription());
    createSupabaseServerClientMock.mockResolvedValueOnce(mockClientForQuery(createQuery({
      data: {
        status: "trial",
        expires_at: null,
        trial_ends_at: pastDate,
        packages: { name: "Example Plan" }
      },
      error: null
    })) as never);

    await expect(getOrgPlanContext("org_1")).resolves.toMatchObject({
      packageName: "Example Plan",
      status: "trial",
      isTrialing: false
    });
  });
});
