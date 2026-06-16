# Organization → Branch/Location Migration: Execution Plan

## Current State Summary

| Metric | Value |
|---|---|
| Tables with `gym_id` column | **116** |
| Tables with `gym_id` NOT NULL (highest risk) | **6** (`credit_notes`, `write_offs`, `disputes`, `reconciliation`, `revenue_recognition`, `financial_periods`) |
| Tables already with `branch_id` | **27** |
| Tables already with `organization_id` | **62** |
| FK constraints to `gyms(id)` | **~115** |
| Database views with `gym_id` | **24** |
| DB functions with `gym_id` in args/returns | **8** |
| RLS helper functions that use `gym_id` | **7** |
| Live records: organizations | 6 |
| Live records: gyms | 1,004 |
| Live records: branches | 4 (all with `organization_id` populated) |
| Live records: members | 1 |
| Live records: trainers | 1 |

## Risk Assessment

**Low data volume risk:** Only 4 branches, 1 member, 1 trainer — data migration is safe.
**High schema complexity risk:** 115+ foreign keys, 100+ tables, 24 views, 7 RLS functions — schema changes require extreme care.
**Low business impact:** System appears early-stage with minimal production data.

---

## Migration Phases

### Phase 0: Pre-Migration (Backup + Verification)

- [ ] Create full database backup via Supabase Dashboard
- [ ] Run pre-migration validation queries (see below)
- [ ] Document current FK constraints
- [ ] Verify no active users will be disrupted

### Phase 1: Schema Additions (Add branch_id columns, make gym_id nullable)

**Goal:** Add `branch_id` columns to all 89 tables that lack it, make the 6 NOT NULL `gym_id` columns nullable.
**Risk:** LOW — only adds columns, no data loss.
**Rollback:** Easy — just drop added columns.

**Tables needing `branch_id` column added:**
- All 89 tables that have `gym_id` but NOT `branch_id`
- See detailed table list below

**Tables needing `gym_id` changed from NOT NULL to NULL:**
- `credit_notes`, `write_offs`, `disputes`, `reconciliation`, `revenue_recognition`, `financial_periods`

### Phase 2: Data Backfill (Populate branch_id from gym_id mapping)

**Goal:** Backfill `branch_id` on all tables using the gym→branch mapping.
**Risk:** LOW — only updates existing records.
**Rollback:** Straightforward — values can be updated again.

**Mapping logic:**
```
For each record with gym_id:
  - Find the branch where branches.gym_id = gym_id
  - If exactly one branch found → use that branch_id
  - If multiple branches found → use the first active branch
  - If no branch found → skip (leave branch_id null)
```

### Phase 3: Application Code Update (Use branch_id instead of gym_id)

**Goal:** Update all TypeScript/TSX code to use `branch_id` for operational logic.
**Risk:** HIGH — many files to update, risk of missed references.
**Strategy:** Add `branch_id` alongside `gym_id`, then progressively migrate.

### Phase 4: RLS Rewrite (Remove gym_id dependency from policies)

**Goal:** Rewrite all RLS helper functions to use `branch_id` / `organization_id`.
**Risk:** HIGH — security-critical.
**Strategy:** Keep old functions as backward-compatible wrappers, create new branch-based functions.

### Phase 5: Remove Gyms Table Dependency

**Goal:** Remove all FK constraints to `gyms(id)`, drop deprecated columns.
**Risk:** VERY HIGH — 115+ constraints, cannot drop until all are removed.
**Prerequisite:** All FKs must be removed first.

### Phase 6: Final Cleanup

**Goal:** Drop or deprecate remaining gym references.
**Risk:** MEDIUM.

---

## Detailed Table Migration Plan

### Priority Group A: Tables WITH branch_id already (Easiest — 27 tables)
These tables already have `branch_id`. Just need to backfill from `gym_id`:
- `branches`, `gym_branch_approval_requests`, `tenant_domains`, `tenant_domain_checks`, `tenant_domain_provider_events`
- `members`, `invoices`, `payments`, `attendance_sessions`
- `ai_fitness_profiles`, `ai_observability_logs`
- `analytics_branch_scorecards`
- Activity/audit tables: `activity_events`, `security_events`, `compliance_requests`, `retention_policies`, `backup_jobs`, `system_health_checks`
- PWA: `pwa_push_subscriptions`, `pwa_offline_actions`, `pwa_install_events`, `pwa_cache_snapshots`
- `feature_flags`, `branch_metrics`, `branch_settings`, `branch_users`

### Priority Group B: Core tables needing branch_id (89 tables)
These have `gym_id` but need `branch_id` column added + backfill.

### Priority Group C: NOT NULL gym_id tables (6 tables — Highest Risk)
- `credit_notes`, `write_offs`, `disputes`, `reconciliation`, `revenue_recognition`, `financial_periods`
- These need `gym_id` changed to nullable, `branch_id` added, then backfill.

---

## SQL Migration Script (Phase 1-2)

