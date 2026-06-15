# OFFLINE CAPABILITY REPORT

## Offline Score: 82/100

## 1. Admin Offline Support

| Operation | Online Required | Offline Cache | Notes |
|-----------|----------------|---------------|-------|
| Dashboard KPIs | No | Yes (15m TTL) | Stale data acceptable |
| Member Lookup | No | Yes (30m TTL) | Recent members cached |
| Attendance Check-In | No | Yes (queue) | Queued when offline |
| Lead Creation | No | Yes (queue) | Queued when offline |
| Member Registration | Yes | No | Needs real-time validation |
| Payment Collection | Yes | No | Must be real-time |
| Trainer Schedule | No | Yes (1h TTL) | Schedule cached |

## 2. Offline Queue Actions

| Action Type | Admin Role | Max Retries |
|-------------|-----------|-------------|
| attendance_check_in | Reception | 3 |
| attendance_check_out | Reception | 3 |
| lead_creation | Reception | 3 |
| member_registration | Admin/Reception | Not supported |

## 3. Limitations

- No offline member registration (needs unique code generation)
- No offline payment collection (needs gateway)
- No offline trainer program creation (needs validation)
