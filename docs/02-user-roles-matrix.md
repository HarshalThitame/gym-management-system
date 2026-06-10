# 02 - User Roles and Permissions Matrix

## 1. Role Model Overview

The system uses role-based access control with server-side authorization and database row-level security. Roles are assigned to authenticated users. A user may have one primary role in MVP; future phases can support multiple roles per gym or branch.

Recommended role hierarchy:

1. Super Admin
2. Gym Admin
3. Reception Staff
4. Trainer
5. Member
6. Guest Visitor

Guest visitors are unauthenticated users and do not have a stored role until they register or submit a lead form.

## 2. Role Definitions

### Super Admin

| Area | Definition |
| --- | --- |
| Responsibilities | Platform ownership, tenant/gym setup, global settings, billing oversight, data governance, escalation support. |
| Permissions | Full access across all gyms, users, settings, reports, audit logs, and system configuration. |
| Dashboard Access | Super admin dashboard, gym admin dashboards, reports across all gyms. |
| Actions Allowed | Create gyms, assign gym admins, manage global roles, suspend users, review audit logs, configure integrations. |
| Data Visibility | All data across all tenants/gyms. |

### Gym Admin

| Area | Definition |
| --- | --- |
| Responsibilities | Day-to-day gym operations, member management, plans, payments, trainers, content, reports, settings. |
| Permissions | Full operational access within assigned gym. Cannot access other gyms unless explicitly assigned. |
| Dashboard Access | Admin dashboard for assigned gym. |
| Actions Allowed | Manage members, trainers, plans, payments, attendance, classes, leads, reports, website content, settings. |
| Data Visibility | All operational and business data for assigned gym. |

### Reception Staff

| Area | Definition |
| --- | --- |
| Responsibilities | Front desk work: inquiries, trials, walk-ins, member onboarding, payment entry, attendance entry, renewal follow-up. |
| Permissions | Limited operational access. Cannot change critical settings or delete records. |
| Dashboard Access | Reception-focused dashboard or filtered admin dashboard. |
| Actions Allowed | Create leads, create members, update member contact details, record attendance, record offline payments, view plans, follow up with expiring members. |
| Data Visibility | Members, memberships, leads, attendance, and payment summaries needed for front-desk work. Restricted financial reports and settings. |

### Trainer

| Area | Definition |
| --- | --- |
| Responsibilities | Coach assigned members, manage workout and diet plans, conduct classes, track session attendance, communicate plan updates. |
| Permissions | Access assigned members and classes. Cannot view unrelated payment details or admin reports. |
| Dashboard Access | Trainer dashboard. |
| Actions Allowed | View assigned members, view member goals and attendance, update workout plans, update diet plans, view own classes, mark class attendance where assigned. |
| Data Visibility | Assigned members, assigned classes, own profile, plan templates, relevant attendance. |

### Member

| Area | Definition |
| --- | --- |
| Responsibilities | Manage own profile, view membership, make payments, book classes, follow plans, read notifications. |
| Permissions | Self-service access only. |
| Dashboard Access | Member dashboard. |
| Actions Allowed | Update allowed profile fields, view membership, renew plan, pay online, view attendance, book/cancel classes, view workout and diet plans, read notifications. |
| Data Visibility | Own data only. Public content remains visible. |

### Guest Visitor

| Area | Definition |
| --- | --- |
| Responsibilities | Browse website, submit inquiry, book free trial, start purchase flow. |
| Permissions | Public read access and form submission. |
| Dashboard Access | None. |
| Actions Allowed | View public pages, submit forms, click WhatsApp, subscribe newsletter, initiate registration or checkout. |
| Data Visibility | Public website content only. |

## 3. Permission Matrix

Legend:

- Full: create, read, update, archive/delete where allowed
- Manage: create, read, update, archive; delete restricted where data integrity matters
- View: read-only
- Own: own records only
- Assigned: records assigned to that user
- None: no access

| Module | Super Admin | Gym Admin | Reception Staff | Trainer | Member | Guest |
| --- | --- | --- | --- | --- | --- | --- |
| Public website pages | Full | Manage | View | View | View | View |
| Website content CMS | Full | Manage | None | None | None | View published |
| Gym settings | Full | Manage | View limited | None | None | None |
| User accounts | Full | Manage gym users | Create member, view limited | Own | Own | None |
| Roles and permissions | Full | Assign gym roles | None | None | None | None |
| Member profiles | Full | Manage | Manage limited | Assigned view | Own | None |
| Medical/fitness notes | Full | Manage | View limited | Assigned manage | Own view where allowed | None |
| Membership plans | Full | Manage | View | View | View active | View active |
| Membership records | Full | Manage | Manage limited | Assigned view limited | Own | None |
| Payments | Full | Manage | Record/view limited | None | Own | None |
| Payment refunds | Full | Manage with approval | None | None | None | None |
| Attendance | Full | Manage | Manage | Assigned view/mark class | Own view | None |
| Classes | Full | Manage | View/booking assist | Assigned manage | Book eligible | View public classes if published |
| Class bookings | Full | Manage | Manage | Assigned view/mark | Own manage | None |
| Trainers | Full | Manage | View | Own profile | View published/assigned | View published |
| Workout plans | Full | View/manage | View limited | Assigned manage | Own view | None |
| Diet plans | Full | View/manage | View limited | Assigned manage | Own view | None |
| Leads | Full | Manage | Manage | View assigned follow-ups optional | Own submissions optional | Submit |
| Reports | Full | Manage | View operational only | Own workload | Own history | None |
| Notifications | Full | Manage | Send operational | Send to assigned members | Own | None |
| Audit logs | Full | View gym logs | None | None | None | None |
| Integrations | Full | Manage gym integrations | None | None | None | None |

