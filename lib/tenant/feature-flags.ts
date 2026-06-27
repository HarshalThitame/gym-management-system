export interface OrgFeatureFlags {
  maxMembers: number;
  maxBranches: number;
  maxTrainers: number;
  maxStaff: number;
  maxStorageGb: number;
  maxApiCalls: number;
  membershipPlanTypes: number;
  weeklyClasses: number;
  smsMonthly: number;

  // Attendance
  manualAttendance: boolean;
  qrAttendanceEnabled: boolean;
  dynamicQrAttendance: boolean;
  trainerAttendance: boolean;
  staffAttendance: boolean;
  branchAttendance: boolean;
  biometricAttendanceEnabled: boolean;
  fingerprintAttendance: boolean;
  rfidAttendanceEnabled: boolean;
  nfcAttendance: boolean;
  geoFencingAttendance: boolean;
  attendanceApi: boolean;
  attendanceReports: boolean;

  // Membership
  memberManagement: boolean;
  membershipRenewals: boolean;
  expiryTracking: boolean;
  goalTracking: boolean;
  progressPhotos: boolean;
  membershipPauseFreeze: boolean;
  memberTaggingSegments: boolean;
  memberProgressTracking: boolean;
  crossBranchMemberAccess: boolean;
  customMemberFields: boolean;
  memberDataImportExport: boolean;

  // CRM
  leadManagement: boolean;
  trialManagement: boolean;
  leadFollowupReminders: boolean;
  reEngagementAutomation: boolean;
  advancedCrmLeadPipeline: boolean;
  referralProgram: boolean;
  loyaltyPointsSystem: boolean;
  networkWideCampaignManager: boolean;
  memberNpsSurveys: boolean;

  // Trainer
  trainerManagement: boolean;
  workoutAssignment: boolean;
  nutritionPlans: boolean;
  ptSessions: boolean;
  classBooking: boolean;
  waitlistManagement: boolean;
  crossBranchClassBooking: boolean;
  trainerCommissionsPayroll: boolean;
  staffAttendanceLeave: boolean;
  classAttendanceTracking: boolean;
  payrollExport: boolean;
  roleBasedPermissions: boolean;
  networkWideClassCalendar: boolean;
  trainerSharingAcrossBranches: boolean;
  customRolesGranularPermissions: boolean;
  multiBranchStaffAssignment: boolean;
  hrDocumentStorage: boolean;

  // Billing
  billingInvoices: boolean;
  receipts: boolean;
  paymentTracking: boolean;
  onlinePaymentLinks: boolean;
  renewalReminders: boolean;
  autoBilling: boolean;
  discountPromoCodes: boolean;
  corporateBulkMemberships: boolean;
  paymentFailureHandling: boolean;
  partialPaymentDues: boolean;
  razorpayPayuIntegration: boolean;
  multiGstinSupport: boolean;
  branchRevenueSplit: boolean;

  // Reports
  basicReports: boolean;
  advancedReportsEnabled: boolean;
  customDashboards: boolean;
  customDashboardsKpis: boolean;
  trainerPerformanceReport: boolean;
  classOccupancyReport: boolean;
  leadConversionReport: boolean;
  branchRevenueComparison: boolean;

  scheduledReportDelivery: boolean;
  equipmentInventoryMaintenance: boolean;
  dataExportCsvDownload: boolean;

  // Communication
  emailNotifications: boolean;
  inAppNotifications: boolean;
  whatsappIntegration: boolean;
  smsIntegration: boolean;
  birthdayGreetings: boolean;
  broadcastMessages: boolean;
  emailCampaigns: boolean;
  whatsappBusinessApi: boolean;

  // Platform
  memberPortal: boolean;
  trainerPortal: boolean;
  brandedMobileApp: boolean;
  dietWorkoutPlans: boolean;
  googleCalendarSync: boolean;
  inAppPushNotifications: boolean;
  digitalMembershipCard: boolean;
  loyaltyRewardsInApp: boolean;

  // AI
  aiEnabled: boolean;
  aiCoach: boolean;
  aiRetentionAnalysis: boolean;
  aiRevenueInsights: boolean;

  // White Label
  whiteLabelEnabled: boolean;
  customDomainEnabled: boolean;
  customBranding: boolean;

  // Enterprise
  multiBranchManagement: boolean;
  apiAccessEnabled: boolean;
  webhooks: boolean;
  auditLogs: boolean;
  advancedRbac: boolean;
  prioritySupport: boolean;
  staffManagement: boolean;
  tallyZohoBooksIntegration: boolean;
  restApiAccess: boolean;


  // Legacy aliases
  classSchedulingEnabled: boolean;
  communicationsEnabled: boolean;
  trainerAssignmentEnabled: boolean;
  razorpayEnabled: boolean;
}

export type FeatureFlagKey = keyof OrgFeatureFlags;
