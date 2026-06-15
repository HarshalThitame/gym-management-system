import { secureStorage } from "@/storage/secure";
import { syncEngine } from "@/offline/sync-engine";
import { cacheSet, cacheGet } from "@/storage/sqlite-cache";

const QR_CACHE_KEY_PREFIX = "qr_code_";
const QR_CACHE_TTL_MS = 35 * 1000;

export const qrOfflineService = {
  async cacheQR(memberId: string, qrData: string): Promise<void> {
    await cacheSet(`${QR_CACHE_KEY_PREFIX}${memberId}`, {
      qrData,
      generatedAt: Date.now(),
      memberId,
    }, QR_CACHE_TTL_MS);
  },

  async getCachedQR(memberId: string): Promise<{ qrData: string; fresh: boolean } | null> {
    const cached = await cacheGet<{ qrData: string; generatedAt: number; memberId: string }>(
      `${QR_CACHE_KEY_PREFIX}${memberId}`
    );
    if (!cached) return null;
    const age = Date.now() - cached.data.generatedAt;
    return {
      qrData: cached.data.qrData,
      fresh: age < 30000,
    };
  },

  async queueAttendanceCheckIn(memberId: string, gymId: string, qrData: string): Promise<void> {
    await syncEngine.enqueue("attendance_check_in", {
      member_id: memberId,
      gym_id: gymId,
      method: "qr",
      qr_data: qrData,
      offline_validation: true,
    });
  },

  async queueAttendanceCheckOut(memberId: string, sessionId: string): Promise<void> {
    await syncEngine.enqueue("attendance_check_out", {
      member_id: memberId,
      session_id: sessionId,
    });
  },
};
