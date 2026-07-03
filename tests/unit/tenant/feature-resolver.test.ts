import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertFeature,
  getOrgFeatureFlags,
  hasFeature,
  isWithinBranchLimit,
  isWithinMemberLimit,
} from "@/lib/tenant/feature-resolver";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import type { OrgFeatureFlags } from "@/lib/tenant/feature-flags";

const { getOrganizationEntitlementsMock, hasFeatureAccessMock } = vi.hoisted(() => ({
  getOrganizationEntitlementsMock: vi.fn(),
  hasFeatureAccessMock: vi.fn(),
}));

vi.mock("@/features/entitlement", () => ({
  getOrganizationEntitlements: getOrganizationEntitlementsMock,
  hasFeatureAccess: hasFeatureAccessMock,
}));

const safeDefaultFlags: OrgFeatureFlags = {
  maxMembers: 0, maxBranches: 0, maxTrainers: 0, maxStaff: 0, maxStorageGb: 0, maxApiCalls: 0,
  membershipPlanTypes: 0, weeklyClasses: 0, smsMonthly: 0,
  manualAttendance: false, qrAttendanceEnabled: false, dynamicQrAttendance: false,
  trainerAttendance: false, staffAttendance: false, branchAttendance: false,
  biometricAttendanceEnabled: false, fingerprintAttendance: false, rfidAttendanceEnabled: false,
  nfcAttendance: false, geoFencingAttendance: false, attendanceApi: false, attendanceReports: false,
  memberManagement: false, membershipRenewals: false, expiryTracking: false, goalTracking: false,
  progressPhotos: false, membershipPauseFreeze: false, memberTaggingSegments: false, memberProgressTracking: false,
  crossBranchMemberAccess: false, customMemberFields: false, memberDataImportExport: false,
  leadManagement: false, trialManagement: false, leadFollowupReminders: false, reEngagementAutomation: false,
  advancedCrmLeadPipeline: false, referralProgram: false, loyaltyPointsSystem: false,
  networkWideCampaignManager: false, memberNpsSurveys: false,
  trainerManagement: false, workoutAssignment: false, nutritionPlans: false, ptSessions: false,
  classBooking: false, waitlistManagement: false, crossBranchClassBooking: false,
  trainerCommissionsPayroll: false, staffAttendanceLeave: false, classAttendanceTracking: false,
  payrollExport: false, roleBasedPermissions: false, networkWideClassCalendar: false,
  trainerSharingAcrossBranches: false, customRolesGranularPermissions: false,
  multiBranchStaffAssignment: false, hrDocumentStorage: false,
  billingInvoices: false, receipts: false, paymentTracking: false, onlinePaymentLinks: false,
  renewalReminders: false, autoBilling: false, discountPromoCodes: false, corporateBulkMemberships: false,
  paymentFailureHandling: false, partialPaymentDues: false, razorpayPayuIntegration: false,
  multiGstinSupport: false, branchRevenueSplit: false,
  basicReports: false, advancedReportsEnabled: false, customDashboards: false, customDashboardsKpis: false,
  trainerPerformanceReport: false, classOccupancyReport: false, leadConversionReport: false,
  branchRevenueComparison: false, scheduledReportDelivery: false, equipmentInventoryMaintenance: false,
  dataExportCsvDownload: false,
  emailNotifications: false, inAppNotifications: false, whatsappIntegration: false, smsIntegration: false,
  birthdayGreetings: false, broadcastMessages: false, emailCampaigns: false, whatsappBusinessApi: false,
  customEmailDomain: false,
  memberPortal: false, trainerPortal: false, brandedMobileApp: false, dietWorkoutPlans: false,
  googleCalendarSync: false, inAppPushNotifications: false, digitalMembershipCard: false, loyaltyRewardsInApp: false,
  aiEnabled: false, aiCoach: false, aiRetentionAnalysis: false, aiRevenueInsights: false,
  whiteLabelEnabled: false, customDomainEnabled: false, customBranding: false,
  multiBranchManagement: false, apiAccessEnabled: false, webhooks: false, auditLogs: false,
  advancedRbac: false, prioritySupport: false, staffManagement: false, tallyZohoBooksIntegration: false,
  restApiAccess: false,
  classSchedulingEnabled: false, communicationsEnabled: false, trainerAssignmentEnabled: false, razorpayEnabled: false,
};

function entitlementSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org_1",
    subscriptionId: "sub_1",
    packageId: "pkg_growth",
    packageName: "Growth",
    subscriptionStatus: "active",
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-12-31T00:00:00Z",
    activeFeatureKeys: [
      "qr_attendance",
      "biometric_attendance",
      "class_booking",
      "workout_assignment",
      "billing_invoices",
      "advanced_reports",
    ],
    limits: {
      max_members: 500,
      max_branches: 3,
      max_trainers: 20,
      max_staff: 0,
      max_storage_gb: 50,
      max_api_calls: 10000,
      membership_plan_types: 0,
      weekly_classes: 0,
      sms_monthly: 0,
    },
    isActive: true,
    isExpired: false,
    isScheduled: false,
    isCancelled: false,
    reason: null,
    message: null,
    warnings: [],
    ...overrides,
  };
}

