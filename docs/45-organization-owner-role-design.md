# Organization Owner Role Design and Permission Architecture

## 1. Purpose

The Organization Owner is the tenant-level executive and operator for one organization in the Gym Management SaaS Platform.

They sit below Super Admin and above Gym Admin:

```text
Super Admin
  -> Organization Owner
    -> Gym Admin
      -> Reception Staff
      -> Trainer
      -> Member
```

An Organization Owner may manage one gym, multiple gyms, or a franchise group, but only inside their own organization. They must never access another organization's data, platform owner data, global SaaS settings, or Super Admin functions.

## 2. Access Scope

Organization Owner can access:

| Scope | Access |
| --- | --- |
| Own organization | Full tenant-level management |
| Gyms in own organization | View, create, update, activate, deactivate |
| Branches in own organization | View, create, update, activate, deactivate |
| Staff in own organization | Create, update, deactivate, assign roles within allowed staff roles |
| Trainers in own organization | Manage profiles, assignments, performance visibility |
| Members in own organization | View and manage operational member records |
| Revenue in own organization | View revenue, payments, invoices, reports |
| Analytics in own organization | View executive and operational analytics |
| Branding in own organization | Manage tenant branding and white label settings |
| Domains in own organization | Add, verify, remove organization domains |
| Subscription and billing | View current SaaS subscription, invoices, usage, renewals |
| Audit logs | View organization-scoped audit and activity logs |

Organization Owner cannot access:

| Restricted Area | Reason |
| --- | --- |
| Other organizations | Tenant isolation |
| Other gyms outside organization | Tenant isolation |
| Platform settings | Super Admin only |
| Global SaaS plans | Super Admin only |
| Platform revenue | Super Admin only |
| System monitoring | Super Admin only |
| Global billing | Super Admin only |
| Super Admin users | Platform security |
| Other tenant data | Privacy and compliance |

## 3. Permission Matrix

Actions:

- `R` = read
- `C` = create
- `U` = update
- `D` = delete
- `A` = approve or activate
- `E` = export
- `B` = billing action

| Module | Read | Create | Update | Delete | Activate or Approve | Export | Billing | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Organization Dashboard | R | - | - | - | - | E | - | Own organization only |
| Organization Profile | R | - | U | - | - | - | - | Cannot transfer SaaS ownership without Super Admin |
| Gym Management | R | C | U | Soft delete only | A | E | - | Own organization only |
| Branch Management | R | C | U | Soft delete only | A | E | - | Own organization only |
| Staff Management | R | C | U | Deactivate only | A | E | - | Allowed roles only |
| Member Management | R | C | U | Deactivate only | Suspend/reactivate | E | - | Own organization members only |
| Membership Plans | R | C | U | Archive only | A | E | - | Organization or gym-scoped plans |
| Revenue Reports | R | - | - | - | - | E | - | Own organization revenue only |
| Payments | R | - | Limited corrections | - | Refund request only | E | B | Refund approval can be policy-gated |
| Invoices | R | - | - | - | - | E | B | Download organization invoices |
| Trainer Management | R | C | U | Deactivate only | A | E | - | Own organization trainers only |
| Attendance | R | - | - | - | - | E | - | No direct tampering with attendance records |
| Classes | R | C | U | Cancel/archive only | A | E | - | Own gyms only |
| Nutrition | R | C | U | Archive only | A | E | - | Manage templates and view compliance |
| Communication | R | C | U | Archive only | Approve/send | E | - | Own audiences only |
| Analytics | R | C saved views | U saved views | D saved views | - | E | - | Organization analytics only |
| Branding | R | C | U | - | Publish | - | - | Tenant branding only |
| Domains | R | C | U | Remove | Verify request | - | - | Domain ownership proof required |
| Subscription | R | - | Update billing preferences | - | Upgrade/downgrade request | E | B | Cannot create SaaS plans |
| Support | R | C | U own tickets | - | Escalate | E | - | Own organization tickets |
| Audit and Compliance | R | - | - | - | - | E | - | Immutable logs |

## 4. Detailed Module Permissions

### Module 1: Organization Dashboard

Dashboard widgets:

- Total gyms
- Total branches
- Total staff
- Total trainers
- Total members
- Active members
- New members this month
- Membership revenue
- Personal training revenue
- Total revenue
- Pending renewals
- Expired memberships
- Attendance summary
- Top performing gyms
- Growth metrics
- Recent activities

Permissions:

- View all metrics for own organization.
- Filter dashboard by gym, branch, date range, membership status, trainer, and program.
- Export dashboard snapshots as PDF or CSV.
- Cannot view platform revenue or other tenant metrics.

