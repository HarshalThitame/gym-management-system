/* eslint-disable @typescript-eslint/no-explicit-any */
import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const CACHE_SECONDS = 30;

export type BackupDashboard = {
  executive: {
    totalBackups: number; successfulBackups: number; failedBackups: number;
    recoverySuccessRate: number; rpoMinutes: number; rtoMinutes: number;
    dataProtectedBytes: number; storageConsumedBytes: number;
    activeRecoveryJobs: number; drReadinessScore: number;
    totalBackupSizeBytes: number; avgBackupSizeBytes: number; lastBackupAt: string | null;
  };
  recentBackups: Array<{
    id: string; type: string; scope: string; status: string; sizeBytes: number;
    compressionRatio: number | null; encryptionStatus: string; verificationStatus: string;
    storageTier: string; region: string; environment: string; isImmutable: boolean;
    retentionUntil: string | null; recoveryPointAt: string | null; startedAt: string | null;
    completedAt: string | null; createdAt: string;
    organizationId: string | null; branchId: string | null;
  }>;
  recoverySessions: Array<{
    id: string; number: number; type: string; status: string; recoveryPoint: string;
    recordsAffected: number | null; estimatedDowntime: number | null;
    riskAssessment: string | null; approvalLevel: string | null;
    validatedAt: string | null; validationResult: string | null;
    createdAt: string; requestedBy: string | null;
  }>;
  replicationStatus: Array<{
    id: string; sourceRegion: string; targetRegion: string; type: string;
    status: string; lagSeconds: number | null; lastSyncedAt: string | null; isHealthy: boolean;
  }>;
  verifications: Array<{
    id: string; backupJobId: string; type: string; status: string;
    checksumMatch: boolean | null; verifiedAt: string | null;
  }>;
  storageTiers: Array<{
    id: string; name: string; totalBytes: number; usedBytes: number; backupCount: number;
    dedupSavings: number | null; compressionSavings: number | null; usagePercent: number;
  }>;
  securityEvents: Array<{
    id: string; type: string; severity: string; description: string;
    detectedBy: string; mitigationStatus: string; createdAt: string;
  }>;
  schedules: Array<{
    id: string; name: string; backupType: string; scope: string;
    frequency: string; retentionDays: number; storageTier: string;
    isActive: boolean; lastRunAt: string | null; nextRunAt: string | null;
  }>;
  pitrPoints: Array<{
    id: string; resourceType: string; recoveryTimestamp: string;
    granularity: string; isAvailable: boolean;
  }>;
  complianceReports: Array<{
    id: string; type: string; title: string; status: string;
    periodStart: string; periodEnd: string; generatedAt: string | null;
  }>;
  approvals: Array<{
    id: string; recoverySessionId: string; level: number; role: string;
    status: string; mfaVerified: boolean; respondedAt: string | null;
  }>;
  drStatus: Array<{
    id: string; planName: string; status: string; lastTestedAt: string | null;
    estimatedRto: number | null; estimatedRpo: number | null;
    hasAutoFailover: boolean; secondaryRegion: string | null;
  }>;
};

export async function getBackupDashboard(): Promise<BackupDashboard> {
  return getCachedBackupDashboard();
}

