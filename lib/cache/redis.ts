import { createClient } from 'redis';

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Get or create Redis client instance
 */
export function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('[Cache] REDIS_URL not configured, caching disabled');
    return null;
  }

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Cache] Max reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on('error', (err) => {
    console.error('[Cache] Redis error:', err);
  });

  redisClient.on('connect', () => {
    console.log('[Cache] Redis connected');
  });

  redisClient.on('reconnecting', () => {
    console.log('[Cache] Redis reconnecting');
  });

  // Connect asynchronously
  redisClient.connect().catch((err) => {
    console.error('[Cache] Failed to connect to Redis:', err);
  });

  return redisClient;
}

/**
 * Cache wrapper with automatic serialization
 */
export class CacheService {
  private prefix: string;
  private defaultTTL: number;

  constructor(prefix: string = 'gym', defaultTTL: number = 3600) {
    this.prefix = prefix;
    this.defaultTTL = defaultTTL;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const value = await client.get(this.getKey(key));
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      console.error(`[Cache] Failed to get key ${key}:`, err);
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl ?? this.defaultTTL;
      await client.setEx(this.getKey(key), expiry, serialized);
      return true;
    } catch (err) {
      console.error(`[Cache] Failed to set key ${key}:`, err);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.del(this.getKey(key));
      return true;
    } catch (err) {
      console.error(`[Cache] Failed to delete key ${key}:`, err);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delPattern(pattern: string): Promise<number> {
    const client = getRedisClient();
    if (!client) return 0;

    try {
      const fullPattern = `${this.prefix}:${pattern}`;
      const keys = await client.keys(fullPattern);
      if (keys.length === 0) return 0;
      
      await client.del(keys);
      return keys.length;
    } catch (err) {
      console.error(`[Cache] Failed to delete pattern ${pattern}:`, err);
      return 0;
    }
  }

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Increment counter
   */
  async incr(key: string, ttl?: number): Promise<number | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const fullKey = this.getKey(key);
      const value = await client.incr(fullKey);
      
      if (ttl && value === 1) {
        await client.expire(fullKey, ttl);
      }
      
      return value;
    } catch (err) {
      console.error(`[Cache] Failed to increment key ${key}:`, err);
      return null;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const result = await client.exists(this.getKey(key));
      return result > 0;
    } catch (err) {
      console.error(`[Cache] Failed to check existence of key ${key}:`, err);
      return false;
    }
  }

  /**
   * Set with expiration timestamp
   */
  async setAt<T>(key: string, value: T, expireAt: Date): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const serialized = JSON.stringify(value);
      const ttl = Math.max(0, Math.floor((expireAt.getTime() - Date.now()) / 1000));
      await client.setEx(this.getKey(key), ttl, serialized);
      return true;
    } catch (err) {
      console.error(`[Cache] Failed to set key ${key} with expiration:`, err);
      return false;
    }
  }
}

// Pre-configured cache instances
export const memberCache = new CacheService('member', 1800); // 30 minutes
export const membershipCache = new CacheService('membership', 3600); // 1 hour
export const attendanceCache = new CacheService('attendance', 300); // 5 minutes
export const paymentCache = new CacheService('payment', 7200); // 2 hours
export const reportCache = new CacheService('report', 86400); // 24 hours
export const sessionCache = new CacheService('session', 1800); // 30 minutes
