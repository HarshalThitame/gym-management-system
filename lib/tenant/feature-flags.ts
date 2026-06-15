export interface OrgFeatureFlags {
  maxMembers: number;
  maxBranches: number;
  maxTrainers: number;
  maxStaff: number;
  maxStorageGb: number;
  maxApiCalls: number;

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

  // CRM
  leadManagement: boolean;
  trialManagement: boolean;

  // Trainer
  trainerManagement: boolean;
  workoutAssignment: boolean;
  nutritionPlans: boolean;
  ptSessions: boolean;
  classBooking: boolean;

  // Billing
  billingInvoices: boolean;
  receipts: boolean;
  paymentTracking: boolean;

  // Reports
  basicReports: boolean;
  advancedReportsEnabled: boolean;

  // Communication
  emailNotifications: boolean;
  inAppNotifications: boolean;
  whatsappIntegration: boolean;
  smsIntegration: boolean;

  // Platform
  memberPortal: boolean;
  trainerPortal: boolean;

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

  // Legacy aliases for backward compatibility (resolved via FEATURE_MAP aliases)
  classSchedulingEnabled: boolean;
  communicationsEnabled: boolean;
  trainerAssignmentEnabled: boolean;
  razorpayEnabled: boolean;
}

export type FeatureFlagKey = keyof OrgFeatureFlags;
