import * as SQLite from "expo-sqlite";

const DB_NAME = "apex-offline.db";

let db: SQLite.SQLiteDatabase | null = null;

export async function getOfflineDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      expires_at INTEGER,
      stale_while_revalidate INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'queued',
      retry_count INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'normal',
      last_error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      local_data TEXT NOT NULL,
      server_data TEXT NOT NULL,
      resolved_data TEXT,
      strategy TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON offline_queue(status, priority);
    CREATE INDEX IF NOT EXISTS idx_conflicts_status ON sync_conflicts(status);
  `);

  return db;
}

export async function cacheGet<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  try {
    const database = await getOfflineDatabase();
    const row = await database.getFirstAsync<{ value: string; cached_at: number; expires_at: number | null; stale_while_revalidate: number }>(
      "SELECT value, cached_at, expires_at, stale_while_revalidate FROM cache_entries WHERE key = ?", key
    );
    if (!row) return null;

    const now = Date.now();
    const age = now - row.cached_at;

    if (row.expires_at && now > row.expires_at) {
      if (!row.stale_while_revalidate) {
        await database.runAsync("DELETE FROM cache_entries WHERE key = ?", key);
        return null;
      }
      return { data: JSON.parse(row.value) as T, stale: true };
    }

    return { data: JSON.parse(row.value) as T, stale: false };
  } catch { return null; }
}

export async function cacheSet<T>(key: string, data: T, ttlMs?: number, staleWhileRevalidate = false): Promise<void> {
  try {
    const database = await getOfflineDatabase();
    const now = Date.now();
    await database.runAsync(
      `INSERT OR REPLACE INTO cache_entries (key, value, cached_at, expires_at, stale_while_revalidate)
       VALUES (?, ?, ?, ?, ?)`,
      [key, JSON.stringify(data), now, ttlMs ? now + ttlMs : null, staleWhileRevalidate ? 1 : 0]
    );
  } catch {}
}

export async function cacheEvict(key: string): Promise<void> {
  try { const database = await getOfflineDatabase(); await database.runAsync("DELETE FROM cache_entries WHERE key = ?", key); } catch {}
}

export async function cacheClear(): Promise<void> {
  try { const database = await getOfflineDatabase(); await database.runAsync("DELETE FROM cache_entries"); } catch {}
}

export async function cacheEvictExpired(): Promise<number> {
  try {
    const database = await getOfflineDatabase();
    const { changes } = await database.runAsync("DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < ?", Date.now());
    return changes ?? 0;
  } catch { return 0; }
}

export async function getCacheSize(): Promise<{ entries: number; estimatedBytes: number }> {
  try {
    const database = await getOfflineDatabase();
    const count = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM cache_entries");
    const size = await database.getFirstAsync<{ total: number }>("SELECT SUM(LENGTH(value)) as total FROM cache_entries");
    return { entries: count?.count ?? 0, estimatedBytes: size?.total ?? 0 };
  } catch { return { entries: 0, estimatedBytes: 0 }; }
}
