# Gym Admin Role Design and Permission Architecture

## 1. Purpose

The Gym Admin is the operational owner of one specific gym in the multi-tenant Gym Management SaaS Platform.

They sit below Organization Owner and above Reception Staff, Trainer, and Member:

```text
Super Admin
  -> Organization Owner
    -> Gym Admin
      -> Reception Staff
      -> Trainer
      -> Member
```

The Gym Admin runs daily gym operations: members, memberships, payments, trainers, attendance, classes, leads, reports, communications, and gym settings. They must have enough control to operate independently, but they must never access other gyms, other organizations, SaaS billing, platform settings, or global tenant data.

## 2. Access Scope

Gym Admin can access:

| Scope | Access |
| --- | --- |
| Own gym | Full operational management |
| Own gym branches, if enabled | View and manage within assigned gym |
| Own gym staff | Create, update, deactivate operational staff |
| Own gym trainers | Create, update, deactivate, assign members |
| Own gym members | Full operational member management |
| Own gym classes | Schedule, update, cancel, track attendance |
| Own gym revenue | View and manage gym-level payments and reports |
| Own gym attendance | Check-in, check-out, reports, analytics |
| Own gym leads | Capture, assign, follow up, convert |
| Own gym inventory | Manage stock, vendors, products, reports |
| Own gym settings | Configure operational rules and branding |
| Own gym audit logs | View activity inside own gym |

Gym Admin cannot access:

| Restricted Area | Reason |
| --- | --- |
| Other gyms | Gym-level isolation |
| Other branches outside assigned gym | Branch isolation |
| Other organizations | Tenant isolation |
| Organization-level governance | Organization Owner scope |
| SaaS subscription management | Organization Owner or Super Admin scope |
| Platform settings | Super Admin only |
| Global SaaS plans | Super Admin only |
| Platform domains | Super Admin or Organization Owner scope |
| System monitoring | Super Admin only |
| Other tenant data | Privacy and compliance |

## 3. Permission Matrix

Actions:

- `R` = read
- `C` = create
- `U` = update
- `D` = delete
- `A` = activate, approve, or assign
- `E` = export
- `F` = financial action

| Module | Read | Create | Update | Delete | Activate or Assign | Export | Financial | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gym Dashboard | R | - | - | - | - | E | - | Own gym only |
| Member Management | R | C | U | Deactivate only | Suspend/reactivate/transfer inside allowed scope | E | - | Own gym members only |
| Membership Management | R | C | U | Archive only | Assign plans | E | - | Own gym plans only |
| Trainer Management | R | C | U | Deactivate only | Assign members | E | - | Own gym trainers only |
| Reception Staff Management | R | C | U | Deactivate only | Assign shifts/permissions | E | - | Own gym staff only |
| Attendance Management | R | C check-ins | Limited corrections | - | Check-in/check-out | E | - | Immutable access logs |
| Class Management | R | C | U | Cancel/archive only | Assign trainers | E | F view | Own gym classes only |
| Personal Training | R | C | U | Archive only | Assign PT trainers | E | F view | Own gym PT packages |
| Workout Management | R | C | U | Archive only | Assign plans | E | - | Own gym members/trainers |
| Nutrition Management | R | C | U | Archive only | Assign meal plans | E | - | Own gym members/trainers |
| Payment Management | R | C | Limited corrections | - | Refund request/approval per policy | E | F | Own gym payments only |
| Lead Management | R | C | U | Archive only | Assign leads | E | - | Own gym leads only |
| Inventory Management | R | C | U | Archive only | Stock adjustments | E | F view | Own gym inventory |
| Communication Center | R | C | U | Archive only | Send campaigns | E | - | Own gym audience only |
| Analytics Center | R | C saved views | U saved views | D saved views | - | E | - | Own gym analytics only |
| Gym Settings | R | - | U | - | Publish settings | - | - | Own gym only |
| Document Management | R | C upload | U replace | Delete own gym files per policy | - | E | - | Storage path must be gym-scoped |
| Audit and Security | R | - | Limited status updates | - | MFA/password policy config if allowed | E | - | Cannot delete logs |
| Reports Center | R | C report exports | U saved reports | D saved reports | - | E | - | Export logged |
| AI Fitness Assistant | R | C prompts | U saved outputs | - | Approve AI suggestions | E limited | - | Human review required |

