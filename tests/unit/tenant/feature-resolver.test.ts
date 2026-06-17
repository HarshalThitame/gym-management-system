import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn()
}));

const createSupabaseServerClientMock = vi.mocked(createSupabaseServerClient);

const safeDefaultFlags: OrgFeatureFlags = {
  maxMembers: 0, maxBranches: 0, maxTrainers: 0, maxStaff: 0, maxStorageGb: 0, maxApiCalls: 0,
  membershipPlanTypes: 0, weeklyClasses: 0, smsMonthly: 0,
  manualAttendance: false, qrAttendanceEnabled: false, dynamicQrAttendance: false,
  trainerAttendance: false, staffAttendance: false, branchAttendance: false,
  biometricAttendanceEnabled: false, fingerprintAttendance: false, faceRecognitionAttendance: false,
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
  multiCurrencyBilling: false, franchiseFeeManagement: false, multiGstinSupport: false,
  posMerchandiseSupplements: false, branchRevenueSplit: false,
  basicReports: false, advancedReportsEnabled: false, customDashboards: false,
  customDashboardsKpis: false,
  trainerPerformanceReport: false, classOccupancyReport: false, leadConversionReport: false,
  branchRevenueComparison: false, franchiseRollupReports: false, franchiseRollupDashboard: false,
  scheduledReportDelivery: false, equipmentInventoryMaintenance: false, dataExportCsvDownload: false,
  emailNotifications: false, inAppNotifications: false,
  whatsappIntegration: false, smsIntegration: false,
  birthdayGreetings: false, broadcastMessages: false, emailCampaigns: false,
  whatsappBusinessApi: false,
  memberPortal: false, trainerPortal: false, brandedMobileApp: false, dietWorkoutPlans: false,
  whiteLabelMobileApp: false, googleCalendarSync: false,
  inAppPushNotifications: false, digitalMembershipCard: false, loyaltyRewardsInApp: false,
  aiEnabled: false, aiCoach: false, aiRetentionAnalysis: false, aiRevenueInsights: false,
  whiteLabelEnabled: false, customDomainEnabled: false, customBranding: false,
  multiBranchManagement: false, franchiseManagement: false,
  apiAccessEnabled: false, webhooks: false, auditLogs: false,
  advancedRbac: false, prioritySupport: false, staffManagement: false,
  tallyZohoBooksIntegration: false, restApiAccess: false,
  ssoSamlLogin: false, dedicatedCloudInfrastructure: false,
  dedicatedOnboardingManager: false, responseSla: false, namedAccountManager: false,
  automatedBackups90DayRetention: false, uptimeSla99_9: false,
  staffTrainingSessions: false, customFeatureRequests: false,
  classSchedulingEnabled: false, communicationsEnabled: false,
  trainerAssignmentEnabled: false, razorpayEnabled: false,
};
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

function createQuery(result: QueryResult): QueryMock {
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
  query.limit.mockReturnValue(query);

  return query;
}

function createThrowingQuery(error: Error): QueryMock {
  const query = createQuery({ data: null, error: null });
  query.maybeSingle.mockRejectedValue(error);
  return query;
}

function mockClientForQuery(query: QueryMock) {
  return {
    from: vi.fn().mockReturnValue(query)
  };
}

function mockFeatureClient(data: unknown, error: { message: string } | null = null) {
  createSupabaseServerClientMock.mockResolvedValueOnce(mockClientForQuery(createQuery({ data, error })) as never);
}

function mockFeatureClientThrow(error: Error) {
  createSupabaseServerClientMock.mockResolvedValueOnce(mockClientForQuery(createThrowingQuery(error)) as never);
}

function activeSubscription(packageRow = standardPackage) {
  return {
    status: "active",
    trial_ends_at: null,
    packages: packageRow
  };
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

    await expect(getOrgFeatureFlags("org_1")).resolves.toEqual({
      maxMembers: 500,
      maxBranches: 3,
      qrAttendanceEnabled: true,
      biometricAttendanceEnabled: true,
      rfidAttendanceEnabled: false,
      classBooking: true,
      workoutAssignment: true,
      billingInvoices: true,
      emailNotifications: true,
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
