# Reception Staff Role Design and Permission Architecture

## 1. Purpose

Reception Staff is the front-desk operations role for a single assigned gym.

They sit below Gym Admin:

```text
Super Admin
  -> Organization Owner
    -> Gym Admin
      -> Reception Staff
      -> Trainer
      -> Member
```

Reception Staff should move fast through daily workflows: member registration, check-ins, renewals, payments, leads, appointments, class bookings, reminders, and member support. Their access must stay operational and limited. They must not access gym configuration, revenue analytics, organization data, SaaS billing, security settings, or other gyms.

## 2. Access Scope

Reception Staff can access:

| Scope | Access |
| --- | --- |
| Assigned gym | Operational access only |
| Assigned gym members | Register, search, update basic info, support |
| Assigned gym leads | Create, update, follow up, convert |
| Assigned appointments | Schedule, reschedule, cancel |
| Assigned attendance | Check-in, check-out, verify, daily views |
| Assigned payments | Collect and record payments |
| Assigned classes | Book members, cancel bookings, manage waitlists |
| Assigned communication tools | Individual reminders and basic announcements |
| Own audit history | Own actions and login history |

Reception Staff cannot access:

| Restricted Area | Reason |
| --- | --- |
| Other gyms | Gym isolation |
| Other organizations | Tenant isolation |
| Platform settings | Super Admin only |
| Organization settings | Organization Owner only |
| Gym settings | Gym Admin only |
| Revenue analytics | Management-only visibility |
| Trainer analytics | Gym Admin or higher |
| Advanced reports | Gym Admin or higher |
| System configuration | Super Admin only |
| Subscription management | Organization Owner or Super Admin |
| Security management | Gym Admin or higher |
| System-wide logs | Security and privacy |

## 3. Permission Matrix

Actions:

- `R` = read
- `C` = create
- `U` = update
- `D` = delete
- `A` = assign, activate, or operational approval
- `E` = export
- `P` = payment action

| Module | Read | Create | Update | Delete | Assign or Activate | Export | Payment | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Reception Dashboard | R | - | - | - | - | - | - | Own gym daily operations |
| Member Registration | R | C | U basic only | No | Assign plan | - | - | Cannot delete members |
| Membership Operations | R | C | U operational | No | Renew/freeze/resume/cancel per policy | - | - | Sensitive actions confirmed |
| Attendance Management | R | C check-in/out | Limited corrections | No | Verify access | E daily | - | Own gym only |
| Payment Collection | R | C | Limited notes/corrections | No | Mark paid where allowed | E daily | P | No refunds |
| Lead Management | R | C | U | Archive only if allowed | Assign follow-up | E daily | - | Own gym leads |
| Appointment Management | R | C | U | Cancel only | Assign trainer/slot | - | - | Own gym appointments |
| Class Bookings | R | C | U booking status | Cancel booking only | Waitlist operations | - | P limited | Own gym classes |
| Member Support | R | C notes | U notes/status | No | Escalate | - | - | No private system logs |
| Communication Center | R | C individual/basic | U drafts | Archive drafts | Send permitted messages | - | - | No bulk analytics |
| Document Management | R | C upload | U replace | No, unless policy | - | Download allowed | - | Member documents only |
| Daily Reports | R | C export request | - | - | - | E daily only | - | No advanced reports |
| Quick Action Center | R | C | U operational | No | Operational actions | - | P | 1-2 click workflows |
| Task Management | R | C own/task notes | U completion | No | Assign to self/escalate | - | - | Assigned gym tasks |
| Limited Audit Logs | R own | - | - | No | - | - | - | Own activity only |

## 4. Module Design

### Module 1: Reception Dashboard

Dashboard widgets:

- Today's check-ins
- Today's new members
- Today's renewals
- Pending renewals
- Today's payments
- Pending payments
- Today's appointments
- Today's trial visits
- Lead follow-ups
- Upcoming classes
- Announcements
- Recent activities
- Quick actions

