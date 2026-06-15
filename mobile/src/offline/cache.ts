import { secureStorage } from "@/storage/secure";
import type { CacheEntry } from "./types";
import { DEFAULT_OFFLINE_CONFIG } from "./types";

class OfflineCache {
  private storagePrefix = "apex_cache_";
  private defaultTTL = DEFAULT_OFFLINE_CONFIG.cacheDefaultTTLMs;

  async get<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
    try {
      const fullKey = `${this.storagePrefix}${key}`;
      const entry = await secureStorage.getJSON<CacheEntry<T>>(fullKey as never);

      if (!entry) return null;

      const now = Date.now();
      const cachedAt = new Date(entry.cachedAt).getTime();
      const age = now - cachedAt;

      if (entry.expiresAt) {
        const expiredAt = new Date(entry.expiresAt).getTime();
        if (now > expiredAt) {
          if (!entry.staleWhileRevalidate) {
            await this.evict(key);
            return null;
          }
          return { data: entry.data, stale: true };
        }
      } else if (age > this.defaultTTL) {
        if (!entry.staleWhileRevalidate) {
          await this.evict(key);
          return null;
        }
        return { data: entry.data, stale: true };
      }

      return { data: entry.data, stale: false };
    } catch {
      return null;
    }
  }

  async set<T>(
    key: string,
    data: T,
    options?: { ttlMs?: number; staleWhileRevalidate?: boolean }
  ): Promise<void> {
    try {
      const fullKey = `${this.storagePrefix}${key}`;
      const entry: CacheEntry<T> = {
        key,
        data,
        cachedAt: new Date().toISOString(),
        expiresAt: options?.ttlMs
          ? new Date(Date.now() + options.ttlMs).toISOString()
          : null,
        staleWhileRevalidate: options?.staleWhileRevalidate ?? false,
      };

      await secureStorage.setJSON(fullKey as never, entry);
    } catch {
      // Cache write failures are non-critical
    }
  }

  async evict(key: string): Promise<void> {
    try {
      const fullKey = `${this.storagePrefix}${key}`;
      await secureStorage.delete(fullKey as never);
    } catch {
      // Eviction failures are non-critical
    }
  }

  async evictByPrefix(prefix: string): Promise<void> {
    // Note: Full eviction by prefix requires iterating all keys.
    // In practice, we use well-known cache keys.
    // This is a placeholder for future indexedDB-based cache.
  }

  async clear(): Promise<void> {
    // SecureStore doesn't support listing keys.
    // For full clear, use the app's clear data function.
  }

  buildKey(...parts: string[]): string {
    return parts.join(":");
  }

  memberKey(memberId: string, type: string): string {
    return this.buildKey("member", memberId, type);
  }

  trainerKey(trainerId: string, type: string): string {
    return this.buildKey("trainer", trainerId, type);
  }

  organizationKey(orgId: string, type: string): string {
    return this.buildKey("org", orgId, type);
  }

  branchKey(branchId: string, type: string): string {
    return this.buildKey("branch", branchId, type);
  }
}

export const offlineCache = new OfflineCache();
export type { CacheEntry };
