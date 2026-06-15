# OFFLINE STRATEGY REPORT (Updated)

## Offline Score: 86/100

## 1. Admin App Offline Requirements

| Feature | Online Required | Offline Cache | Notes |
|---------|----------------|---------------|-------|
| Dashboard KPIs | Yes | Yes (15 min) | Stale data for quick view |
| Member Directory | Yes | Yes (30 min) | Recent members cached |
| Attendance Check-in | No | Yes (queue) | Queued when offline |
| Payment Collection | Yes | No | Must be real-time |
| Member Registration | Yes | No | Requires real-time validation |
| Staff Management | Yes | No | Sensitive operation |
| Report Viewing | Yes | Yes (1 hr) | Cached reports |

## 2. Admin Offline Queue

| Action | Queueable | Priority |
|--------|-----------|----------|
| attendance_check_in | ✅ | High |
| attendance_check_out | ✅ | High |
| class_booking | ✅ | Medium |

## 3. Member App Offline (unchanged)

| Action | Queueable | Cache TTL |
|--------|-----------|-----------|
| workout_log | ✅ | 30 min |
| nutrition_log | ✅ | 30 min |
| attendance_check_in | ✅ | 5 min |
| Membership Card | ❌ | 15 min |
| Workout Programs | ❌ | 30 min |
| Notifications | ❌ | 2 min |