Dashboard principles:

- Optimized for speed.
- Search always visible.
- Most common tasks reachable in 1-2 clicks.
- Shows only operational data needed for the current day.
- Avoids executive analytics and management-heavy charts.

### Module 2: Member Registration

Allowed:

- Create member.
- Edit basic member information.
- Upload member photo.
- Upload documents.
- Assign membership plan.
- Generate membership ID.
- Generate QR code.
- Capture emergency contact.
- Capture medical notes.
- View member profile.

Basic member fields:

- Full name
- Phone
- Email
- Date of birth
- Gender
- Address
- Emergency contact
- Medical notes
- Profile photo
- Document uploads

Rules:

- Member must be created with `gym_id = receptionist.gym_id`.
- Duplicate checks should run on phone and email.
- Medical notes are sensitive and must be audit-visible.
- QR generation must be same-gym only.

### Module 3: Membership Operations

Allowed:

- Create membership.
- Renew membership.
- Upgrade membership.
- Downgrade membership.
- Freeze membership.
- Resume membership.
- Cancel membership.
- View membership status.
- Track membership expiry.
- Trigger membership reminder workflow.

Restrictions:

- Cannot create organization-wide membership plans.
- Cannot change pricing rules globally.
- Cannot delete membership history.
- Cannot bypass business rules on expiry, cancellation, or freeze.

Rules:

- Membership operations require same-gym member and plan.
- Freeze, cancel, and downgrade require confirmation.
- Each action writes membership history and audit records.

### Module 4: Attendance Management

Allowed:

- QR check-in.
- Manual check-in.
- Attendance search.
- Attendance verification.
- View daily attendance.
- View member visit history.
- Handle missed check-ins through correction workflow.
- Monitor peak-hour occupancy.

Rules:

- Member must belong to assigned gym.
- Membership must be active and valid.
- QR tokens from other gyms must be rejected.
- Duplicate check-ins must be blocked.
- Access denials must be logged.

### Module 5: Payment Collection

Allowed:

- Collect membership payments.
- Collect PT payments.
- Record cash payments.
- Record UPI payments.
- Record card payments.
- Generate receipts.
- Print receipts.
- Email receipts.
- View payment history.
- View pending payments.

Restrictions:

- Cannot delete payments.
- Cannot refund payments.
- Cannot alter settled payments except allowed notes/corrections.
- Cannot view organization-level revenue analytics.

Rules:

- Payment must be same-gym.
- Payment receipt must include collector identity.
- Cash collection must appear in daily cash report.
- Failed or duplicate payments must be logged and escalated.

### Module 6: Lead Management

Allowed:

- Create leads.
- Edit leads.
- Assign follow-ups.
- Schedule calls.
- Schedule visits.
- Register trial member.
- Track lead conversion.
- Add lead notes.
- Update lead status.
- View lead pipeline.

Rules:

- Lead must be same-gym.
- Duplicate lead detection uses phone/email.
- Trial conversion creates member in same gym.
- Follow-ups should appear in task center.

### Module 7: Appointment Management

Allowed:

- Schedule appointments.
- Reschedule appointments.
- Cancel appointments.
- Schedule trainer meetings.
- Schedule consultations.
- Book PT consultations.
- Book trial sessions.

Rules:

- Appointments must belong to assigned gym.
- Trainer appointment requires trainer from same gym.
- Cancellation reason must be recorded.
- No-show and completed statuses should be tracked.

### Module 8: Class Bookings

Allowed:

- Book members into classes.
- Cancel bookings.
- Manage waitlists.
- View class capacity.
- View upcoming classes.
- Track attendance.

Rules:

- Member and class session must belong to same gym.
- Capacity rules must prevent overbooking.
- Waitlist promotion follows configured queue order.
- Cancellation windows must be enforced unless Gym Admin override is configured.

### Module 9: Member Support Center

