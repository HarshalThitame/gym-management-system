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
  faceRecognitionAttendance: boolean;
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

  // CRM
  leadManagement: boolean;
  trialManagement: boolean;

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

  // Billing
  billingInvoices: boolean;
  receipts: boolean;
  paymentTracking: boolean;
  onlinePaymentLinks: boolean;
  renewalReminders: boolean;
  autoBilling: boolean;
  discountPromoCodes: boolean;
  corporateBulkMemberships: boolean;

  // Reports
  basicReports: boolean;
  advancedReportsEnabled: boolean;
  customDashboards: boolean;

  // Communication
  emailNotifications: boolean;
  inAppNotifications: boolean;
  whatsappIntegration: boolean;
  smsIntegration: boolean;
  birthdayGreetings: boolean;
  broadcastMessages: boolean;
  emailCampaigns: boolean;

  // Platform
  memberPortal: boolean;
  trainerPortal: boolean;
  brandedMobileApp: boolean;
  dietWorkoutPlans: boolean;

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
  franchiseManagement: boolean;
  apiAccessEnabled: boolean;
  webhooks: boolean;
  auditLogs: boolean;
  advancedRbac: boolean;
  prioritySupport: boolean;
  staffManagement: boolean;

  // Legacy aliases
  classSchedulingEnabled: boolean;
  communicationsEnabled: boolean;
  trainerAssignmentEnabled: boolean;
  razorpayEnabled: boolean;
}

export type FeatureFlagKey = keyof OrgFeatureFlags;