### Module 2: Organization Management

Allowed:

- Edit organization profile.
- Update logo.
- Update contact details.
- Update GST details.
- Update address.
- Manage business information.
- Manage legal information.
- View organization usage.
- View subscription details.

Restricted:

- Cannot delete organization permanently.
- Cannot change organization owner to an external user without Super Admin approval.
- Cannot edit platform-level tenant configuration.

### Module 3: Gym Management

Allowed:

- Create gym inside own organization.
- Edit gym details.
- Deactivate gym.
- Activate gym.
- Assign gym admin.
- Transfer gym admin.
- View gym statistics.
- View gym revenue.
- View gym growth.
- View gym capacity.
- View gym attendance.
- Manage gym configuration.

Gym details:

- Name
- Address
- Phone
- Email
- Operating hours
- Timezone
- Currency
- Capacity
- Status

Rules:

- Every gym must belong to `organization_id = current_user.organization_id`.
- Gym Admin assignment must create an audited role assignment with gym scope.
- Deactivation must not delete historical payments, attendance, or audit records.

### Module 4: Branch Management

Allowed:

- Create branch.
- Edit branch.
- Deactivate branch.
- Activate branch.
- Assign branch manager.
- Transfer branch ownership.
- Manage branch settings.
- View branch performance analytics.
- View branch revenue analytics.

Rules:

- Branch must belong to a gym in the same organization.
- Branch-level settings cannot override platform security policies.
- Branch transfer can only happen between gyms in the same organization.

### Module 5: Staff Management

Allowed staff roles:

- Gym Admin
- Reception Staff
- Trainer
- Nutritionist
- Accountant

Allowed:

- Create staff.
- Edit staff.
- Deactivate staff.
- Activate staff.
- Reset password invitation.
- Assign staff to gym.
- Assign staff to branch.
- View staff performance.
- View staff attendance.
- View login history.

Restricted:

- Cannot create Super Admin.
- Cannot create Organization Owner for another organization.
- Cannot grant global permissions.
- Cannot read staff passwords.
- Cannot bypass MFA or password policy.

### Module 6: Member Management

Allowed:

- View all members inside organization.
- Search members.
- Add members.
- Suspend members.
- Transfer members between gyms in same organization.
- Export members.
- View member profiles.
- View membership status.
- View attendance history.
- View progress reports.
- View payment history.

Restricted:

- Cannot transfer members outside organization.
- Cannot permanently delete payment or attendance history.
- Cannot directly edit workout log details unless acting through a permitted trainer/admin workflow.
- Cannot view private notes marked trainer-only unless explicitly allowed by policy.

### Module 7: Membership Management

Allowed:

- Create membership plans.
- Edit plans.
- Disable plans.
- Assign plans.
- Manage pricing.
- Manage discounts.
- Manage offers.
- Manage coupons.

Membership types:

- Monthly
- Quarterly
- Half-yearly
- Annual
- Custom

Rules:

- Plans can be organization-wide or gym-specific.
- Coupons must have usage limits and expiry dates.
- Plan deletion should be archive-only after usage.
- Pricing changes must not mutate historical invoices.

### Module 8: Revenue Management

Allowed:

- View revenue reports.
- View branch revenue.
- View gym revenue.
- View membership revenue.
- View PT revenue.
- View payment collection.
- View outstanding payments.
- Download financial reports.

Restricted:

- Cannot view platform MRR or ARR.
- Cannot alter settled payment records.
- Refunds require configured approval policy.
- All financial exports are logged.

### Module 9: Trainer Management

Allowed:

- View trainers.
- Assign members.
- Reassign members.
- Track trainer performance.
- Track trainer revenue.
- Track PT sessions.
- Track client retention.
- View trainer utilization reports.

Rules:

- Trainer must belong to same organization.
- Assignment cannot cross organizations.
- Trainer revenue must be derived from source payment/session records.

### Module 10: Attendance Management

Allowed:

- View organization attendance dashboard.
- View branch attendance dashboard.
- View gym attendance dashboard.
- View peak hour analysis.
- View attendance trends.
- Export attendance.

Restricted:

- Cannot directly modify attendance records.
- Corrections require a formal adjustment workflow.
- QR/access attempts must remain immutable.

### Module 11: Class Management

Allowed:

- Create classes.
- Edit classes.
- Cancel classes.
- Assign trainers.
- Manage capacity.
- Manage waitlists.
- View booking reports.

Rules:

- Class must belong to a gym in own organization.
- Trainer assignment must respect trainer availability and same organization.
- Overbooking prevention must happen at database and application layer.

### Module 12: Nutrition Management