## 4. Detailed Module Design

### Module 1: Gym Dashboard

Dashboard widgets:

- Today's attendance
- Current members inside gym
- Active memberships
- Expired memberships
- Renewals due today
- Revenue today
- Revenue this month
- Personal training revenue
- Class attendance
- Trainer utilization
- Staff attendance
- Top trainers
- Top membership plans
- Pending payments
- Recent activities

Rules:

- Dashboard data must be filtered by `gym_id = current_user.gym_id`.
- All widgets must support date range filters.
- Financial widgets must use source payment and invoice records, not derived client-side totals.
- Empty states must guide staff to operational actions.

### Module 2: Member Management

Allowed:

- Create member.
- Edit member.
- Suspend member.
- Activate member.
- Transfer member only if allowed by organization policy.
- View member profile.
- Manage membership.
- Renew membership.
- Freeze membership.
- Cancel membership.
- Upload member documents.
- Upload progress photos.
- View attendance history.
- View workout history.
- View nutrition history.
- View payment history.

Restrictions:

- Cannot access members from another gym.
- Cannot transfer members outside the allowed organization policy.
- Cannot permanently delete payment or attendance history.
- Cannot modify trainer-authored progress records except through approved correction workflows.

### Module 3: Membership Management

Allowed:

- Create membership plans.
- Edit membership plans.
- Deactivate plans.
- Manage pricing.
- Manage offers.
- Manage discounts.
- Create coupons.
- Assign plans.

Membership types:

- Monthly
- Quarterly
- Half-yearly
- Annual
- Premium
- Personal training
- Custom packages

Rules:

- Plans are scoped to the Gym Admin's gym unless organization-wide plans are inherited read-only.
- Existing invoices and historical payments must not change when pricing changes.
- Plan deletion must be archive-only once used.
- Discounts and coupons require expiry, usage limits, and audit logging.

### Module 4: Trainer Management

Allowed:

- Create trainer.
- Edit trainer.
- Deactivate trainer.
- Assign members.
- Reassign members.
- View trainer performance.
- View trainer attendance.
- View PT sessions.
- Track client retention.
- Track revenue generated.
- View trainer workload analytics.

Rules:

- Trainer must belong to the same gym.
- Member assignment must require same gym.
- Trainer deactivation must preserve historical session and revenue data.
- Trainer performance must be derived from sessions, assignments, attendance, ratings, and revenue records.

### Module 5: Reception Staff Management

Allowed:

- Create reception staff.
- Edit reception staff.
- Deactivate staff.
- Reset password invitation.
- Assign shifts.
- Track attendance.
- View performance.
- Manage operational permissions.

Restrictions:

- Cannot create Super Admin.
- Cannot create Organization Owner.
- Cannot assign users to another gym.
- Cannot bypass MFA or password policies.

### Module 6: Attendance Management

Allowed:

- QR check-in.
- Manual check-in.
- Biometric integration preparation.
- Attendance dashboard.
- Visit tracking.
- Peak hour reports.
- Attendance trends.
- Attendance export.
- Late check-in reports.
- Member visit analysis.

Rules:

- Check-in is allowed only for valid members of the same gym.
- Duplicate check-ins must be prevented.
- Access logs must be immutable.
- Corrections require an audit-backed adjustment workflow.
- QR tokens from other gyms must be rejected.

### Module 7: Class Management

Allowed:

- Create classes.
- Edit classes.
- Cancel classes.
- Assign trainers.
- Manage capacity.
- Manage waitlists.
- Track attendance.
- View class performance.
- View class revenue reports.

Rules:

- Class, trainer, and booking records must all belong to the same gym.
- Capacity controls must prevent overbooking at application and database level.
- Waitlist promotion must be deterministic and auditable.
- Class cancellation must notify affected members.

### Module 8: Personal Training Management

Allowed:

- Create PT packages.
- Assign PT trainers.
- Schedule sessions.
- Track session completion.
- Track PT revenue.
- Track trainer performance.
- Manage PT renewals.

Rules:

- PT package, trainer, and member must belong to same gym.
- Session completion should update package usage.
- PT revenue should reconcile with payments and invoices.
- Expiring PT packages should trigger reminders.

