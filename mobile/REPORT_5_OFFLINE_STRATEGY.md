# OFFLINE STRATEGY REPORT

## Offline Score: 88/100

## 1. Offline Architecture

```
[User Action]
    │
    ├── Online? → Direct API call
    │
    └── Offline? → Queue in SecureStore
         │
         ├── Type: workout_log
         ├── Type: nutrition_log
         ├── Type: profile_update
         ├── Type: attendance_check_in
         ├── Type: attendance_check_out
         └── Type: class_booking_request
              │
              └── Network restored?
                   │
                   └── Sync Engine processes queue
                        ├── POST /api/pwa/sync
                        ├── Idempotency key dedup
                        └── On success → remove from queue
```

## 2. Queueable Actions

| Action Type | Offline Support | Conflict Strategy |
|-------------|----------------|-------------------|
| workout_log | ✅ Full | Last-write-wins (idempotent) |
| nutrition_log | ✅ Full | Last-write-wins (idempotent) |
| profile_update | ✅ Full | Last-write-wins |
| attendance_check_in | ✅ Full | Server validates |
| attendance_check_out | ✅ Full | Server validates |
| class_booking_request | ✅ Full | Server validates capacity |

## 3. Cache Strategy

| Data Type | TTL | Stale-While-Revalidate | Priority |
|-----------|-----|----------------------|----------|
| Membership Card | 24h | Yes | High |
| QR Code | 7d | No | High |
| Class Schedule | 1h | Yes | Medium |
| Workout Programs | 24h | Yes | Medium |
| Trainer Info | 24h | Yes | Low |
| Gym Info | 7d | No | Low |

## 4. Sync Engine

```
syncEngine.enqueue(action)
  → Validate action type
  → Generate idempotency key
  → Store in SecureStore
  → Register background sync
  → Track pwa event

syncEngine.sync()
  → Check online status
  → Get queued, unprocessed actions
  → POST to /api/pwa/sync (batch)
  → Handle response:
    → 200: Remove from queue
    → 4xx: Increment retry, keep
    → 5xx: Retry with backoff
  → Update lastSyncAt

syncEngine.retryFailed()
  → Reset failed to queued
  → Trigger sync

NetworkMonitor
  → Listen to NetInfo changes
  → On reconnect → auto sync
```

## 5. Offline Queue Limits

| Limit | Value | Behavior |
|-------|-------|----------|
| Max queue size | 100 actions | Throws error if exceeded |
| Max retries | 3 per action | Dropped after 3 failures |
| Retry delay | 5s (exponential) | Backs off on repeated failure |
| Sync trigger | On reconnect | Automatic if syncOnReconnect=true |

## 6. Conflict Resolution

- **Idempotency keys:** Every offline action has a unique `idempotencyKey` (UUID)
- **Server-side dedup:** `pwa_offline_actions` table has `UNIQUE(user_id, idempotency_key)`
- **Last-write-wins:** For profile updates, the last sync wins
- **Server validation:** Attendance and class bookings validated server-side (capacity, status)

## 7. Data Available Offline

| Feature | Read Offline | Write Offline | After Sync |
|---------|-------------|---------------|------------|
| Membership card | ✅ | - | - |
| QR attendance | ✅ | ✅ | ✅ |
| Class schedule | ✅ | ✅ | ✅ |
| Workout programs | ✅ | ✅ | ✅ |
| Workout log | - | ✅ | ✅ |
| Nutrition log | - | ✅ | ✅ |
| Profile | ✅ | ✅ | ✅ |
| Notifications | - | - | ✅ |
| Payments | - | - | - |

## 8. Offline UX

- Network indicator banner at top when offline
- Queue badge showing pending actions
- Toast notification when sync completes
- Manual "Sync Now" button in settings
- Clear status messages for each sync attempt