## 4. Dashboard Access Matrix

| Dashboard | Super Admin | Gym Admin | Reception Staff | Trainer | Member | Guest |
| --- | --- | --- | --- | --- | --- | --- |
| Public website | Yes | Yes | Yes | Yes | Yes | Yes |
| Super admin dashboard | Yes | No | No | No | No | No |
| Admin dashboard | Yes | Yes | Limited | No | No | No |
| Reception dashboard | Yes | Yes | Yes | No | No | No |
| Trainer dashboard | Yes | Optional impersonation/audit only | No | Yes | No | No |
| Member dashboard | Yes for support with audit | Optional support view with audit | Limited support view | Assigned member limited view | Yes | No |

## 5. Detailed Action Matrix

| Action | Super Admin | Gym Admin | Reception Staff | Trainer | Member | Guest |
| --- | --- | --- | --- | --- | --- | --- |
| Submit inquiry | Yes | Yes | Yes | Yes | Yes | Yes |
| Book free trial | Yes | Yes | Yes | Yes | Yes | Yes |
| Register account | Yes | Yes | Yes | Yes | Yes | Yes |
| Add member manually | Yes | Yes | Yes | No | No | No |
| Edit member contact details | Yes | Yes | Yes | No | Own limited | No |
| Edit member membership status | Yes | Yes | Limited renewal actions | No | No | No |
| Create membership plan | Yes | Yes | No | No | No | No |
| Archive membership plan | Yes | Yes | No | No | No | No |
| Purchase membership online | Yes | Yes | Assisted | No | Yes | Yes after registration |
| Record offline payment | Yes | Yes | Yes | No | No | No |
| View full revenue reports | Yes | Yes | No | No | No | No |
| Record gym attendance | Yes | Yes | Yes | Optional assigned classes | No | No |
| Create class | Yes | Yes | No | No, unless delegated | No | No |
| Book class | Yes | Yes | Assisted | No | Yes | No |
| Cancel member booking | Yes | Yes | Yes | Assigned class only | Own booking within rules | No |
| Assign trainer to member | Yes | Yes | No | No | No | No |
| Update workout plan | Yes | Yes | No | Assigned member | No | No |
| Update diet plan | Yes | Yes | No | Assigned member | No | No |
| Publish blog | Yes | Yes | No | No | No | No |
| Publish testimonial | Yes | Yes | No | No | No | No |
| Upload gallery image | Yes | Yes | No | No | No | No |
| Send bulk notification | Yes | Yes | No | Assigned members only | No | No |
| Configure Razorpay | Yes | Yes if owner-approved | No | No | No | No |
| Configure Resend | Yes | Yes if owner-approved | No | No | No | No |
| View audit logs | Yes | Yes for gym | No | No | No | No |

## 6. Data Visibility Rules

| Data Type | Visibility Rule |
| --- | --- |
| User identity | User can view own identity. Staff can view identities required by their role. |
| Member profile | Member sees own profile. Staff sees profiles within assigned gym and permission. Trainers see assigned members. |
| Payments | Member sees own payments. Reception sees limited payment state. Admin sees full payment details. Trainers cannot view payment details. |
| Attendance | Member sees own attendance. Staff sees gym attendance. Trainers see assigned members or assigned classes. |
| Workout and diet plans | Member sees own published plans. Trainers see plans for assigned members. Admins can review. |
| Leads | Staff and admins see leads for assigned gym. Guest does not see lead records after submission unless a portal feature is added. |
| Reports | Admins see aggregate business reporting. Reception sees operational reports only. |
| Audit logs | Super Admin sees all. Gym Admin sees own gym. Other roles cannot access. |

## 7. Permission Implementation Notes

- Store roles in a `roles` table and user-role assignments in a join table or profile table, depending on MVP complexity.
- Include `gym_id` on operational records to enable tenant-aware filtering.
- Enforce authorization in three layers:
  1. UI navigation and component visibility for usability.
  2. Server-side checks in Server Actions or Route Handlers.
  3. PostgreSQL row-level security for final data protection.
- Do not rely on client-side role checks for security.
- Audit all role changes, payment status changes, membership edits, trainer assignments, and manual attendance edits.