### Module 9: Workout Management

Allowed:

- Create workout templates.
- Assign workout plans.
- Track progress.
- Manage fitness goals.
- Manage exercise library.
- View workout history.
- View performance reports.

Rules:

- Gym Admin can oversee workout operations but should not directly edit trainer-created logs unless policy allows correction.
- Member workout privacy must be respected.
- Exercise templates can be gym-level, while member-specific logs remain member/trainer scoped.

### Module 10: Nutrition Management

Allowed:

- Create meal plans.
- Assign meal plans.
- Track nutrition compliance.
- Track water intake.
- Track weight progress.
- Manage nutrition templates.
- View nutrition reports.

Rules:

- Nutrition data is sensitive health data.
- Gym Admin can oversee compliance and templates.
- Direct edits to member logs should be restricted or correction-based.

### Module 11: Payment Management

Allowed:

- Collect payments.
- Record cash payments.
- Process online payments.
- Generate receipts.
- Generate invoices.
- Manage refunds according to policy.
- Track pending payments.
- Track failed payments.
- View daily cash reports.
- View payment reports.

Rules:

- Payments must be gym-scoped.
- Payment verification must happen server-side.
- Cash collection must record collector, timestamp, and receipt.
- Refunds require confirmation and audit logging.
- Financial records must never be hard deleted.

### Module 12: Lead Management

Allowed:

- Create leads.
- Import leads.
- Assign leads.
- Record follow-ups.
- Track conversion.
- Manage sales funnel.
- Manage trial members.
- View lead analytics.

Rules:

- Leads belong to the gym that captured them.
- Imports must validate duplicate phone/email.
- Conversion creates member records in the same gym.
- Lead source analytics must be tracked.

### Module 13: Inventory Management

Allowed:

- Manage products.
- Manage supplements.
- Manage merchandise.
- Track stock.
- Configure low stock alerts.
- Track purchases.
- Manage vendors.
- View inventory reports.

Rules:

- Inventory is gym-scoped.
- Stock adjustments require reason and actor.
- Sales should reconcile with payment records if POS is enabled.
- Vendor details must remain within gym/organization scope.

### Module 14: Communication Center

Allowed:

- Announcements.
- SMS campaigns.
- WhatsApp campaigns.
- Email campaigns.
- Push notifications.
- Member segmentation.
- Birthday wishes.
- Renewal reminders.
- Promotional campaigns.

Rules:

- Audience must be limited to own gym.
- Opt-in and opt-out preferences must be respected.
- Bulk sends must be rate limited and queued.
- Every send and export must be audited.

### Module 15: Analytics Center

Allowed analytics:

- Revenue analytics
- Membership analytics
- Attendance analytics
- Trainer analytics
- Lead analytics
- Retention analytics
- Growth analytics
- Churn analytics
- Business performance reports

Rules:

- Data source must be own gym only.
- Saved dashboard layouts are gym-scoped.
- Exports must be logged.
- Dashboard queries should use pre-aggregated metrics where possible.

### Module 16: Gym Settings

Allowed settings:

- Gym name
- Logo
- Address
- Phone
- Email
- Business hours
- Tax settings
- Receipt settings
- Invoice settings
- QR settings
- Attendance rules
- Membership rules

Restrictions:

- Cannot edit organization-level legal details unless delegated.
- Cannot edit SaaS subscription.
- Cannot edit platform domains.
- Cannot weaken platform-enforced security policies.

### Module 17: Document Management

Allowed:

- Member documents.
- Trainer documents.
- Contracts.
- Invoices.
- Reports.
- Export center.
- File management.

Rules:

- Storage paths must include gym scope.
- File uploads must validate MIME type, extension, size, and malware-risk patterns.
- Sensitive documents require access logging.
- Deleted files should use retention policy where required.

### Module 18: Audit and Security

Allowed:

- View activity logs.
- View staff actions.
- View login history.
- View security events.
- Export audit reports.
- Manage MFA policy if delegated.
- Manage password policy if delegated.

Restrictions:

- Cannot delete audit logs.
- Cannot view Super Admin logs.
- Cannot view organization-wide logs outside own gym unless delegated.
- Cannot disable platform security controls.

