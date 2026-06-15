# Attendance Processing Engine — Report

## Core Engine

**`features/attendance/services/attendance-engine.ts`**

| Function | Purpose |
|----------|---------|
| `processAttendance()` | Core engine — handles all device types, session tracking, duplicate prevention |
| `processQRAttendance()` | QR-specific validation (static, dynamic, rotating, expiry) |
| `processCardAttendance()` | RFID/NFC card validation (card-member assignment check) |
| `getActiveSession()` | Finds current active session per member (prevents double check-in) |
| `checkDuplicate()` | 1-minute window duplicate detection by member + device |
| `processSyncQueue()` | Offline device sync — processes queued events with retry |

## Key Features

| Feature | Implementation |
|---------|---------------|
| **Duplicate prevention** | 1-minute window per member+device combination |
| **Session tracking** | Tracks check-in → check-out pairs with method metadata |
| **QR anti-sharing** | Dynamic QR expiry validation, rotating QR support |
| **RFID/NFC validation** | Card-member assignment verification before check-in |
| **Offline sync** | Queue-based with status tracking (pending → synced/failed) |
| **Unified logging** | All events stored in `attendance_events` with device type metadata |

## Device Support Matrix

| Device | Engine Path | Status |
|--------|-----------|--------|
| QR Scanner | `processQRAttendance()` → `processAttendance()` | ✅ |
| Dynamic QR | `processQRAttendance(isDynamic=true)` | ✅ |
| RFID Reader | `processCardAttendance(cardType='rfid')` | ✅ |
| NFC Reader | `processCardAttendance(cardType='nfc')` | ✅ |
| Biometric | `processAttendance(eventType='biometric')` | ✅ |
| Face Recognition | `processAttendance(eventType='face')` | ✅ |
| Geo-Fence | `processAttendance(eventType='geofence')` | ✅ |

## Verdict: **PASS** ✅