Allowed:

- Search members.
- View member information.
- View membership status.
- View attendance summary.
- View payment summary.
- Handle general inquiries.
- Handle complaints.
- Create support notes.
- Escalate issues to Gym Admin.

Restrictions:

- Cannot view confidential security logs.
- Cannot modify trainer-private notes.
- Cannot delete complaints or support history.

### Module 10: Communication Center

Allowed:

- Send renewal reminders.
- Send payment reminders.
- Send appointment reminders.
- Send attendance notifications.
- Send individual messages.
- Send basic announcements.
- Send SMS.
- Send WhatsApp.
- Send email.
- Send push notifications.

Restrictions:

- Cannot send organization-wide campaigns.
- Cannot edit global templates.
- Cannot override opt-out preferences.
- Cannot view advanced campaign analytics.

Rules:

- Recipient must belong to assigned gym.
- Message templates should be approved by Gym Admin or higher.
- Every message send is logged.

### Module 11: Document Management

Allowed:

- Upload member documents.
- View member documents.
- Download documents.
- Update documents.
- Manage membership agreements.
- Manage identity documents.
- Manage medical declarations.

Rules:

- Files must be gym-scoped.
- Uploads must validate file type, size, and extension.
- Sensitive document access must be logged.
- Deletion should require Gym Admin permission unless document is a draft.

### Module 12: Daily Reports

Allowed daily reports:

- Daily attendance.
- Daily check-ins.
- Daily payments.
- New member registrations.
- Lead follow-ups.
- Renewals due.
- Trial visits.
- Reception performance.

Allowed:

- View daily reports.
- Export daily reports.

Restricted:

- Cannot view executive analytics.
- Cannot view multi-gym reports.
- Cannot view trainer performance analytics beyond operational scheduling needs.

### Module 13: Quick Action Center

Quick actions:

- Quick member registration.
- Quick check-in.
- Quick renewal.
- Quick payment.
- Quick appointment.
- Quick lead entry.
- Quick class booking.

Rules:

- Actions must be accessible within 1-2 clicks.
- Every quick action must still validate gym scope and business rules.
- Quick flows should use progressive disclosure, not long forms.

### Module 14: Task Management

Allowed:

- View assigned tasks.
- Complete assigned tasks.
- View pending follow-ups.
- Track renewal tasks.
- Track lead follow-ups.
- Track appointment tasks.
- Track member support tasks.
- Add completion notes.

Rules:

- Task visibility is own gym and assigned work.
- Escalation creates a Gym Admin-visible task.
- Completion timestamps and actor are recorded.

### Module 15: Limited Audit Logs

Allowed:

- View own activity.
- View own login history.
- View assigned tasks.

Restricted:

- Cannot view system-wide logs.
- Cannot view all staff actions.
- Cannot view security investigations.
- Cannot delete audit logs.

## 5. Sidebar Navigation Structure

Recommended sidebar:

```text
Front Desk
  Dashboard
  Quick Actions

Members
  Member Search
  Register Member
  Memberships
  Documents

Daily Operations
  Attendance
  Payments
  Appointments
  Classes

Sales
  Leads
  Trial Visits
  Follow-Ups

Support
  Member Support
  Communications
  Tasks

Reports
  Daily Reports
  My Activity
```

Recommended routes:

| Route | Purpose |
| --- | --- |
| `/reception` | Reception dashboard |
| `/reception/quick-actions` | Quick operational shortcuts |
| `/reception/members` | Member search and support |
| `/reception/members/new` | Member registration |
| `/reception/members/[memberId]` | Member profile, membership, documents |
| `/reception/memberships` | Membership operations |
| `/reception/attendance` | Check-in and attendance |
| `/reception/payments` | Payment collection |
| `/reception/appointments` | Appointment scheduling |
| `/reception/classes` | Class booking |
| `/reception/leads` | Lead pipeline |
| `/reception/trials` | Trial visit registration |
| `/reception/communications` | Reminders and messages |
| `/reception/tasks` | Assigned tasks and follow-ups |
| `/reception/reports` | Daily reports |
| `/reception/activity` | Own activity and login history |

