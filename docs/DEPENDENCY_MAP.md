# Gym-to-Branch Migration — Dependency Map

## CURRENT HIERARCHY
```
Super Admin → Organization → Gym → Branch → Users/Members/Trainers/Staff
```

## TARGET HIERARCHY
```
Super Admin → Organization → Branch/Location → Users/Members/Trainers/Staff
```

---

## 1. DATABASE TABLES WITH `gym_id`

### Critical Tables (operational data)
| Table | gym_id | branch_id | organization_id | Notes |
|---|---|---|---|---|
| `gyms` | PK | - | ✓ | To be deprecated |
| `branches` | ✓ (nullable) | PK | ✓ | Already has org_id — key migration target |
| `profiles` | ✓ | - | - | RLS scoped by gym_id |
| `members` | ✓ | ✓ | - | Has both |
| `membership_plans` | ✓ | - | - | Scoped by gym |
| `memberships` | ✓ | - | - | Scoped by gym |
| `trainers` | ✓ | - | - | Scoped by gym |
| `trainer_assignments` | ✓ | - | - | Scoped by gym |
| `payments` | ✓ | ✓ | - | Has both |
| `invoices` | ✓ | ✓ | - | Has both |
| `attendance_sessions` | ✓ | ✓ | - | Has both |
| `classes` | ✓ | - | - | Scoped by gym |

### Financial Tables (gym_id required NOT NULL)
| Table | gym_id constraint |
|---|---|
| `credit_notes` | NOT NULL |
| `write_offs` | NOT NULL |
| `disputes` | NOT NULL |
| `reconciliation` | NOT NULL |
| `revenue_recognition` | NOT NULL |
| `financial_periods` | NOT NULL |

### AI Tables
| Table | gym_id | branch_id |
|---|---|---|
| `ai_fitness_profiles` | ✓ | ✓ |
| `ai_recommendations` | ✓ | - |
| `ai_chat_sessions` | ✓ | - |
| `ai_observability_logs` | ✓ | ✓ |

### All Other Tables (80+ total)
Membership, fitness, classes, communications, analytics, support, enterprise — all use `gym_id` for scoping.

---

## 2. RLS HELPER FUNCTIONS

Key PostgreSQL functions that use `gym_id`:
- `public.current_user_gym_id()` — returns gym_id from user's profile
- `public.can_access_gym(gym_id)` — checks if user can access a gym
- `public.can_operate_gym(gym_id)` — checks if user can operate in a gym
- `public.can_manage_gym(gym_id)` — checks if user can manage a gym
- `public.is_trainer_for_member(member_id)` — trainer visibility
- `public.is_trainer_for_class_session(session_id)` — trainer class visibility

These are referenced in ~200+ RLS policies across all data tables.

---

## 3. CODE FILE REFERENCES BY LAYER

### 3a. Database Types (`types/database.ts`)
- `gyms` table type defined
- `branches` type has `gym_id: string | null`
- Many table types reference `gym_id`

### 3b. Auth Types (`types/auth.ts`)
- `AuthProfile` has `gym_id: string | null`
- `AuthContext` passes profile with gym_id

### 3c. Enterprise Types (`types/enterprise.ts`)
- `GymRow` type exported
- Organization dashboard includes `gyms: GymRow[]`

### 3d. Server Actions
| File | Key Functions | gym references |
|---|---|---|
| `features/super-admin/actions/gym-branch-actions.ts` | createGym, createBranch, transferAdmin, lifecycle, move | 72 refs |
| `features/super-admin/actions/organization-actions.ts` | org CRUD, lifecycle | 2 refs |
| `features/super-admin/actions/subscription-enterprise-actions.ts` | upgrade/downgrade plans | 4 refs (gym limit checks) |
| `features/organization-owner/actions/gym-actions.ts` | create/update/status gym | 70+ refs |
| `features/organization-owner/actions/branch-actions.ts` | create/update branch under gym | 7 refs |
| `features/attendance/actions/attendance-actions.ts` | check-in/out | 34 refs |
| `features/memberships/actions/membership-actions.ts` | create/update memberships | 52 refs |

### 3e. Services
| File | Key Functions | gym references |
|---|---|---|
| `features/super-admin/services/gym-branch-management-service.ts` | GymBranchManagement data | 34 refs |
| `features/super-admin/services/organization-management-service.ts` | Org management data | 38 refs |
| `features/super-admin/services/subscription-usage-service.ts` | getBranchCount() counts GYMS not branches! | 2 refs (BUG) |
| `features/organization-owner/services/organization-owner-service.ts` | Dashboard data via gymIds | heavy gym querying |
| `features/organization-owner/services/module-data-resolver.ts` | Module data via gymIds | gym-based filtering |
| `lib/tenant/context.ts` | TenantContext has gymId | gym resolution |
| `lib/tenant/access.ts` | Tenant access check | gymId comparison |

### 3f. UI Components
| File | Component | gym references |
|---|---|---|
| `features/super-admin/components/gyms/GymBranchManagementWorkspace.tsx` | Super Admin gym/branch UI | 23 refs |
| `features/organization-owner/components/modules/GymsModule.tsx` | Org Owner "Gyms" module | exhaustive gym CRUD |
| `features/organization-owner/components/gym-detail-panel.tsx` | Gym detail slideover | 20+ refs |
| `features/organization-owner/components/org-owner-dashboard-charts.tsx` | Dashboard charts | 1 ref |