Allowed:

- Manage nutrition templates.
- Manage meal plans.
- View compliance reports.
- Track nutrition progress.

Rules:

- Organization Owner can manage templates.
- Individual nutrition records should be editable by assigned trainer/nutritionist or authorized staff only.
- Sensitive health data must remain organization-scoped and privacy controlled.

### Module 13: Communication Center

Allowed:

- Send announcements.
- Send bulk SMS.
- Send bulk WhatsApp.
- Send bulk email.
- Send push notifications.
- Manage campaigns.
- Manage audience segmentation.

Rules:

- Audience must be restricted to own organization.
- Opt-out preferences must be respected.
- Campaign exports and sends must be audited.
- High-volume sends should use queueing and rate limits.

### Module 14: Organization Analytics

Allowed analytics:

- Revenue analytics
- Growth analytics
- Retention analytics
- Churn analytics
- Trainer analytics
- Branch analytics
- Membership analytics
- Attendance analytics
- Forecasting reports

Rules:

- Analytics must be derived from organization-scoped data.
- Saved reports belong to organization scope.
- Exports must be logged.

### Module 15: White Label and Branding

Allowed:

- Upload organization logo.
- Upload favicon.
- Set primary color.
- Set secondary color.
- Select font.
- Select theme.
- Configure login branding.
- Configure email branding.
- Configure custom domain branding.

Restricted:

- Cannot override platform legal footer unless plan allows it.
- Cannot change global platform name.
- Cannot access another tenant's branding.

### Module 16: Domain Management

Allowed:

- Add domains.
- Verify domains.
- View SSL status.
- View DNS status.
- Remove domains.

Examples:

- `goldfitness.com`
- `goldfitness.in`
- `members.goldfitness.com`

Rules:

- Domain must be unique across all tenants.
- Domain verification must require DNS proof.
- SSL state is read-only unless provider integration supports automation.

### Module 17: Billing and Subscription

Allowed:

- View current plan.
- Upgrade plan.
- Downgrade plan.
- Renew plan.
- Purchase add-ons.
- Download invoices.
- View billing history.
- Manage payment methods.
- Manage auto-renewal settings.

Restricted:

- Cannot create SaaS plans.
- Cannot edit global subscription pricing.
- Cannot view platform-wide billing.

### Module 18: Support Center

Allowed:

- Create support tickets.
- Track ticket status.
- View ticket history.
- Escalate issues.
- Access documentation.

Rules:

- Tickets are organization-scoped.
- Attachments must be scanned and storage-scoped.
- Support communication history must be auditable.

### Module 19: Audit and Compliance

Allowed:

- View audit logs.
- View user activity logs.
- View staff actions.
- View security events.
- Export audit reports.

Rules:

- Logs are immutable.
- Organization Owner cannot delete audit logs.
- Exports must create a second audit event.
- Security events involving Super Admin remain Super Admin only unless they affected the organization.

## 5. Sidebar Navigation

Recommended sidebar:

```text
Organization
  Dashboard
  Organization Profile

Operations
  Gyms
  Branches
  Staff
  Members
  Memberships
  Trainers
  Attendance
  Classes
  Nutrition

Revenue
  Revenue Overview
  Payments
  Invoices
  Outstanding Balances
  Financial Reports

Engagement
  Communication Center
  Campaigns
  Announcements
  Segments

Intelligence
  Analytics
  Forecasts
  Reports

Brand and Access
  Branding
  Domains
  White Label

Administration
  Billing and Subscription
  Audit and Compliance
  Support Center
  Settings
```

Recommended routes:

| Route | Purpose |
| --- | --- |
| `/organization` | Executive dashboard |
| `/organization/profile` | Organization profile |
| `/organization/gyms` | Gym management |
| `/organization/branches` | Branch management |
| `/organization/staff` | Staff management |
| `/organization/members` | Member management |
| `/organization/memberships` | Plans and membership operations |
| `/organization/revenue` | Revenue dashboard |
| `/organization/trainers` | Trainer oversight |
| `/organization/attendance` | Attendance analytics |
| `/organization/classes` | Class oversight |
| `/organization/nutrition` | Nutrition templates and reports |
| `/organization/communications` | Campaigns and announcements |
| `/organization/analytics` | Business intelligence |
| `/organization/branding` | White label controls |
| `/organization/domains` | Domain management |
| `/organization/billing` | SaaS subscription and invoices |
| `/organization/support` | Support tickets |
| `/organization/audit` | Audit and compliance |
| `/organization/settings` | Tenant-level settings |

## 6. Dashboard Layout

Recommended desktop layout:

