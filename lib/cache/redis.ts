type RedisDriver = "real" | "memory";

type RedisMessageHandler = (message: string) => void;

interface RedisLikeClient {
  driver: RedisDriver;
  connect(): Promise<void>;
  quit(): Promise<void>;
  get(key: string): Promise<string | null>;
  setEx(key: string, ttl: number, value: string): Promise<void>;
  del(keyOrKeys: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<number>;
  exists(key: string): Promise<number>;
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, handler: RedisMessageHandler): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  duplicate(): RedisLikeClient;
  on(event: "error" | "connect" | "reconnecting", handler: (err?: unknown) => void): void;
}

type RedisModule = {
  createClient: (options: {
    url: string;
    socket?: {
      reconnectStrategy?: (retries: number) => number | Error;
    };
  }) => RedisLikeClient;
};

type RedisStore = {
  values: Map<string, { value: string; expiresAt: number | null }>;
  subscribers: Map<string, Set<RedisMessageHandler>>;
};

const memoryStore: RedisStore = {
  values: new Map(),
  subscribers: new Map(),
};

let redisModuleCache: RedisModule | null | undefined;

function loadRedisModule(): RedisModule | null {
  if (redisModuleCache !== undefined) {
    return redisModuleCache;
  }

  try {
    const dynamicRequire = eval("require") as NodeRequire;
    redisModuleCache = dynamicRequire("redis") as RedisModule;
    return redisModuleCache;
  } catch {
    redisModuleCache = null;
    return null;
  }
}

function createMemoryRedisClient(): RedisLikeClient {
  const listeners = new Map<"error" | "connect" | "reconnecting", Set<(err?: unknown) => void>>();

  const getListeners = (event: "error" | "connect" | "reconnecting") => {
    let handlers = listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      listeners.set(event, handlers);
    }
    return handlers;
  };

  const isExpired = (entry: { value: string; expiresAt: number | null } | undefined) => {
    if (!entry) return true;
    if (entry.expiresAt === null) return false;
    if (entry.expiresAt > Date.now()) return false;
    return true;
  };

  const emit = (event: "error" | "connect" | "reconnecting", err?: unknown) => {
    for (const handler of getListeners(event)) {
      handler(err);
    }
  };

  const client: RedisLikeClient = {
    driver: "memory",
    async connect() {
      queueMicrotask(() => emit("connect"));
    },
    async quit() {
      return;
    },
    async get(key) {
      const entry = memoryStore.values.get(key);
      if (isExpired(entry)) {
        if (entry) memoryStore.values.delete(key);
        return null;
      }
      return entry.value;
    },
    async setEx(key, ttl, value) {
      memoryStore.values.set(key, {
        value,
        expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : Date.now(),
      });
    },
    async del(keyOrKeys) {
      const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
      let removed = 0;
      for (const key of keys) {
        removed += memoryStore.values.delete(key) ? 1 : 0;
      }
      return removed;
    },
    async keys(pattern) {
      const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      const regex = new RegExp(`^${escaped}$`);
      const matches: string[] = [];
      for (const [key, entry] of memoryStore.values.entries()) {
        if (isExpired(entry)) {
          memoryStore.values.delete(key);
          continue;
        }
        if (regex.test(key)) {
          matches.push(key);
        }
      }
      return matches;
    },
    async incr(key) {
      const existing = memoryStore.values.get(key);
      const current = Number.parseInt((await client.get(key)) ?? "0", 10);
      const next = Number.isFinite(current) ? current + 1 : 1;
      memoryStore.values.set(key, {
        value: String(next),
        expiresAt: existing?.expiresAt ?? null,
      });
      return next;
    },
    async expire(key, ttl) {
      const entry = memoryStore.values.get(key);
      if (isExpired(entry)) return 0;
      memoryStore.values.set(key, {
        value: entry!.value,
        expiresAt: Date.now() + ttl * 1000,
      });
      return 1;
    },
    async exists(key) {
      return (await client.get(key)) === null ? 0 : 1;
    },
    async publish(channel, message) {
      const subscribers = memoryStore.subscribers.get(channel);
      if (!subscribers || subscribers.size === 0) return 0;
      for (const handler of subscribers) {
        queueMicrotask(() => handler(message));
      }
      return subscribers.size;
    },
    async subscribe(channel, handler) {
      let subscribers = memoryStore.subscribers.get(channel);
      if (!subscribers) {
        subscribers = new Set();
        memoryStore.subscribers.set(channel, subscribers);
      }
      subscribers.add(handler);
    },
    async unsubscribe(channel) {
      memoryStore.subscribers.delete(channel);
    },
    duplicate() {
      return createMemoryRedisClient();
    },
    on(event, handler) {
      getListeners(event).add(handler);
    },
  };

  return client;
}

function createClient(options: Parameters<NonNullable<RedisModule["createClient"]>>[0]): RedisLikeClient {
  const redisModule = loadRedisModule();
  if (redisModule) {
    return redisModule.createClient(options);
  }

  return createMemoryRedisClient();
}

export function createRedisClientFromUrl(redisUrl: string): RedisLikeClient {
  return createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          return new Error("Max reconnection attempts reached");
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });
}

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

  redisClient = createRedisClientFromUrl(redisUrl);

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