describe("feature resolver", () => {
  beforeEach(() => {
    getOrganizationEntitlementsMock.mockReset();
    hasFeatureAccessMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns safe defaults when no subscription exists", async () => {
    getOrganizationEntitlementsMock.mockResolvedValue(entitlementSnapshot({ subscriptionId: null, packageId: null, packageName: "No Plan", subscriptionStatus: "none", activeFeatureKeys: [], limits: {}, isActive: false }));

    await expect(getOrgFeatureFlags("org_1")).resolves.toEqual(safeDefaultFlags);
  });

  it("maps active subscription package flags to camelCase values", async () => {
    getOrganizationEntitlementsMock.mockResolvedValue(entitlementSnapshot());

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
      apiAccessEnabled: false,
    });
  });

  it("returns safe defaults when entitlement lookup throws", async () => {
    getOrganizationEntitlementsMock.mockRejectedValue(new Error("database unavailable"));

    await expect(getOrgFeatureFlags("org_1")).resolves.toEqual(safeDefaultFlags);
  });

  it("hasFeature returns the requested feature state", async () => {
    hasFeatureAccessMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(hasFeature("org_1", "classBooking")).resolves.toBe(true);
    await expect(hasFeature("org_1", "aiEnabled")).resolves.toBe(false);
  });

  it("assertFeature resolves when the feature is enabled", async () => {
    hasFeatureAccessMock.mockResolvedValue(true);

    await expect(assertFeature("org_1", "classBooking")).resolves.toBeUndefined();
  });

  it("assertFeature throws when the feature is disabled", async () => {
    hasFeatureAccessMock.mockResolvedValue(false);

    await expect(assertFeature("org_1", "aiEnabled")).rejects.toThrow("Feature not available on your current plan");
  });

  it("isWithinMemberLimit allows unlimited member capacity", async () => {
    getOrganizationEntitlementsMock.mockResolvedValue(entitlementSnapshot({ limits: { ...entitlementSnapshot().limits, max_members: -1 } }));

    await expect(isWithinMemberLimit("org_1", 100_000)).resolves.toBe(true);
  });

  it("isWithinMemberLimit blocks counts at or above the limit", async () => {
    getOrganizationEntitlementsMock.mockResolvedValue(entitlementSnapshot({ limits: { ...entitlementSnapshot().limits, max_members: 5 } }));
    await expect(isWithinMemberLimit("org_1", 4)).resolves.toBe(true);
    await expect(isWithinMemberLimit("org_1", 5)).resolves.toBe(false);
  });

  it("isWithinBranchLimit follows unlimited and finite branch limits", async () => {
    getOrganizationEntitlementsMock.mockResolvedValueOnce(entitlementSnapshot({ limits: { ...entitlementSnapshot().limits, max_branches: -1 } }));
    await expect(isWithinBranchLimit("org_1", 100)).resolves.toBe(true);

    getOrganizationEntitlementsMock.mockResolvedValueOnce(entitlementSnapshot({ limits: { ...entitlementSnapshot().limits, max_branches: 3 } }));
    await expect(isWithinBranchLimit("org_1", 2)).resolves.toBe(true);

    getOrganizationEntitlementsMock.mockResolvedValueOnce(entitlementSnapshot({ limits: { ...entitlementSnapshot().limits, max_branches: 3 } }));
    await expect(isWithinBranchLimit("org_1", 3)).resolves.toBe(false);
  });

  it("getOrgPlanContext marks active future trials as trialing and past trials as not trialing", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const pastDate = new Date(Date.now() - 86_400_000).toISOString();

    const futureTrialSnapshot = entitlementSnapshot({
      packageName: "Growth",
      subscriptionStatus: "trial",
      endDate: futureDate,
    });
    getOrganizationEntitlementsMock.mockResolvedValue(futureTrialSnapshot);

    await expect(getOrgPlanContext("org_1")).resolves.toMatchObject({
      packageName: "Growth",
      status: "trial",
      isTrialing: true,
    });

    const pastTrialSnapshot = entitlementSnapshot({
      packageName: "Growth",
      subscriptionStatus: "trial",
      endDate: pastDate,
    });
    getOrganizationEntitlementsMock.mockResolvedValue(pastTrialSnapshot);

    await expect(getOrgPlanContext("org_1")).resolves.toMatchObject({
      packageName: "Growth",
      status: "trial",
      isTrialing: false,
    });
  });
});