const getCachedBackupDashboard = unstable_cache(
  async (): Promise<BackupDashboard> => {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return getEmptyDashboard();
    const s = supabase as any;

    try {
      const [
        jobsRes, sessionsRes, replRes, verifRes, tiersRes,
        secEventsRes, schedRes, pitrRes, compRes, approvalsRes, drRes
      ] = await Promise.all([
        s.from("backup_jobs").select("*").order("created_at", { ascending: false }).limit(100),
        s.from("recovery_sessions").select("*").order("created_at", { ascending: false }).limit(50),
        s.from("backup_replication").select("*").order("last_synced_at", { ascending: false }).limit(20),
        s.from("backup_verifications").select("*").order("created_at", { ascending: false }).limit(50),
        s.from("backup_storage_tiers").select("*").order("tier_name"),
        s.from("backup_security_events").select("*").order("created_at", { ascending: false }).limit(50),
        s.from("backup_schedules").select("*").order("next_run_at"),
        s.from("backup_pitr_points").select("*").order("recovery_timestamp", { ascending: false }).limit(20),
        s.from("backup_compliance_reports").select("*").order("created_at", { ascending: false }).limit(20),
        s.from("recovery_approvals").select("*").order("created_at", { ascending: false }).limit(50),
        s.from("obs_dr_status").select("*")
      ]);

      const jobs = jobsRes?.data ?? [];
      const sessions = sessionsRes?.data ?? [];
      const replications = replRes?.data ?? [];
      const verifications = verifRes?.data ?? [];
      const tiers = tiersRes?.data ?? [];
      const securityEvents = secEventsRes?.data ?? [];
      const schedules = schedRes?.data ?? [];
      const pitr = pitrRes?.data ?? [];
      const complianceReports = compRes?.data ?? [];
      const approvals = approvalsRes?.data ?? [];
      const dr = drRes?.data ?? [];

      const totalBackups = jobs.length;
      const successful = jobs.filter((j: any) => j.status === "completed").length;
      const failed = jobs.filter((j: any) => j.status === "failed").length;
      const totalSize = jobs.reduce((s: number, j: any) => s + Number(j.size_mb ?? 0), 0) * 1024 * 1024;
      const recoverySessionsTotal = sessions.length;
      const completedRecoveries = sessions.filter((s: any) => s.status === "completed").length;
      const failedRecoveries = sessions.filter((s: any) => s.status === "failed").length;
      const recoverySuccessRate = recoverySessionsTotal > 0 ? Math.round((completedRecoveries / recoverySessionsTotal) * 100) : 100;
      const activeRecoveryJobs = sessions.filter((s: any) => ["pending", "scope_selected", "recovery_point_chosen", "approved", "executing"].includes(s.status)).length;
      const drScore = dr.length > 0 ? Math.round(dr.filter((d: any) => d.status === "ready" || d.status === "tested").length / dr.length * 100) : 0;
      const storageUsed = tiers.reduce((s: number, t: any) => s + Number(t.used_storage_bytes), 0);
      const lastBackup = jobs.find((j: any) => j.status === "completed");

      return {
        executive: {
          totalBackups, successfulBackups: successful, failedBackups: failed,
          recoverySuccessRate,
          rpoMinutes: dr[0]?.estimated_data_loss_minutes ?? 5,
          rtoMinutes: dr[0]?.estimated_recovery_time_minutes ?? 15,
          dataProtectedBytes: totalSize,
          storageConsumedBytes: storageUsed,
          activeRecoveryJobs, drReadinessScore: drScore,
          totalBackupSizeBytes: totalSize,
          avgBackupSizeBytes: totalBackups > 0 ? Math.round(totalSize / totalBackups) : 0,
          lastBackupAt: lastBackup?.completed_at ?? lastBackup?.created_at ?? null
        },
        recentBackups: jobs.slice(0, 50).map((j: any) => ({
          id: j.id, type: j.backup_type, scope: j.scope, status: j.status,
          sizeBytes: Number(j.size_mb ?? 0) * 1024 * 1024,
          compressionRatio: j.compression_ratio, encryptionStatus: j.encryption_status ?? "aes256",
          verificationStatus: j.verification_status ?? "pending",
          storageTier: j.storage_tier ?? "hot", region: j.region ?? "primary",
          environment: j.environment ?? "production", isImmutable: j.is_immutable ?? false,
          retentionUntil: j.retention_until, recoveryPointAt: j.recovery_point_at,
          startedAt: j.started_at, completedAt: j.completed_at, createdAt: j.created_at,
          organizationId: j.organization_id, branchId: j.branch_id
        })),
        recoverySessions: sessions.slice(0, 25).map((s: any) => ({
          id: s.id, number: s.session_number, type: s.recovery_type, status: s.status,
          recoveryPoint: s.recovery_point, recordsAffected: s.records_affected,
          estimatedDowntime: s.estimated_downtime_minutes,
          riskAssessment: s.risk_assessment, approvalLevel: s.approval_level,
          validatedAt: s.validated_at, validationResult: s.validation_result,
          createdAt: s.created_at, requestedBy: s.requested_by
        })),
        replicationStatus: replications.map((r: any) => ({
          id: r.id, sourceRegion: r.source_region, targetRegion: r.target_region,
          type: r.replication_type, status: r.status,
          lagSeconds: r.replication_lag_seconds, lastSyncedAt: r.last_synced_at,
          isHealthy: r.is_healthy
        })),
        verifications: verifications.slice(0, 25).map((v: any) => ({
          id: v.id, backupJobId: v.backup_job_id, type: v.verification_type,
          status: v.status, checksumMatch: v.checksum_match, verifiedAt: v.verified_at
        })),
        storageTiers: tiers.map((t: any) => ({
          id: t.id, name: t.tier_name, totalBytes: Number(t.total_storage_bytes),
          usedBytes: Number(t.used_storage_bytes), backupCount: t.backup_count,
          dedupSavings: t.dedup_savings_bytes ? Number(t.dedup_savings_bytes) : null,
          compressionSavings: t.compression_savings_bytes ? Number(t.compression_savings_bytes) : null,
          usagePercent: Number(t.total_storage_bytes) > 0 ? Math.round(Number(t.used_storage_bytes) / Number(t.total_storage_bytes) * 100) : 0
        })),
        securityEvents: securityEvents.slice(0, 25).map((e: any) => ({
          id: e.id, type: e.event_type, severity: e.severity, description: e.description,
          detectedBy: e.detected_by, mitigationStatus: e.mitigation_status, createdAt: e.created_at
        })),
        schedules: schedules.map((s: any) => ({
          id: s.id, name: s.schedule_name, backupType: s.backup_type, scope: s.scope,
          frequency: s.frequency, retentionDays: s.retention_days, storageTier: s.storage_tier,
          isActive: s.is_active, lastRunAt: s.last_run_at, nextRunAt: s.next_run_at
        })),
        pitrPoints: pitr.map((p: any) => ({
          id: p.id, resourceType: p.resource_type,
          recoveryTimestamp: p.recovery_timestamp, granularity: p.granularity,
          isAvailable: p.is_available
        })),
        complianceReports: complianceReports.map((r: any) => ({
          id: r.id, type: r.report_type, title: r.title, status: r.status,
          periodStart: r.period_start, periodEnd: r.period_end, generatedAt: r.generated_at
        })),
        approvals: approvals.map((a: any) => ({
          id: a.id, recoverySessionId: a.recovery_session_id, level: a.approval_level,
          role: a.approver_role, status: a.status, mfaVerified: a.mfa_verified,
          respondedAt: a.responded_at
        })),
        drStatus: dr.map((d: any) => ({
          id: d.id, planName: d.dr_plan_name, status: d.status,
          lastTestedAt: d.last_tested_at, estimatedRto: d.estimated_recovery_time_minutes,
          estimatedRpo: d.estimated_data_loss_minutes, hasAutoFailover: d.is_automatic_failover,
          secondaryRegion: d.secondary_region
        }))
      };
    } catch (err: any) {
      console.error("Backup fetch error:", err.message);
      return getEmptyDashboard();
    }
  },
  ["backup-dashboard"],
  { revalidate: CACHE_SECONDS }
);

function getEmptyDashboard(): BackupDashboard {
  return {
    executive: { totalBackups: 0, successfulBackups: 0, failedBackups: 0, recoverySuccessRate: 100, rpoMinutes: 5, rtoMinutes: 15, dataProtectedBytes: 0, storageConsumedBytes: 0, activeRecoveryJobs: 0, drReadinessScore: 0, totalBackupSizeBytes: 0, avgBackupSizeBytes: 0, lastBackupAt: null },
    recentBackups: [], recoverySessions: [], replicationStatus: [], verifications: [], storageTiers: [], securityEvents: [], schedules: [], pitrPoints: [], complianceReports: [], approvals: [], drStatus: []
  };
}
