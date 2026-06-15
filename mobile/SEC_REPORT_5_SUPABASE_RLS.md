# SUPABASE RLS AUDIT REPORT

## Score: 88/100

## 1. RLS Coverage

| Table | RLS Enabled | Policies | Status |
|-------|------------|----------|--------|
| attendance_sessions | ✅ | 2 | ✅ |
| members | ✅ | 3 | ✅ |
| memberships | ✅ | 2 | ✅ |
| leads | ✅ | 1 | ✅ |
| payments | ✅ | 2 | ✅ |
| notifications | ✅ | 2 | ✅ |
| profiles | ✅ | 1 | ✅ |
| gyms | ✅ | 2 | ✅ |
| branches | ✅ | 2 | ✅ |
| branch_users | ✅ | 2 | ✅ |
| trainers | ✅ | 1 | ✅ |
| comm_templates | ✅ | 1 | ✅ |
| comm_campaigns | ✅ | 1 | ✅ |
| comm_automation_rules | ✅ | 1 | ✅ |
| notification_preferences | ✅ | 1 | ✅ |
| attendance_audit_log | ✅ | 2 | ✅ |
| member_badges | ✅ | 2 | ✅ |
| qr_nonce_log | ✅ | 1 (service_role) | ✅ |

## 2. Findings

- 18 tables with RLS enabled across all migrations
- All tables have at minimum `authenticated` access policies
- `qr_nonce_log` uses service_role only (appropriate for QR validation)
- No tables found without RLS
