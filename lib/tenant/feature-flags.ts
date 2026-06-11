export interface OrgFeatureFlags {
  maxMembers: number;
  maxBranches: number;
  qrAttendanceEnabled: boolean;
  biometricAttendanceEnabled: boolean;
  rfidAttendanceEnabled: boolean;
  classSchedulingEnabled: boolean;
  trainerAssignmentEnabled: boolean;
  razorpayEnabled: boolean;
  communicationsEnabled: boolean;
  aiEnabled: boolean;
  advancedReportsEnabled: boolean;
  customDomainEnabled: boolean;
  apiAccessEnabled: boolean;
}

export type FeatureFlagKey = {
  [Key in keyof OrgFeatureFlags]: OrgFeatureFlags[Key] extends boolean ? Key : never;
}[keyof OrgFeatureFlags];