## 6. Reception Dashboard Layout

Desktop layout:

```text
Header
  Search bar
  Current date
  Shift indicator
  Quick action buttons

Row 1: Fast Operations
  Quick Check-In
  Quick Registration
  Quick Payment
  Quick Renewal

Row 2: Today's Counters
  Check-Ins
  New Members
  Renewals Due
  Payments Collected

Row 3: Work Queues
  Pending Payments
  Lead Follow-Ups
  Appointments
  Trial Visits

Row 4: Schedule
  Upcoming Classes
  Trainer Consultations
  Member Appointments

Row 5: Activity
  Recent Member Actions
  Recent Payments
  Announcements
```

Mobile layout:

- Search first.
- Large quick-action buttons.
- Bottom navigation: Dashboard, Check-In, Members, Payments, More.
- Forms use single-column layout.
- Member result cards show phone, status, plan, quick action buttons.

## 7. Daily Operations Workflow

```text
Reception Login
  -> Validate active receptionist account
  -> Resolve assigned gym
  -> Load reception dashboard

Start Shift
  -> Review tasks
  -> Review appointments
  -> Review renewals due
  -> Review pending payments

During Shift
  -> Check in members
  -> Register new members
  -> Collect payments
  -> Schedule appointments
  -> Manage class bookings
  -> Follow up leads
  -> Send reminders

End Shift
  -> Review daily payments
  -> Export daily report if allowed
  -> Complete pending tasks
  -> Escalate unresolved issues
```

## 8. Member Registration Workflow

```text
Open Quick Registration
  -> Enter phone/email
  -> Duplicate check
  -> Enter basic details
  -> Capture emergency contact
  -> Capture medical notes
  -> Upload photo/documents
  -> Select membership plan
  -> Collect payment or mark pending
  -> Generate member ID
  -> Generate QR code
  -> Send welcome message
  -> Audit registration
```

Validation:

- Phone required.
- Full name required.
- Duplicate phone/email warning.
- Membership plan must belong to same gym.
- Payment amount must match selected plan unless discount authorized.

## 9. Membership Renewal Workflow

```text
Open Renewals Due
  -> Select member
  -> Review current membership
  -> Select renewal plan
  -> Confirm dates and amount
  -> Collect payment
  -> Generate invoice and receipt
  -> Extend membership
  -> Send renewal confirmation
  -> Audit renewal
```

Rules:

- Expired memberships can be renewed if policy allows.
- Cancelled memberships require Gym Admin approval or new membership creation.
- Discounts require allowed permission or configured coupon.

## 10. Lead Management Workflow

```text
Create Lead
  -> Capture name, phone, source, interest
  -> Assign follow-up date
  -> Add notes
  -> Schedule visit or call

Follow Up
  -> Open task
  -> Call/message lead
  -> Update status
  -> Schedule trial visit if interested

Convert Lead
  -> Create member from lead
  -> Assign membership or trial
  -> Mark lead converted
  -> Audit conversion
```

Lead statuses:

- New
- Contacted
- Visit scheduled
- Trial active
- Converted
- Not interested
- Lost

## 11. Payment Collection Workflow

```text
Open Payment
  -> Search/select member
  -> Select invoice or payment reason
  -> Select method: cash, UPI, card, online
  -> Confirm amount
  -> Submit payment
  -> Generate receipt
  -> Print/email receipt
  -> Update daily cash/payment report
  -> Audit payment
```

Rules:

- No refunds.
- No payment deletion.
- Duplicate payment prevention required.
- Cash reports must include collector identity.
- Failed online payment must remain pending and visible.

## 12. Security Model

Mandatory rules:

1. Reception Staff can only access assigned gym.
2. Reception Staff cannot access other gyms or organizations.
3. Reception Staff cannot access organization, platform, subscription, or system settings.
4. Reception Staff cannot view management analytics.
5. Every mutation validates `gym_id` server-side.
6. Every payment action is audited.
7. Every member record access is tracked where practical.
8. Sensitive actions require confirmation.
9. File uploads require validation.
10. Communication sends must respect opt-out preferences.
11. Exports are limited to daily operational reports and logged.
12. Reception Staff cannot assign elevated roles.

Sensitive actions:

- Freeze membership.
- Cancel membership.
- Mark payment as collected.
- Upload identity or medical documents.
- Edit medical notes.
- Cancel appointment.
- Cancel class booking.
- Send payment reminder.

## 13. Database Access Rules

Reception Staff queries must always use the assigned gym:

```text
gym_id = current_user_gym_id()
```

Required table rules:

| Table | Access Rule |
| --- | --- |
| `gyms` | read own assigned gym only |
| `branches` | read assigned gym branches only if needed |
| `members` | read/create/update basic fields where `gym_id = current_user_gym_id()` |
| `memberships` | read/create/update operational status where `gym_id = current_user_gym_id()` |
| `membership_plans` | read active own gym plans |
| `payments` | read/create own gym payments; no delete/refund |
| `invoices` | read/create own gym invoices |
| `attendance_sessions` | read/create check-in/out for own gym |
| `attendance_logs` | insert operational logs; read daily own gym logs |
| `qr_tokens` | create/regenerate for own gym members only |
| `leads` | read/create/update own gym leads |
| `appointments` | read/create/update own gym appointments |
| `classes` | read own gym classes |
| `class_bookings` | read/create/update own gym bookings |
| `notifications` | create own gym individual reminders |
| `member_documents` | read/upload/update own gym member documents |
| `support_notes` | read/create own gym support notes |
| `audit_logs` | insert actions; read own actor logs only |

RLS pattern:

```text
Allow SELECT when:
  user has reception_staff role
  and record.gym_id = current_user_gym_id()

Allow INSERT when:
  user has reception_staff role
  and new.gym_id = current_user_gym_id()
  and operation is allowed for reception

Allow UPDATE when:
  user has reception_staff role
  and old.gym_id = current_user_gym_id()
  and new.gym_id = current_user_gym_id()
  and updated fields are reception-allowed

Allow DELETE:
  normally deny
```

Forbidden:

```text
Reception Staff can delete members
Reception Staff can delete payments
Reception Staff can refund payments
Reception Staff can update another gym's record
Reception Staff can assign global roles
Reception Staff can view revenue analytics
Reception Staff can update gym settings
Reception Staff can access system logs
```

## 14. UI Requirements

Reception UI must prioritize speed:

- Large action buttons.
- Fast member search.
- One-click check-in.
- One-click renewal from member profile.
- One-click payment from pending dues.
- Minimal navigation depth.
- Mobile-friendly layouts.
- Keyboard-friendly forms.
- Clear success/error states.
- Prominent member status indicators.
- Payment and membership warnings visible before action.

Recommended quick action buttons:

- Register Member
- Check-In
- Renew
- Collect Payment
- Book Appointment
- Add Lead
- Book Class
- Send Reminder

## 15. Acceptance Criteria

Reception Staff role is complete when:

- Reception Staff can access only `/reception` or delegated front-desk routes.
- Reception Staff cannot access `/admin/settings`, `/organization`, or `/super-admin`.
- Reception Staff sees only assigned gym records.
- Member creation always writes assigned `gym_id`.
- Payment collection creates audit logs.
- Attendance check-in rejects other-gym members and QR tokens.
- Member search never returns other-gym members.
- Daily reports are own gym only.
- Refunds and payment deletion are unavailable.
- Advanced analytics and security settings are unavailable.
- All quick actions still enforce server-side permissions.
