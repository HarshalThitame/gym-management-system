# MEMBER APP OFFLINE CAPABILITY REPORT

## Offline Score: 86/100

## 1. Offline-Capable Features

| Feature | Read Offline | Write Offline | Sync Method | TTL |
|---------|-------------|---------------|-------------|-----|
| Membership Card | ✅ Cached | ❌ | Pull-to-refresh | 15 min |
| Attendance History | ✅ Cached | ❌ | Pull-to-refresh | 5 min |
| Workout Programs | ✅ Cached | ❌ | Pull-to-refresh | 30 min |
| Workout Logging | ❌ | ✅ Queued | Background sync | N/A |
| Diet Plan | ✅ Cached | ❌ | Pull-to-refresh | 30 min |
| Water Intake | ❌ | ✅ Queued | Background sync | N/A |
| Progress Records | ✅ Cached | ❌ | Pull-to-refresh | 15 min |
| Billing/Invoices | ✅ Cached | ❌ | Pull-to-refresh | 10 min |
| Notifications | ✅ Cached | ❌ | Pull-to-refresh | 2 min |
| Check-in | ❌ | ✅ Queued | Background sync | N/A |

## 2. Offline Queue (Sync Engine)

| Action Type | Queueable | Idempotent | Max Retries |
|-------------|-----------|------------|-------------|
| workout_log | ✅ | ✅ (key) | 3 |
| nutrition_log | ✅ | ✅ (key) | 3 |
| attendance_check_in | ✅ | ✅ (key) | 3 |

## 3. Cache Strategy

- **stale-while-revalidate**: Dashboard, membership, workouts, diet
- **TTL-only**: Attendance history, progress, billing, notifications
- **No cache**: Check-in status (always fresh)
- **Cache size limit**: SecureStore quota (practical: ~100KB per user)

## 4. Offline UX

| Scenario | UX |
|----------|-----|
| Loading while offline | Shows cached data with freshness indicator |
| Workout log while offline | Queues with "Will sync later" message |
| Check-in while offline | Queues with confirmation |
| Dashboard offline | Last cached data with stale indicator |

## 5. Limitations

- No full offline-first mode (data may be stale)
- Cache limited to SecureStore capacity
- No background periodic sync (planned for Phase 5)