```text
Header
  Organization name
  Date filter
  Gym filter
  Branch filter
  Export button

Row 1: Executive KPIs
  Total Gyms
  Active Members
  Monthly Revenue
  Pending Renewals

Row 2: Operational KPIs
  Attendance Today
  Expired Memberships
  Staff Count
  Trainer Utilization

Row 3: Charts
  Revenue Trend
  Member Growth
  Attendance Trend

Row 4: Operational Tables
  Top Performing Gyms
  Expiring Memberships
  Recent Activity

Row 5: Alerts
  Billing Alerts
  Domain Alerts
  Security Events
  Support Tickets
```

Mobile layout:

- Sticky organization header.
- Horizontal KPI cards.
- Filter drawer.
- Bottom navigation for dashboard, gyms, members, revenue, more.
- Tables collapse into cards.
- Export actions move into overflow menu.

## 7. Module Architecture

Recommended feature module:

```text
features/organization-owner/
  actions/
    organization-actions.ts
    gym-actions.ts
    branch-actions.ts
    staff-actions.ts
    member-actions.ts
    billing-actions.ts
    branding-actions.ts
    domain-actions.ts
  components/
    organization-dashboard.tsx
    organization-sidebar.tsx
    organization-kpi-grid.tsx
    organization-filter-bar.tsx
    organization-audit-table.tsx
  lib/
    access.ts
    permissions.ts
    business-rules.ts
    analytics-rules.ts
  schemas/
    organization.ts
    gym.ts
    branch.ts
    staff.ts
    branding.ts
    domain.ts
  services/
    organization-service.ts
    organization-analytics-service.ts
    organization-billing-service.ts
    organization-audit-service.ts
  types/
    organization-owner.ts
```

Required access helper:

```text
requireOrganizationOwnerScope()
  - requires authenticated user
  - requires organization_owner role
  - resolves organization_id
  - rejects missing organization_id
  - rejects tenant mismatch
  - returns organization-scoped auth context
```

## 8. Database Access Rules

### Ownership Model

Recommended hierarchy:

```text
organizations.id
  -> gyms.organization_id
    -> branches.gym_id
    -> members.gym_id
    -> trainers.gym_id
    -> staff_profiles.gym_id
    -> payments.gym_id
    -> attendance_sessions.gym_id
    -> classes.gym_id
```

Organization-scoped queries must always use one of:

- `organization_id = current_user.organization_id`
- `gym_id in (select id from gyms where organization_id = current_user.organization_id)`
- `branch_id in (select branches.id from branches join gyms on gyms.id = branches.gym_id where gyms.organization_id = current_user.organization_id)`

### Required Tables and Scope Columns

| Table | Required Scope Rule |
| --- | --- |
| `organizations` | `id = current_user.organization_id` |
| `gyms` | `organization_id = current_user.organization_id` |
| `branches` | branch gym belongs to current organization |
| `branch_users` | branch gym belongs to current organization |
| `profiles` | user's roles/gym belong to current organization |
| `user_roles` | assigned gym belongs to current organization |
| `members` | member gym belongs to current organization |
| `trainers` | trainer gym belongs to current organization |
| `staff_profiles` | staff gym belongs to current organization |
| `membership_plans` | plan gym belongs to current organization or organization-scoped plan |
| `memberships` | membership gym belongs to current organization |
| `payments` | payment gym belongs to current organization |
| `invoices` | invoice gym belongs to current organization |
| `attendance_sessions` | session gym belongs to current organization |
| `classes` | class gym belongs to current organization |
| `class_bookings` | booking gym belongs to current organization |
| `communications` | recipient or gym belongs to current organization |
| `audit_logs` | log organization or gym belongs to current organization |

### RLS Rule Pattern

Organization Owner policies should follow this model:

```text
Allow SELECT when:
  user has role organization_owner
  and target record belongs to user's organization

Allow INSERT when:
  user has role organization_owner
  and new record organization_id equals user's organization_id
  or new record gym_id belongs to user's organization

Allow UPDATE when:
  user has role organization_owner
  and existing record belongs to user's organization
  and new scope still belongs to user's organization

Allow DELETE:
  avoid hard delete
  prefer status = archived/deactivated
```

### Forbidden RLS Pattern

Never allow:

```text
organization_owner can access all rows
organization_owner can set arbitrary organization_id
organization_owner can set arbitrary gym_id
organization_owner can assign super_admin
organization_owner can change global tenant_configs
```

## 9. Analytics Design

Organization analytics should aggregate across all gyms inside the organization.

Core dimensions:

- Organization
- Gym
- Branch
- Date
- Membership plan
- Trainer
- Class category
- Payment method
- Lead source