```sql
-- ============================================================
-- PHASE 1: Add branch_id columns and make gym_id nullable
-- ============================================================

-- Step 1.1: Add branch_id to all tables that have gym_id but NOT branch_id
-- Core business tables
ALTER TABLE public.profiles ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.membership_plans ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.memberships ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.membership_history ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.membership_status_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.member_documents ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.membership_notification_events ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.discounts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.coupons ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.payment_attempts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.refunds ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.billing_events ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Trainer tables
ALTER TABLE public.trainers ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.trainer_assignments ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.personal_training_packages ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.member_pt_packages ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.workout_programs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.workout_program_assignments ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.trainer_sessions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.trainer_session_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.trainer_notes ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.trainer_feedback ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.staff_profiles ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.staff_activity_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.trainer_notification_events ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Attendance tables
ALTER TABLE public.attendance_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.entry_events ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.exit_events ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.access_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_alerts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_metrics ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.access_devices ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.qr_tokens ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Class tables
ALTER TABLE public.class_categories ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.classes ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_trainers ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_schedules ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_schedule_exceptions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_sessions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_bookings ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_waitlists ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_attendance ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_session_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.class_notification_events ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Fitness tables
ALTER TABLE public.exercises ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.fitness_goals ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.workout_sessions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.exercise_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.body_measurements ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.progress_photos ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.nutrition_plans ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.meal_plans ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.meal_entries ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.fitness_milestones ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.fitness_notification_events ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Communication tables
ALTER TABLE public.notification_templates ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.notification_preferences ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.communication_segments ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.campaigns ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.campaign_recipients ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.email_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.sms_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.announcements ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.communication_automation_rules ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.communication_history ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Analytics tables
ALTER TABLE public.analytics_events ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.kpi_snapshots ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.dashboard_configs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.saved_reports ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.report_exports ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.forecast_models ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.business_metrics ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.analytics_insights ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.analytics_cohorts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.analytics_marketing_campaigns ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.analytics_marketing_attribution ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.analytics_churn_predictions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.analytics_alerts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.analytics_alert_history ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.analytics_ltv_snapshots ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- AI tables
ALTER TABLE public.ai_recommendations ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_generated_programs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_chat_sessions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_knowledge_documents ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_knowledge_chunks ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_predictions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_forecasts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_insights ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_content_drafts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.ai_automation_suggestions ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Financial tables (NOT NULL gym_id — HIGHEST RISK)
ALTER TABLE public.credit_notes ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.write_offs ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.disputes ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.reconciliation ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.revenue_recognition ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.financial_periods ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
```

---

## RLS Helper Function Migration Plan

### Current Functions (All use `gym_id`)

| Function | Strategy |
|---|---|
| `current_user_gym_id()` | Replace with `current_user_branch_id()` + `current_user_organization_id()`. Keep old as deprecated wrapper. |
| `can_access_gym(gym_id)` | Replace with `can_access_branch(branch_id)` + `can_access_organization(org_id)`. |
| `can_operate_gym(gym_id)` | Replace with `can_operate_branch(branch_id)`. Keep old as deprecated. |
| `can_manage_gym(gym_id)` | Replace with `can_manage_branch(branch_id)`. Keep old as deprecated. |
| `can_manage_organization(org_id)` | Already correct — no gym_id needed. ✅ |
| `can_access_branch(branch_id)` | Already correct. ✅ |

### New RLS Model

```
organization_id = tenant boundary (who owns the data)
branch_id = operational boundary (where the work happens)
user_id = personal boundary (own data only)
```

---

## organization_type Enum Migration

Current values: `single_gym`, `multi_branch`, `franchise`

New values: `single_location`, `multi_location`, `franchise`, `other`

Algorithm (safe — preserves old):
1. Add new values to enum
2. Migrate `single_gym` → `single_location` in data
3. Keep `single_gym` as deprecated alias
4. Update UI options to use new values only

---

## Key Constraints and Dependencies Graph

```
gyms TABLE DEPENDENCIES:
├── 115+ FK constraints from other tables
├── 24 views SELECT from tables with gym_id
├── 7 RLS functions reference gym_id
├── 8 DB functions reference gym_id in args/returns
├── Tenant domain routing (routing_mode = 'gym')
├── Tenant resolution function (returns gym_id)
├── Profile and user_role records (gym_id on profile)
├── Organization type enum (single_gym)
└── Application code (1160+ references across 44+ files)
```

**Removal order:** FKs → Views → Functions → RLS → App Code → Profiles → Domain → Enum → Table

---

## Rollback Plan

If any phase causes issues:

1. **Phase 1 (column additions):** `ALTER TABLE ... DROP COLUMN branch_id`
2. **Phase 2 (data backfill):** `UPDATE ... SET branch_id = NULL`
3. **Phase 3 (app code):** Revert to previous commit
4. **Phase 4 (RLS):** Recreate original functions
5. **Phase 5 (FK removal):** Cannot drop without re-adding. Keep gyms table.
6. **Phase 6 (cleanup):** Revert to last migration

**Full rollback:** Restore database backup + revert git to previous commit.

---

## Post-Migration Validation Queries

```sql
-- 1. Verify no records missing branch_id where gym_id is set
SELECT 'orphan_check' as check_name, COUNT(*) FROM members WHERE gym_id IS NOT NULL AND branch_id IS NULL;

-- 2. Verify all branches have organization_id
SELECT 'branch_org_check' as check_name, COUNT(*) FROM branches WHERE organization_id IS NULL;

-- 3. Verify no cross-org branch assignment
SELECT 'cross_org_check' as check_name, COUNT(*) FROM branches b 
JOIN members m ON m.branch_id = b.id 
WHERE m.organization_id IS NOT NULL AND m.organization_id != b.organization_id;

-- 4. Verify package limits don't reference max_gyms
SELECT 'max_gyms_check' as check_name, COUNT(*) FROM package_limits WHERE limit_code = 'max_gyms';

-- 5. Verify no domain routes reference 'gym'
SELECT 'domain_routing_check' as check_name, COUNT(*) FROM tenant_domains WHERE routing_mode = 'gym';
```
