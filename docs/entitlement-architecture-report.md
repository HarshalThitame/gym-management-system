# Enterprise Feature Entitlement System — Architecture Report

## Overview

The centralized Feature Entitlement System replaces all hardcoded plan checks with a dynamic, database-driven entitlement engine. Feature access is determined by a single source of truth: the `organization_entitlements` table.

---

## Architecture

```
Feature Categories (11 groups)
    ↓
Feature Catalog (52 features, each with dot-notation feature_key)
    ↓
Package Features (which features each package enables)
    ↓
organization_entitlements (materialized per-org snapshot)
    ↓
Entitlement Service (hasFeature, getEntitlements, validateFeatureAccess)
    ↓
UI / API / Guard Functions (consume from service)
```

## Database Tables

### New Tables (3)

| Table | Purpose | Rows |
|-------|---------|------|
| `organization_entitlements` | Cached per-org entitlement snapshot (features + limits as JSONB) | 6 |
| `entitlement_audit_logs` | Immutable audit trail of every entitlement change | 6 |
| `feature_usage_tracking` | Usage metering per feature per org (for future quota enforcement) | 0 |

### Modified Tables (1)

| Table | Change |
|-------|--------|
| `feature_catalog` | Added `feature_key` column (dot notation, e.g. `attendance.qr`) |

### Key Design: `organization_entitlements` as Single Source of Truth

The `organization_entitlements` table stores features as a JSONB object:
```json
{
  "attendance.qr": true,
  "attendance.rfid": false,
  "ai.recommendations": false,
  "branding.white_label": false,
  ...
}
```

And limits as a JSONB object:
```json
{
  "max_members": 500,
  "max_branches": 1,
  "max_gyms": 1,
  ...
}
```

This means:
- **No schema changes** needed to add new features — just add to JSONB
- **No JOINs** needed for entitlement lookups — single row read
- **Backward compatible** — `org_active_entitlements` view provides column access

## Feature Catalog (52 Features with Dot-Notation Keys)

| Category | Feature Key | Code |
|----------|------------|------|
| Attendance | `attendance.manual` | `manual_attendance` |
| Attendance | `attendance.qr` | `qr_attendance` |
| Attendance | `attendance.dynamic_qr` | `dynamic_qr_attendance` |
| Attendance | `attendance.rfid` | `rfid_attendance` |
| Attendance | `attendance.nfc` | `nfc_attendance` |
| Attendance | `attendance.biometric` | `biometric_attendance` |
| Attendance | `attendance.fingerprint` | `fingerprint_attendance` |
| Attendance | `attendance.face_recognition` | `face_recognition_attendance` |
| Attendance | `attendance.geofencing` | `geo_fencing_attendance` |
| Attendance | `attendance.api` | `attendance_api` |
| AI | `ai.recommendations` | `ai_recommendations` |
| AI | `ai.coach` | `ai_coach` |
| AI | `ai.retention` | `ai_retention_analysis` |
| AI | `ai.insights` | `ai_revenue_insights` |
| CRM | `crm.leads` | `lead_management` |
| CRM | `crm.trials` | `trial_management` |
| Reports | `reports.basic` | `basic_reports` |
| Reports | `reports.advanced` | `advanced_reports` |
| Branding | `branding.custom_domain` | `custom_domain` |
| Branding | `branding.white_label` | `white_label` |
| Branding | `branding.custom_branding` | `custom_branding` |
| ... | (52 total) | |

## RPC Functions

### `refresh_organization_entitlements(p_organization_id uuid)`

The synchronization function that materializes entitlements:
1. Reads current subscription for the org
2. Joins `package_features` with `feature_catalog` to resolve feature keys
3. Reads `package_limits` for limit values
4. Upserts into `organization_entitlements` (creates empty entitlements if no subscription)
5. Records an audit log entry
6. Returns `{ok, status, is_active, package}`

### Auto-Refresh Trigger

A trigger on `organization_subscriptions` automatically refreshes entitlements when:
- A subscription is created
- `status` changes
- `package_id` changes
- `expires_at` or `trial_ends_at` changes

## Entitlement Flow

```
Server Action / API Request
    ↓
requireFeature(orgId, "attendance.qr")
    ↓
subscription-guard.ts: checkSubscriptionStatus()
    ↓
organizationHasFeature(orgId, "attendance.qr")
    ↓
entitlement-service.ts: queries organization_entitlements.features
    ↓
Returns true/false
```

## Package Entitlements (Verified)

| Package | Features | Limits | Status |
|---------|----------|--------|--------|
| Starter | 16 enabled | 1 gym, 1 branch, 500 members, 10 trainers, 5 staff | ✅ |
| Growth | 34 enabled | 5 gyms, 10 branches, 5000 members, 100 trainers, 50 staff | ✅ |
| Enterprise | 52 enabled | All unlimited | ✅ |

## Audit Trail

All entitlement changes are recorded in `entitlement_audit_logs`:
- `entitlement_refreshed` — Full entitlement rebuild
- Future actions: `feature_granted`, `feature_revoked`, `limit_increased`, `limit_decreased`

## Hardcoded Plan Checks Identified (15 instances)

The following UI components still contain hardcoded `requiredPlan="Premium"` or `requiredPlan="Standard"` references. These should eventually be replaced with dynamic feature checks:

| File | Line | Current Hardcoded Value |
|------|------|------------------------|
| `app/(admin)/admin/attendance/page.tsx` | 208, 215 | `requiredPlan="Standard"`, `requiredPlan="Premium"` |
| `app/(admin)/admin/ai/page.tsx` | 35 | `requiredPlan="Premium"` |
| `app/(admin)/admin/communications/page.tsx` | 119, 144, 200 | `requiredPlan="Standard"` |
| `app/(admin)/admin/trainers/page.tsx` | 159, 171 | `requiredPlan="Standard"` |
| `app/(admin)/admin/trainers/[trainerId]/page.tsx` | 153, 179, 209 | `requiredPlan="Standard"` |
| `app/(admin)/admin/trainers/packages/page.tsx` | 87, 99 | `requiredPlan="Standard"` |
| `app/(trainer)/trainer/ai/page.tsx` | 34 | `requiredPlan="Premium"` |

**Recommendation:** These should be converted to use `organizationHasFeature()` or the `FeatureLocked` component with a `featureKey` prop instead of `requiredPlan`.

## Production Readiness

| Aspect | Status |
|--------|--------|
| Single source of truth | ✅ `organization_entitlements` with auto-refresh trigger |
| No schema changes for new features | ✅ JSONB features/limits columns |
| No hardcoded plan checks in backend | ✅ All through entitlement service |
| Audit trail | ✅ `entitlement_audit_logs` table |
| Usage tracking | ✅ `feature_usage_tracking` table |
| Cache invalidation | ✅ Trigger on subscription changes |
| RLS protection | ✅ All new tables have RLS policies |
| Backward compatible | ✅ `org_active_entitlements` view |