Core metrics:

| Area | Metrics |
| --- | --- |
| Revenue | total revenue, membership revenue, PT revenue, class revenue, refund total, outstanding amount |
| Membership | active members, expired members, churn rate, renewal rate, plan popularity |
| Attendance | visits, average duration, peak hours, inactive members |
| Trainer | assigned members, sessions completed, utilization, PT revenue, ratings |
| Classes | bookings, fill rate, no-shows, waitlist demand |
| Growth | new members, trials, conversion rate, branch growth |
| Communication | messages sent, open rate, click rate, renewal conversion |

Recommended aggregation:

- Daily organization KPI snapshots.
- Daily gym KPI snapshots.
- Materialized views for revenue, attendance, and membership analytics.
- Cached dashboard queries with tenant-aware cache keys.

Cache key format:

```text
organization:{organization_id}:dashboard:{date_range}:{gym_filter}:{branch_filter}
```

## 10. Security Rules

Mandatory rules:

1. Organization Owner can only access own organization.
2. Organization Owner cannot bypass organization isolation.
3. Every mutation must validate ownership server-side.
4. Every action must write an audit log.
5. Sensitive actions require confirmation.
6. Exports must be logged.
7. Role assignment must reject `super_admin`.
8. Role assignment must reject users outside organization.
9. Domain creation must validate global domain uniqueness.
10. Payment corrections and refunds must be audited.
11. Attendance records must be immutable except via correction workflow.
12. Soft delete is preferred for operational records.
13. File uploads must validate MIME type, extension, size, and storage path.
14. API and server actions must never trust client-provided organization IDs.

Sensitive actions:

- Deactivate gym
- Deactivate branch
- Deactivate staff
- Suspend member
- Transfer member
- Issue refund
- Export financial reports
- Change branding/domain
- Upgrade/downgrade subscription
- Assign roles
- Delete or archive records

## 11. UI Structure

Page structure:

```text
OrganizationPortalLayout
  OrganizationSidebar
  OrganizationTopbar
    Organization switch display, no cross-tenant switch
    Date range filter
    Gym filter
    Branch filter
    User menu
  Main content
    Page header
    KPI row
    Action toolbar
    Data views
    Audit/action footer when needed
```

UI principles:

- SaaS-style dense dashboard.
- No marketing-style hero sections in portal.
- Filters stay consistent across analytics, revenue, attendance, and members.
- All destructive actions use confirmation dialogs.
- All async actions show loading, success, and error states.
- All empty states explain what operational action creates data.

## 12. Organization Workflow Diagram

```text
Organization Owner Login
  -> Resolve authenticated user
  -> Resolve organization_owner role
  -> Resolve organization_id
  -> Verify tenant/domain belongs to organization
  -> Load organization dashboard

Manage Gym
  -> Create or edit gym
  -> Validate organization_id
  -> Persist gym
  -> Audit action
  -> Recalculate organization metrics

Assign Staff
  -> Select user or invite user
  -> Select role
  -> Select gym/branch
  -> Validate gym belongs to organization
  -> Reject global roles
  -> Create role assignment
  -> Audit action

Manage Members
  -> Search organization members
  -> Open member profile
  -> Validate member gym belongs to organization
  -> Perform allowed action
  -> Audit action

Export Report
  -> Select report and filters
  -> Validate all filters belong to organization
  -> Generate export
  -> Store export metadata
  -> Audit export
```

## 13. Acceptance Criteria

The Organization Owner portal is complete when:

- Organization Owner can only access `/organization` routes.
- Organization Owner cannot access `/super-admin`.
- Organization Owner cannot access `/admin` unless also assigned a gym-level operational role and using gym context.
- Every page filters by own organization.
- Every mutation validates organization ownership server-side.
- All exports create audit records.
- All role assignments are scoped to own organization and reject global roles.
- Domain management enforces global uniqueness.
- Billing pages show only own subscription and invoices.
- Analytics cannot include other tenant records.
- Direct URL access to other organization IDs fails.
- Direct API/server action payload tampering fails.

## 14. Implementation Priority

Immediate:

- `requireOrganizationOwnerScope()` helper.
- `/organization` portal layout and sidebar.
- Organization dashboard.
- Organization gyms, branches, staff, members, revenue, domains, audit.
- Server-side ownership validation in every organization action.

Pre-launch:

- Branding management.
- Subscription and billing self-service.
- Support center.
- Export logs.
- Organization analytics snapshots.

Post-launch:

- Advanced forecasting.
- Custom report builder.
- Multi-channel campaign automation.
- Domain provider automation.
- Advanced compliance request workflows.
