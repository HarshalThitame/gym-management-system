# Phase 2 Completion Plan: Attendance Premium Features

## Summary
Finish Phase 2 by closing the remaining premium gaps in a pragmatic order: dynamic QR, attendance analytics APIs, batch/class attendance APIs, and attendance automation APIs. Keep the current `attendance_sessions` model and existing automation/integration stack, and add roadmap-compatible interfaces on top of it.

Assumptions:
- keep `MSG91` as the active SMS/WhatsApp provider
- do not start Phase 3 hardware or geo-fence work
- treat existing class booking/attendance as the base for batch attendance instead of introducing a second parallel attendance system

## Implementation Changes

### 1. Dynamic QR
- Add `POST /api/v1/qr/dynamic/[memberId]` on top of `qr_tokens`.
- Generate short-lived tokens with 12 second expiry, a 10 second refresh hint, and one-time-use semantics.
- Keep the current static QR flow unchanged for Phase 1 compatibility.
- Update validation so dynamic tokens fail cleanly for `expired`, `used`, `invalid`, and `wrong_gym` cases.
- Add a member-facing rotating QR display with countdown and auto-refresh.

### 2. Analytics APIs
- Add `GET /api/v1/analytics/attendance`.
- Add `GET /api/v1/analytics/churn-risk`.
- Add `GET /api/v1/analytics/member-insights/[memberId]`.
- Use existing sources of truth: `attendance_sessions`, `attendance_analytics`, `occupancy_log`, and `streaks`.
- Return attendance totals, active/inactive split, trend direction, churn risk, and member engagement metrics.

### 3. Batch Attendance
- Add `POST /api/v1/attendance/batch-checkin`.
- Add `POST /api/v1/attendance/batch-checkout`.
- Reuse the current attendance service so duplicate prevention, alerts, logging, and realtime behavior stay consistent.
- Support `sessionType`, `sessionName`, `memberIds`, and `branchId`.
- Return per-member failures instead of aborting the whole request on the first bad record.

### 4. Automation APIs
- Add `GET /api/v1/automation/config`.
- Add `POST /api/v1/automation/send-alert`.
- Keep the current `MSG91` provider stack and adapt it to attendance alert use cases.
- Support at minimum `streak_alert` and `churn_warning` over `sms` and `whatsapp`.
- Log every send attempt in the automation logs.

### 5. Occupancy and Dashboard Parity
- Extend the existing occupancy and analytics responses to cover the premium roadmap use cases.
- Keep the current admin attendance dashboard working and surface derived heatmap-friendly data through the analytics layer.

## Public APIs
- `POST /api/v1/qr/dynamic/[memberId]`
- `GET /api/v1/analytics/attendance`
- `GET /api/v1/analytics/churn-risk`
- `GET /api/v1/analytics/member-insights/[memberId]`
- `POST /api/v1/attendance/batch-checkin`
- `POST /api/v1/attendance/batch-checkout`
- `GET /api/v1/automation/config`
- `POST /api/v1/automation/send-alert`

## Test Plan
- Unit tests for dynamic QR generation and expiry.
- Unit tests for analytics calculations and member insight shaping.
- Route tests for batch check-in, batch checkout, and automation endpoints.
- Route tests for org/gym scoping and invalid payload handling.
- Integration checks to confirm the existing attendance flows still work unchanged.

## Acceptance Criteria
- Dynamic QR rotates and expires as expected.
- Analytics routes return useful premium attendance data.
- Batch attendance APIs work with partial failures and preserve the existing attendance rules.
- Attendance alerts can be sent through the current provider stack and are logged.
- Phase 1 routes continue to work without regressions.

## Current Kiosk State

The kiosk work is adjacent to Phase 2, but the current repo state is:

| Area | Status | Notes |
|---|---|---|
| Device-auth check-in/out APIs | Done | Existing device check-in/out routes are in place. |
| Member-to-device mapping CRUD | Done | Mapping routes and device management UI exist. |
| Dedicated kiosk UI | Done | The reception kiosk screen and terminal are implemented. |
| Local offline replay queue | Done | Kiosk failures queue locally and retry on reconnect. |
| PWA sync allowlist for kiosk endpoints | Done | `/api/pwa/sync` accepts kiosk attendance endpoints. |
| Real NFC/RFID reader integration | Partial | Browser-side keyboard-wedge and Web NFC capture are implemented, but no vendor SDK/native hardware stack is present. |
| Kiosk provisioning lifecycle | Missing | No full register, activate, rotate, revoke flow for readers. |
| Device health monitoring and alerting | Partial | `last_seen_at` and `status` exist, but not a full health/alert system. |
| Offline conflict resolution | Partial | Basic replay exists, but no robust conflict policy for duplicate/stale scans. |
| Branch/zone policy engine | Partial | Branch scoping exists, but not a full kiosk policy layer. |
| Geo-fence auto-checkout | Missing | Still not implemented. |
| Enterprise kiosk ops dashboard | Partial | Admin/device panel exists, but not a full kiosk operations console. |

Bottom line: kiosk reader capture is now usable in a browser-based enterprise flow, but it is not a fully enterprise-complete hardware product yet.