### Module 19: Reports Center

Allowed reports:

- Daily reports.
- Weekly reports.
- Monthly reports.
- Annual reports.
- Attendance reports.
- Revenue reports.
- Membership reports.
- Trainer reports.
- Inventory reports.
- Lead reports.

Rules:

- Reports must be gym-scoped.
- Exports must be logged.
- Large exports should be queued.
- Financial reports must reconcile with invoice and payment records.

### Module 20: AI Fitness Assistant

Allowed:

- AI workout suggestions.
- AI nutrition suggestions.
- AI retention insights.
- AI revenue insights.
- AI member risk prediction.
- AI growth recommendations.

Rules:

- AI must only use own gym data.
- AI-generated workout or nutrition plans require human approval before assignment.
- AI business insights must include explainable source context.
- Prompts and responses should be logged for observability, excluding sensitive raw data where possible.

## 5. Sidebar Navigation Structure

Recommended sidebar:

```text
Gym Operations
  Dashboard
  Members
  Memberships
  Payments
  Attendance

People
  Trainers
  Reception Staff
  PT Sessions
  Staff Attendance

Programs
  Classes
  Workout Plans
  Nutrition Plans

Growth
  Leads
  Campaigns
  Communications

Business
  Analytics
  Reports
  Inventory
  Documents

Administration
  Gym Settings
  Audit and Security
  AI Assistant
```

Recommended routes:

| Route | Purpose |
| --- | --- |
| `/admin` | Gym dashboard |
| `/admin/members` | Member directory |
| `/admin/members/new` | Member onboarding |
| `/admin/members/[memberId]` | Member profile |
| `/admin/membership-plans` | Membership plan management |
| `/admin/payments` | Payment management |
| `/admin/attendance` | Attendance operations |
| `/admin/trainers` | Trainer management |
| `/admin/trainers/[trainerId]` | Trainer profile |
| `/admin/trainers/packages` | PT package management |
| `/admin/staff` | Reception/staff management |
| `/admin/classes` | Class scheduling |
| `/admin/fitness` | Workout and nutrition oversight |
| `/admin/communications` | Campaigns and notifications |
| `/admin/reports` | Reports and analytics |
| `/admin/settings` | Gym settings |
| `/admin/ai` | AI assistant and insights |
| `/admin/inventory` | Inventory management |
| `/admin/leads` | Lead management |
| `/admin/documents` | Document center |
| `/admin/security` | Audit and security |

## 6. Dashboard Design

Recommended desktop layout:

```text
Header
  Gym name
  Date filter
  Quick actions
    Add Member
    Check-In
    Collect Payment
    Create Class

Row 1: Daily Operations
  Today's Attendance
  Current Members Inside
  Renewals Due Today
  Revenue Today

Row 2: Business Health
  Active Memberships
  Expired Memberships
  Revenue This Month
  Pending Payments

Row 3: Operational Charts
  Attendance Trend
  Revenue Trend
  Membership Growth

Row 4: People and Programs
  Trainer Utilization
  Class Attendance
  Staff Attendance

Row 5: Action Tables
  Expiring Memberships
  Pending Payments
  Recent Activities
  Leads Due for Follow-Up
```

Mobile layout:

- Sticky gym header.
- Bottom navigation for dashboard, members, attendance, payments, more.
- Quick action button for check-in and payment.
- KPI cards in horizontal scroll.
- Tables rendered as compact cards.
- Filters in a drawer.

## 7. Module Architecture

Recommended feature module:

```text
features/admin/
  lib/
    access.ts
    permissions.ts
    gym-business-rules.ts
  components/
    admin-dashboard.tsx
    admin-filter-bar.tsx
    admin-kpi-grid.tsx
    gym-quick-actions.tsx
  services/
    gym-dashboard-service.ts
    gym-revenue-service.ts
    gym-attendance-service.ts
    gym-report-service.ts
  actions/
    gym-settings-actions.ts
    staff-actions.ts
    inventory-actions.ts
    lead-actions.ts
  schemas/
    gym-settings.ts
    staff.ts
    inventory.ts
    leads.ts
```

Required access helper:

```text
requireGymAdminScope()
  - requires authenticated user
  - allows gym_admin and delegated reception_staff where needed
  - rejects organization_owner-only users
  - rejects pure super_admin from /admin and sends to /super-admin
  - resolves gym_id from tenant context or profile
  - rejects missing gym_id
  - returns gym-scoped auth context
```

## 8. Database Access Rules

Gym Admin queries must always use `gym_id = current_user.gym_id` or an equivalent branch relationship.

### Required Scope Rules

| Table | Gym Admin Access Rule |
| --- | --- |
| `gyms` | `id = current_user.gym_id` |
| `branches` | `gym_id = current_user.gym_id` |
| `profiles` | user belongs to same gym through role/profile |
| `user_roles` | role assignment gym equals current gym |
| `members` | `gym_id = current_user.gym_id` |
| `membership_plans` | `gym_id = current_user.gym_id` or inherited organization plan read-only |
| `memberships` | `gym_id = current_user.gym_id` |
| `trainers` | `gym_id = current_user.gym_id` |
| `staff_profiles` | `gym_id = current_user.gym_id` |
| `attendance_sessions` | `gym_id = current_user.gym_id` |
| `attendance_logs` | `gym_id = current_user.gym_id` |
| `classes` | `gym_id = current_user.gym_id` |
| `class_sessions` | `gym_id = current_user.gym_id` |
| `class_bookings` | `gym_id = current_user.gym_id` |
| `payments` | `gym_id = current_user.gym_id` |
| `invoices` | `gym_id = current_user.gym_id` |
| `leads` | `gym_id = current_user.gym_id` |
| `inventory_items` | `gym_id = current_user.gym_id` |
| `communications` | recipient or gym belongs to current gym |
| `audit_logs` | `gym_id = current_user.gym_id` |

### RLS Policy Pattern

```text
Allow SELECT when:
  user has gym_admin role
  and target.gym_id = current_user_gym_id()

Allow INSERT when:
  user has gym_admin role
  and new.gym_id = current_user_gym_id()

Allow UPDATE when:
  user has gym_admin role
  and old.gym_id = current_user_gym_id()
  and new.gym_id = current_user_gym_id()

Allow DELETE:
  avoid hard delete
  prefer archived, inactive, cancelled, or suspended status
```

Forbidden:

```text
Gym Admin can set arbitrary gym_id
Gym Admin can assign organization_owner or super_admin
Gym Admin can view payments from another gym
Gym Admin can query members without gym_id filter
Gym Admin can mutate attendance history without audit correction
Gym Admin can access platform settings
```

## 9. Analytics Architecture

Gym Admin analytics are gym-scoped and operational.

Dimensions:

- Gym
- Branch
- Date
- Membership plan
- Trainer
- Class
- Payment method
- Lead source
- Staff member

Metrics:

| Area | Metrics |
| --- | --- |
| Revenue | daily revenue, monthly revenue, PT revenue, class revenue, refunds, pending payments |
| Membership | active memberships, expired memberships, renewal rate, churn rate, plan popularity |
| Attendance | visits, current occupancy, peak hours, inactive members, average duration |
| Trainer | assigned members, sessions completed, PT revenue, utilization, retention |
| Classes | attendance, bookings, no-shows, fill rate, waitlist volume |
| Leads | new leads, follow-ups due, trial conversions, source conversion |
| Inventory | stock value, low stock, sales, purchases, vendor spend |

Recommended data model:

- `gym_daily_metrics`
- `gym_revenue_snapshots`
- `gym_attendance_snapshots`
- `gym_trainer_snapshots`
- `gym_class_snapshots`
- `gym_inventory_snapshots`

Cache key format:

```text
gym:{gym_id}:dashboard:{date_range}:{branch_filter}
gym:{gym_id}:report:{report_key}:{filters_hash}
```

## 10. Security Model

Mandatory security rules:

1. Gym Admin can only access assigned gym.
2. Gym Admin cannot access other gyms.
3. Gym Admin cannot access other organizations.
4. Gym Admin cannot access organization-level settings unless explicitly delegated.
5. Gym Admin cannot manage SaaS billing.
6. Gym Admin cannot manage platform domains.
7. Gym Admin cannot assign global roles.
8. Every mutation validates `gym_id` server-side.
9. Every sensitive action must be audited.
10. Every export must be audited.
11. Destructive actions require confirmation.
12. Payment operations require idempotency and audit records.
13. File uploads must be validated and stored in gym-scoped paths.
14. AI features must only use gym-scoped data.

