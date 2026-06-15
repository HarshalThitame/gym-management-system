# OFFLINE CACHE MIGRATION STRATEGY

## Current State: SecureStore
- **Storage limit**: ~KB per entry, ~MB total
- **Access**: Async key-value via `expo-secure-store`
- **Use case**: Auth tokens, small cache entries (< 10KB each)
- **Limitation**: Cannot store large data (programs with exercise media, progress photos base64, etc.)

## Target: expo-sqlite
- **Storage limit**: Unlimited (device storage)
- **Access**: Synchronous SQL queries with indexing
- **Use case**: Full offline cache, draft storage, queue persistence
- **Benefits**: Structured queries, TTL cleanup, JOINs for related data

## Migration Plan

### Phase 1: Dual Storage (Current → Next Sprint)
- Keep SecureStore for: auth tokens, session data, user profile
- Add SQLite for: workout programs, diet plans, attendance history, notifications, billing
- Migration script: On first launch, copy existing SecureStore cache entries to SQLite

### Phase 2: SQLite Primary (After Testing)
- Move all cache to SQLite with schema:
  ```sql
  CREATE TABLE cache_entries (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    cached_at INTEGER NOT NULL,
    expires_at INTEGER,
    stale_while_revalidate INTEGER DEFAULT 0
  );
  CREATE TABLE offline_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'queued',
    retry_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  ```
- SecureStore remains for: auth tokens, biometric keys, device tokens

### Phase 3: Offline-First (Future)
- Full offline data layer with background sync
- Indexed queries for member directory search
- Media caching (exercise videos, progress photos)
- Cache eviction policy: LRU + TTL

## Migration Code (Phase 1)

```typescript
import * as SQLite from "expo-sqlite";
import { secureStorage, STORAGE_KEYS } from "@/storage/secure";

const DB_NAME = "apex-offline-cache.db";

export async function initializeOfflineDatabase() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      expires_at INTEGER,
      stale_while_revalidate INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'queued',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON offline_queue(status);
  `);

  return db;
}
```

## Rollback Plan
- Keep SecureStore as fallback for 2 releases
- Feature flag: `offline_cache_sqlite` default off → on after QA
- If SQLite corruption detected, fall back to SecureStore
