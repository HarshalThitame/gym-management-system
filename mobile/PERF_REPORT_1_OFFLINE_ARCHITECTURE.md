# OFFLINE ARCHITECTURE REPORT

## Score: 91/100

## 1. Complete Offline Stack

```
┌─────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                     │
├─────────────────────────────────────────────────────────┤
│  Member App │ Admin App │ Shared Components             │
├─────────────────────────────────────────────────────────┤
│              OFFLINE ABSTRACTION LAYER                   │
├─────────────────────────────────────────────────────────┤
│  offlineCache (TTL + stale-while-revalidate)            │
│  syncEngine (queue + batch/partial/full/recovery)        │
│  conflictResolver (4 strategies)                        │
│  backgroundSync (15-min interval)                        │
│  errorRecovery (5 categories)                           │
│  networkMonitor (auto-detect + reconnect)               │
│  imageOptimizer (resize + compress)                     │
├─────────────────────────────────────────────────────────┤
│                    STORAGE LAYER                         │
├─────────────────────────────────────────────────────────┤
│  SecureStore (tokens, session, queue, small cache)      │
│  FileSystem (images, cached files)                      │
│  IndexedDB (PWA fallback)                               │
└─────────────────────────────────────────────────────────┘
```

## 2. Queueable Actions (15 types)

| # | Action Type | Priority | Max Retries | Conflict Strategy |
|---|-------------|----------|-------------|-------------------|
| 1 | attendance_check_in | HIGH | 3 | last_write_wins |
| 2 | attendance_check_out | HIGH | 3 | last_write_wins |
| 3 | member_registration | HIGH | 3 | server_wins |
| 4 | billing_request | HIGH | 3 | server_wins |
| 5 | lead_creation | NORMAL | 3 | server_wins |
| 6 | lead_update | NORMAL | 3 | last_write_wins |
| 7 | lead_note | NORMAL | 3 | timestamp_merge |
| 8 | follow_up_complete | NORMAL | 3 | last_write_wins |
| 9 | task_complete | NORMAL | 3 | last_write_wins |
| 10 | trial_update | NORMAL | 3 | last_write_wins |
| 11 | notification_read | NORMAL | 2 | last_write_wins |
| 12 | workout_log | LOW | 3 | last_write_wins |
| 13 | nutrition_log | LOW | 3 | last_write_wins |
| 14 | profile_update | LOW | 3 | client_wins |
| 15 | class_booking_request | LOW | 3 | server_wins |

## 3. Sync Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| FULL | Process all queued actions | On app foreground, manual sync |
| PARTIAL | Process only HIGH priority | Quick sync on each enqueue |
| BATCH | Process up to 25 actions | Background fetch interval |
| RECOVERY | Retry all failed actions | After network restore |

## 4. Offline-First Read Strategy

```
Read Request
  ↓
Check Offline Cache → HIT → Return Cached Data
  ↓ MISS
Fetch from Network
  ↓ Success? → Cache data → Return
  ↓ Fail?
Is stale data available? → YES → Return stale + mark stale
  ↓ NO
Show Offline State → Retry button
```
