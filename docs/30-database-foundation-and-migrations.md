# 30 - Database Foundation and Migrations

## 1. Purpose

This document translates the Phase 1 database architecture into an implementation foundation for PostgreSQL and Supabase. It defines tables, relationships, indexes, constraints, views, migration strategy, rollback strategy, and long-term database governance.

## 2. Database Ownership

PostgreSQL is the source of truth for:

- Users and roles.
- Members and trainers.
- Membership plans and membership records.
- Payments and payment events.
- Attendance.
- Classes and bookings.
- Workout and diet plans.
- Notifications.
- Leads.
- Public content.
- Settings.
- Audit logs.

Supabase Auth owns authentication credentials and auth sessions. Application `users` rows link to Supabase Auth users through `auth_user_id`.

## 3. Initial Table Set

### Identity and Tenant Tables

| Table | Purpose |
| --- | --- |
| `gyms` | Tenant/gym profile, public settings, timezone, currency, business hours. |
| `users` | Application user profile linked to Supabase Auth. |
| `roles` | Role catalog. |
| `user_roles` | User-role assignments scoped by gym where applicable. |

### Business Tables

| Table | Purpose |
| --- | --- |
| `members` | Member profile and lifecycle state. |
| `trainers` | Trainer profile and public trainer metadata. |
| `membership_plans` | Sellable plan catalog. |
| `memberships` | Member membership periods. |
| `payments` | Online/offline payment records. |
| `payment_events` | Razorpay webhook and provider events. |
| `attendance` | Gym check-ins and class attendance. |
| `classes` | Group class sessions. |
| `class_bookings` | Member bookings for classes. |
| `workout_plans` | Trainer-authored workout plans. |
| `diet_plans` | Trainer-authored diet plans. |

### CRM, Content, and System Tables

| Table | Purpose |
| --- | --- |
| `notifications` | In-app notifications. |
| `notification_templates` | Admin-configurable notification copy. |
| `leads` | Inquiries, trial requests, newsletter leads, conversion status. |
| `testimonials` | Published member testimonials. |
| `blogs` | SEO blog content. |
| `gallery` | Public media gallery metadata. |
| `audit_logs` | Immutable critical action history. |

## 4. Relationship Foundation

| Relationship | Constraint |
| --- | --- |
| Gym to operational tables | Operational tables include `gym_id` FK to `gyms.id`. |
| Supabase auth to app user | `users.auth_user_id` unique. |
| User to roles | Many-to-many through `user_roles`. |
| User to member | `members.user_id` optional unique. |
| User to trainer | `trainers.user_id` required unique. |
| Trainer to members | `members.assigned_trainer_id` optional FK to `trainers.id`. |
| Plan to memberships | `memberships.membership_plan_id` FK. |
| Member to payments | `payments.member_id` FK. |
| Payment to membership | `memberships.payment_id` optional FK or `payments.membership_id` optional FK. |
| Class to bookings | `class_bookings.class_id` FK. |
| Member to bookings | `class_bookings.member_id` FK. |
| Booking to attendance | `attendance.class_booking_id` optional FK. |
| Lead to converted member | `leads.converted_member_id` optional FK. |

## 5. Required Indexes

### Tenant and Status Indexes

| Table | Index |
| --- | --- |
| `users` | `gym_id`, `status`, lower `email` unique. |
| `members` | `(gym_id, status)`, `(gym_id, phone)`, `(gym_id, email)`, `assigned_trainer_id`. |
| `trainers` | `(gym_id, status, is_public)`, `(gym_id, slug)` unique. |
| `membership_plans` | `(gym_id, status, is_public, display_order)`, `(gym_id, slug)` unique. |
| `memberships` | `(gym_id, member_id, status)`, `(gym_id, end_date, status)`. |
| `payments` | `(gym_id, status, created_at)`, `(gym_id, member_id, created_at)`. |
| `attendance` | `(gym_id, check_in_at)`, `(gym_id, member_id, check_in_at)`. |
| `classes` | `(gym_id, start_at, status)`, `(gym_id, trainer_id, start_at)`. |
| `class_bookings` | `(gym_id, member_id, booked_at)`, `(gym_id, class_id, status)`. |
| `leads` | `(gym_id, status, created_at)`, `(gym_id, phone)`, `(gym_id, email)`. |
| `notifications` | `(user_id, status, created_at)`, `(gym_id, created_at)`. |
| `blogs` | `(gym_id, status, published_at)`, `(gym_id, slug)` unique. |
| `gallery` | `(gym_id, status, display_order)`. |
| `audit_logs` | `(gym_id, created_at)`, `(actor_user_id, created_at)`, `(entity_type, entity_id)`. |

### Payment Provider Indexes