### 3g. Navigation Modules
| File | Entry | label |
|---|---|---|
| `features/super-admin/lib/super-admin-modules.tsx` | Module: "gyms" | "Gyms" |
| `features/organization-owner/lib/organization-owner-modules.tsx` | Module: "gyms" | "Gyms" |

### 3h. App Pages
| Route | File | gym usage |
|---|---|---|
| `/super-admin/gyms` | Module workspace | Super Admin gym CRUD |
| `/organization/gyms` | GymsModule | Org Owner gym CRUD |
| `/api/super-admin/gyms/export` | Route | Gym data export |

---

## 4. PACKAGE / SUBSCRIPTION / LIMIT SYSTEM

### Packages Table Fields
- `max_members` ✓ already exists
- `max_branches` ✓ already exists (currently unused correctly)
- No `max_gyms` in table schema (but in package editor UI as `maxGyms`)

### Usage Limit System
- `getOrgUsage()` reads `max_branches` and `max_gyms` from `package_limits`
- `getBranchCount()` **BUG**: queries `gyms` table instead of `branches`
- Gym creation checks `max_gyms` limit
- Branch creation checks `max_branches` limit
- `OrgUsage` type has `gymLimit?: number` — should be removed

---

## 5. PACKAGE EDITOR UI (package-management-client.tsx)
- Shows "Max Gyms" input field (line 207-209)
- Shows "Max Branches" input field (line 203-205)
- `savePackageAction` schema includes `maxGyms` field
- Packages table INSERT includes `max_gyms` column

---

## 6. MIGRATION BLOCKERS

### Immediate Blockers
1. `getBranchCount()` queries `gyms` table — must query `branches` instead
2. Org Owner can create "Gyms" separately from "Branches" — confusing UX
3. `gym_id` used in RLS for ALL data access — can't remove without RLS rewrite
4. Financial tables have `gym_id` as NOT NULL — hardest to migrate
5. `routing_mode` enum includes `'gym'` option in tenant_domains
6. `organization_type` enum includes `'single_gym'` option

### Safe First Steps (no breaking changes)
1. ✅ Keep `gyms` table and `gym_id` columns — just stop showing them in UI
2. ✅ Fix `getBranchCount()` to query branches
3. ✅ Remove "Gyms" from customer-facing UI, replace with "Branches/Locations"
4. ✅ Remove `max_gyms` from package editor
5. ✅ Update navigation labels (Gyms → Branches/Locations)

---

## 7. MIGRATION STATUS

### COMPLETED (Phase 1-7, Safe — Production Ready)

| Change | Files Changed | Status |
|---|---|---|
| `getBranchCount()` now queries `branches` table (was querying `gyms`) | `subscription-usage-service.ts` | ✅ FIXED CRITICAL BUG |
| `checkUsage()` now queries `branches` table | `subscription-enterprise-actions.ts` | ✅ FIXED |
| Removed `gymLimit` from `OrgUsage` type | `subscription-usage-types.ts` | ✅ DONE |
| Removed `maxGyms` from package schema | `package-management-actions.ts` | ✅ DONE |
| Removed "Max Gyms" from package editor UI | `package-management-client.tsx` | ✅ DONE |
| Org Owner Nav: "Gyms" → "Branches" | `organization-owner-modules.tsx` | ✅ DONE |
| Super Admin Nav: "Gyms" → "Branches" | `super-admin-modules.tsx` | ✅ DONE |
| Org Owner module: all UI labels "Gym" → "Location/Branch" | `GymsModule.tsx`, `gym-actions.ts`, `branch-actions.ts`, `gym-detail-panel.tsx` | ✅ DONE |
| Branch create/edit: revalidate /organization/branches | `branch-actions.ts` | ✅ DONE |
| Module resolver: handles both "gyms" and "branches" slug | `module-data-resolver.ts` | ✅ DONE |
| Super Admin UI labels updated | `GymBranchManagementWorkspace.tsx` | ✅ DONE |
| SQL migration (backward compatible) | `20260622000000_gym_to_branch_migration.sql` | ✅ READY |
| Build typecheck passes | All source files | ✅ PASS |

### NOT CHANGED (Backward Compatible — Future Release)

| Item | Rationale |
|---|---|
| `gyms` database table | Still used internally; not removed |
| `gym_id` columns on 80+ tables | Would require full data migration + RLS rewrite |
| RLS helper functions (`current_user_gym_id()`, `can_access_gym()`, etc.) | Still functional; tied to gym_id columns |
| `organization_type` values (`single_gym`) | Still valid; migration SQL available |
| `gym_admin` role name | Internal RBAC role; UI shows "Branch Manager" |
| Storage bucket policies referencing gym_id | Still functional with existing data |
| `tenant_domains.routing_mode` values | Still functional; used by deployed domains |

### CUSTOMER-FACING IMPACT

**Before:** Organization → **Gym** → Branch → Users
**After:** Organization → **Branch / Location** → Users

- Package limits now show "Max Branches" only (no "Max Gyms")
- Org Owner sees "Branches" in navigation, not "Gyms"
- Super Admin sees "Branches" module, not "Gyms"
- Branch creation enforces `max_branches` package limit
- All customer-facing labels use "Branch" or "Location" terminology

## 8. REMAINING DEPRECATED REFERENCES (Internal Only)

These are intentionally preserved for backward compatibility:
- `gyms` table and `gym_id` columns — untouched
- `gym_admin` role name — used in RBAC, RLS, and database
- Internal function names like `getGymIds()`, `current_user_gym_id()` — functional
- `requireGymAdminScope()` — access control function, still valid

