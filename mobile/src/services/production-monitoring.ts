import { getSupabaseClient } from "@/api/supabase";
import { getPerformanceReport } from "@/hooks/use-performance-monitor";
import { syncEngine } from "@/offline/sync-engine";

export interface HealthStatus {
  api: "healthy" | "degraded" | "down";
  database: "healthy" | "degraded" | "down";
  sync: "healthy" | "degraded" | "down";
  storage: "healthy" | "degraded" | "down";
  uptime: number;
  lastError: string | null;
}

const startTime = Date.now();
let lastError: string | null = null;

export const productionMonitor = {
  getUptimeSeconds(): number {
    return Math.round((Date.now() - startTime) / 1000);
  },

  recordError(error: Error): void {
    lastError = error.message;
  },

  async getHealthStatus(): Promise<HealthStatus> {
    const status: HealthStatus = {
      api: "healthy",
      database: "healthy",
      sync: "healthy",
      storage: "healthy",
      uptime: this.getUptimeSeconds(),
      lastError,
    };

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("members").select("id", { count: "exact", head: true }).limit(1);
      if (error) status.database = "degraded";
    } catch { status.database = "down"; }

    const syncStatus = syncEngine.getQueueStatus();
    if (syncStatus.failed > 10) status.sync = "degraded";
    if (syncStatus.failed > 50) status.sync = "down";

    return status;
  },

  getSyncReport(): { totalProcessed: number; failed: number; conflicts: number; avgRetries: number } {
    const status = syncEngine.getQueueStatus();
    return {
      totalProcessed: status.total,
      failed: status.failed,
      conflicts: 0,
      avgRetries: status.failed > 0 ? Math.round(status.failed / Math.max(1, status.total)) : 0,
    };
  },

  getPerformanceSnapshot(): Record<string, { avg: number; min: number; max: number; count: number }> {
    return getPerformanceReport();
  },
};