| Table | Index |
| --- | --- |
| `payments` | Unique `razorpay_order_id` where not null. |
| `payments` | Unique `razorpay_payment_id` where not null. |
| `payments` | Unique `(gym_id, receipt_number)` where not null. |
| `payment_events` | Unique `(provider, provider_event_id)`. |

## 6. Required Constraints

| Domain | Constraint |
| --- | --- |
| Money | Amount fields are integers in smallest currency unit and must be non-negative or positive as appropriate. |
| Membership plans | `duration_days > 0`, `price_amount >= 0`, `joining_fee_amount >= 0`. |
| Membership records | `end_date >= start_date`. |
| Payments | `amount > 0`, `refund_amount >= 0`, `refund_amount <= amount`. |
| Testimonials | `rating between 1 and 5`; published requires consent. |
| Classes | `end_at > start_at`, `capacity > 0`. |
| Attendance | `check_out_at` null or after `check_in_at`. |
| Dates | Birth date cannot be in future. |
| Emails | Lowercase and format-validated at app layer; optional DB check may be added. |
| Slugs | Unique per gym for public content/entities. |

## 7. Views and Reporting Foundation

Create views only after base tables and indexes are stable.

Recommended initial views:

| View | Purpose |
| --- | --- |
| `active_memberships_view` | Current active memberships with member and plan summary. |
| `member_status_summary_view` | Member status, current plan, expiry date, trainer. |
| `revenue_daily_view` | Daily captured/offline revenue summary by gym. |
| `attendance_daily_view` | Daily check-in counts by gym and attendance type. |
| `lead_funnel_view` | Lead counts by status/source/date. |
| `class_occupancy_view` | Booked/capacity ratios for classes. |

Rules:

- Views must respect tenant boundaries.
- RLS should still protect underlying tables; use security invoker behavior where appropriate.
- Heavy analytics can move to materialized views in later phases.

## 8. Migration Strategy

### Initial Migration

Order:

1. Required extensions.
2. Enums or check-constraint helper domains if used.
3. `gyms`.
4. `users`, `roles`, `user_roles`.
5. Core business tables: members, trainers, plans, memberships.
6. Payments and payment events.
7. Attendance, classes, bookings.
8. Workout/diet plans.
9. Leads, notifications, content tables.
10. Audit logs.
11. Indexes.
12. Triggers for `updated_at` and audit helper functions where needed.
13. RLS enablement and baseline policies.
14. Seed roles and optional development seed gym.

### Migration File Naming

Use timestamped migration names:

- `YYYYMMDDHHMMSS_create_core_schema`
- `YYYYMMDDHHMMSS_add_payments`
- `YYYYMMDDHHMMSS_add_rls_policies`
- `YYYYMMDDHHMMSS_add_reporting_views`

### Future Migration Process

Every database change must include:

- Migration file.
- Reason for change.
- Backward compatibility assessment.
- RLS impact review.
- Index impact review.
- Type generation update.
- Staging verification.
- Rollback or forward-fix plan.

Rules:

- Never edit an already-applied production migration.
- Add new migration files for changes.
- Avoid destructive migrations without a data migration and backup plan.
- Prefer nullable column addition, backfill, then constraint tightening for high-risk changes.

## 9. Rollback Strategy

Rollback posture:

- Production rollbacks should prefer forward-fix migrations.
- Destructive down migrations are risky and should not be automatic.
- Vercel deployment rollback does not roll back database schema.

Rollback plan types:

| Change Type | Rollback Strategy |
| --- | --- |
| Add nullable column | Safe to leave in place or drop in explicit rollback if unused. |
| Add index | Drop index if it causes performance issue. |
| Add table | Leave in place if harmless; drop only before data dependency. |
| Add constraint | Drop constraint if invalid business impact discovered. |
| Rename/drop column | Avoid in production unless staged; use compatibility period. |
| RLS policy change | Revert with new policy migration immediately. |
| Payment schema change | Forward-fix only after backup and reconciliation review. |

## 10. Data Seeding Strategy

Development seed:

- One gym.
- Standard roles.
- One admin bootstrap record after auth setup.
- Membership plans.
- Trainers.
- Sample public content.
- Sample leads/members/payments only in local/dev.

Production seed:

- Roles.
- Initial gym record.
- Initial super admin/gym admin linkage.
- Required notification templates.

Never seed fake production testimonials, payments, or member health data.

## 11. Database Governance Rules

- All operational tables include `gym_id`.
- All business-critical tables include timestamps.
- Financial rows are never hard-deleted by application users.
- Audit logs are append-only.
- Payment webhook events are idempotent.
- Public content supports draft/published/archived state.
- RLS is enabled before production data enters a table.
- Generated database types are refreshed after migrations.
- Slow queries are reviewed before launch.
