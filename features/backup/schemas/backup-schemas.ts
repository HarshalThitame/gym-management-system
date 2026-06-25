import { z } from "zod";

export const backupTypeEnum = z.enum(["database", "files", "configuration", "full"]);
export const backupScopeEnum = z.enum(["platform", "tenant", "branch"]);
export const recoveryTypeEnum = z.enum([
  "full_platform", "database", "storage", "tenant", "franchise_group",
  "branch", "membership_data", "payment_data", "attendance_data",
  "training_data", "class_data", "communication_data", "analytics_data",
  "content_data", "configuration_data", "audit_data", "security_data",
  "billing_data", "user_data", "organization_data", "reporting_data", "custom"
]);
export const frequencyEnum = z.enum(["hourly", "daily", "weekly", "monthly", "custom_cron"]);
export const storageTierEnum = z.enum(["hot", "warm", "cold", "archive"]);
export const verificationTypeEnum = z.enum([
  "completeness", "file_integrity", "db_consistency", "encryption_validity", "full_recovery_test"
]);
export const complianceReportTypeEnum = z.enum([
  "backup_compliance", "recovery_testing", "dr_readiness", "audit",
  "gdpr", "soc2", "hipaa", "pci"
]);

export const startBackupSchema = z.object({
  backupType: backupTypeEnum,
  scope: backupScopeEnum,
  organizationId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  reason: z.string().trim().min(10, "Reason must be at least 10 characters.").max(1000),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
});

export const deleteBackupSchema = z.object({
  backupId: z.string().uuid(),
  reason: z.string().trim().min(10, "Reason must be at least 10 characters.").max(1000),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
});

export const initiateRecoverySchema = z.object({
  backupId: z.string().uuid(),
  recoveryType: recoveryTypeEnum,
  scope: backupScopeEnum,
  organizationId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  pitrPointId: z.string().uuid().optional(),
  pitrTimestamp: z.string().optional(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
});

export const approveRecoverySchema = z.object({
  recoveryId: z.string().uuid(),
  decision: z.enum(["approve", "reject", "escalate"]),
  reviewNote: z.string().trim().max(500).optional(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation."),
});

export const saveBackupScheduleSchema = z.object({
  scheduleId: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(200),
  backupType: backupTypeEnum,
  frequency: frequencyEnum,
  customCron: z.string().trim().optional(),
  retentionDays: z.number().int().min(1).max(3650),
  storageTier: storageTierEnum,
  isActive: z.boolean().default(true),
  preferredWindowStart: z.string().optional(),
  preferredWindowEnd: z.string().optional(),
});

export const deleteBackupScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
  stepUpEmail: z.string().trim().email("Enter your Super Admin email for step-up confirmation.").optional(),
});

export const runVerificationSchema = z.object({
  backupId: z.string().uuid(),
  verificationType: verificationTypeEnum,
});

export const generateComplianceSchema = z.object({
  reportType: complianceReportTypeEnum,
  organizationId: z.string().uuid().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
});

export type StartBackupInput = z.infer<typeof startBackupSchema>;
export type DeleteBackupInput = z.infer<typeof deleteBackupSchema>;
export type InitiateRecoveryInput = z.infer<typeof initiateRecoverySchema>;
export type ApproveRecoveryInput = z.infer<typeof approveRecoverySchema>;
export type SaveBackupScheduleInput = z.infer<typeof saveBackupScheduleSchema>;
export type DeleteBackupScheduleInput = z.infer<typeof deleteBackupScheduleSchema>;
export type RunVerificationInput = z.infer<typeof runVerificationSchema>;
export type GenerateComplianceInput = z.infer<typeof generateComplianceSchema>;