Sensitive actions:

- Suspend member.
- Cancel membership.
- Freeze membership.
- Issue refund.
- Delete or archive records.
- Deactivate staff.
- Deactivate trainer.
- Cancel class.
- Export financial report.
- Change tax, receipt, invoice, or attendance rules.
- Assign roles.
- Bulk communication send.

## 11. UI Navigation Flow

```text
Gym Admin Login
  -> Resolve authenticated user
  -> Verify gym_admin role
  -> Resolve gym_id
  -> Reject missing or mismatched gym scope
  -> Load /admin dashboard

Daily Operation
  -> Dashboard
  -> Quick action
    -> Add member
    -> Check-in member
    -> Collect payment
    -> Create class

Member Workflow
  -> Members
  -> Search member
  -> Open profile
  -> Manage membership/payment/attendance/workout/nutrition
  -> Audit action

Attendance Workflow
  -> Attendance
  -> Scan QR or search member
  -> Validate active membership
  -> Check-in or deny access
  -> Write attendance/access logs

Payment Workflow
  -> Payments
  -> Select member/invoice
  -> Collect payment
  -> Generate receipt
  -> Update financial records
  -> Audit action

Reports Workflow
  -> Reports
  -> Select report
  -> Apply filters
  -> Generate preview
  -> Export if needed
  -> Audit export
```

## 12. Gym Operations Workflow

### Morning Opening

1. Gym Admin reviews dashboard.
2. Checks today's staff shifts.
3. Reviews classes scheduled today.
4. Checks pending payments and renewals.
5. Verifies attendance devices and QR scanner availability.

### Member Onboarding

1. Create member.
2. Assign membership plan.
3. Upload documents.
4. Collect payment.
5. Generate invoice and receipt.
6. Assign trainer if applicable.
7. Send welcome communication.
8. Audit all actions.

### Attendance Rush

1. Reception scans QR or searches member.
2. System validates same gym and active membership.
3. Member is checked in or denied with clear reason.
4. Occupancy updates.
5. Duplicate attempts are logged.

### Membership Renewal

1. Dashboard shows renewal due.
2. Staff opens member profile.
3. Reviews current plan and payment history.
4. Selects renewal plan.
5. Collects payment.
6. Extends membership.
7. Sends receipt and renewal confirmation.

### Trainer Assignment

1. Gym Admin opens trainer dashboard.
2. Reviews workload and specialization.
3. Assigns or reassigns member.
4. Trainer receives notification.
5. Assignment history is recorded.

### End of Day

1. Review daily attendance.
2. Review revenue collected.
3. Reconcile cash.
4. Review pending payments.
5. Review unresolved leads.
6. Export daily report if needed.
7. Audit events remain available.

## 13. Acceptance Criteria

The Gym Admin role is complete when:

- Gym Admin can access `/admin`.
- Gym Admin cannot access `/organization` unless also assigned Organization Owner.
- Gym Admin cannot access `/super-admin`.
- Gym Admin sees only own gym data.
- All admin pages load using resolved `gym_id`.
- All server actions validate same-gym ownership.
- Direct URL access to another gym's member/trainer/class returns not found or unauthorized.
- Role assignment rejects `super_admin` and `organization_owner`.
- Payments, attendance, classes, members, and trainers reject cross-gym IDs.
- Reports export only own gym data.
- All exports and sensitive actions write audit logs.
- Gym settings cannot mutate organization-level or platform-level settings.

## 14. Implementation Priority

Immediate:

- Maintain `requireGymAdminScope()`.
- Ensure all `/admin` pages use gym-scoped services.
- Ensure all admin mutations validate same-gym records.
- Keep Organization Owner and Super Admin out of `/admin` unless they also hold a gym operational role.

Pre-launch:

- Complete inventory module.
- Complete lead module.
- Add gym-specific security page.
- Add staff shift management.
- Add report export queue.

Post-launch:

- Biometric device integration.
- Advanced POS/inventory sales.
- AI-assisted retention workflows.
- Advanced staff scheduling.
- Automated cash reconciliation.
