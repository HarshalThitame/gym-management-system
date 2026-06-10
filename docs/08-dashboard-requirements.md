# 08 - Dashboard Requirements

## 1. Dashboard Design Principles

- Dashboards must be role-specific and action-oriented.
- Each widget must show loading, empty, error, and permission-restricted states.
- Dashboard metrics must be scoped to the authenticated user's `gym_id` and role.
- Date-sensitive widgets should default to the current month unless another window is more useful.
- Staff dashboards should favor dense, scan-friendly operational layouts over marketing-style cards.

## 2. Admin Dashboard

### 2.1 Admin Dashboard Overview

Purpose: Give gym admins a real-time view of revenue, members, attendance, leads, and operational exceptions.

Default date range: Current month, with quick filters for today, 7 days, 30 days, current month, previous month, custom.

### 2.2 Widgets

#### Revenue Widget

| Field | Requirement |
| --- | --- |
| Purpose | Show revenue collected and payment health. |
| Data | Captured payments, offline payments, refunds, failed payments. |
| Metrics | Total revenue, online revenue, offline revenue, failed payment count, refund amount. |
| Visualization | Metric cards plus line/bar chart by day or month. |
| Filters | Date range, payment method, membership plan. |
| Actions | View revenue report, open payments list. |
| Empty State | "No payments recorded for this period." |
| Permissions | Gym Admin full; Reception limited summary if allowed. |

#### Active Members Widget

| Field | Requirement |
| --- | --- |
| Purpose | Track current membership base. |
| Data | Members and active memberships. |
| Metrics | Active members, new members this month, expired members, trial members. |
| Visualization | Metric cards and trend indicator. |
| Filters | Date range, plan, trainer. |
| Actions | View members, add member. |
| Empty State | "No active members yet." |
| Permissions | Gym Admin, Reception Staff. |

#### Expiring Memberships Widget

| Field | Requirement |
| --- | --- |
| Purpose | Surface renewal opportunities and retention risk. |
| Data | Active memberships with `end_date` within configured window. |
| Metrics | Expiring in 7 days, expiring in 15 days, expired unpaid. |
| Visualization | Table with member, phone, plan, expiry date, renewal status. |
| Filters | Expiry window, plan, assigned trainer. |
| Actions | Open member, send reminder, create renewal payment. |
| Empty State | "No memberships expiring in this window." |
| Permissions | Gym Admin, Reception Staff. |

#### Attendance Trends Widget

| Field | Requirement |
| --- | --- |
| Purpose | Understand gym usage and engagement. |
| Data | Attendance records and class attendance. |
| Metrics | Total check-ins, average daily attendance, peak day/time, low-attendance members count. |
| Visualization | Line chart by day, heatmap by time in later phase. |
| Filters | Date range, attendance type, class. |
| Actions | View attendance report. |
| Empty State | "No attendance recorded for this period." |
| Permissions | Gym Admin, Reception Staff limited. |

#### Lead Conversion Widget

| Field | Requirement |
| --- | --- |
| Purpose | Track sales pipeline health. |
| Data | Leads, status changes, converted members. |
| Metrics | New leads, contacted, trial scheduled, converted, lost, conversion rate. |
| Visualization | Funnel chart and source breakdown. |
| Filters | Date range, source, assigned staff. |
| Actions | View leads, create lead, follow up. |
| Empty State | "No leads captured for this period." |
| Permissions | Gym Admin, Reception Staff. |

#### Additional Admin Widgets

| Widget | Purpose | Primary Action |
| --- | --- | --- |
| Payment Exceptions | Show failed, pending, or unreconciled payments. | Open payment detail. |
| Today's Classes | Show schedule, capacity, trainer, attendance state. | Open class detail. |
| Recent Activity | Show audit-backed important events. | Open entity detail. |
| Trainer Load | Show assigned member count per trainer. | Open trainer detail. |
| Website Content Status | Show draft/unpublished blogs, testimonials, gallery. | Open content admin. |

### 2.3 Admin Dashboard Data Contract

| Data Block | Required Fields |
| --- | --- |
| Revenue summary | `total_amount`, `online_amount`, `offline_amount`, `refund_amount`, `failed_count`, `series[]` |
| Member summary | `active_count`, `new_count`, `trial_count`, `expired_count`, `trend_percent` |
| Expiring memberships | `member_id`, `member_name`, `phone`, `plan_name`, `end_date`, `days_remaining`, `assigned_trainer` |
| Attendance trends | `total_checkins`, `average_daily`, `series[]`, `peak_time` |
| Lead conversion | `new_count`, `contacted_count`, `trial_count`, `converted_count`, `lost_count`, `conversion_rate`, `source_breakdown[]` |

## 3. Trainer Dashboard

### 3.1 Trainer Dashboard Overview

Purpose: Help trainers manage assigned members, upcoming sessions/classes, and pending fitness plan work.

### 3.2 Widgets

#### Assigned Members Widget

| Field | Requirement |
| --- | --- |
| Purpose | Show members assigned to the trainer. |
| Data | Members where `assigned_trainer_id` matches trainer. |
| Metrics | Assigned member count, active memberships, low-attendance members, members without active plan. |
| Visualization | Searchable list with status badges. |
| Filters | Membership status, goal, plan status. |
| Actions | Open member detail, create workout plan, create diet plan. |
| Empty State | "No assigned members yet." |
| Permissions | Trainer own assignments, Admin optional. |

#### Upcoming Sessions/Classes Widget

| Field | Requirement |
| --- | --- |
| Purpose | Show trainer's upcoming classes and sessions. |
| Data | Classes assigned to trainer and future personal sessions if added later. |
| Metrics | Today's classes, upcoming class count, booked members, capacity. |
| Visualization | Schedule list by date/time. |
| Filters | Today, this week, all upcoming. |
| Actions | Open class detail, mark attendance. |
| Empty State | "No upcoming classes." |
| Permissions | Trainer assigned classes. |

#### Plan Updates Widget

| Field | Requirement |
| --- | --- |
| Purpose | Surface members needing workout or diet plan updates. |
| Data | Member assignments, active workout plans, active diet plans, plan expiry dates. |
| Metrics | Members without workout plan, members without diet plan, plans expiring soon. |
| Visualization | Task list. |
| Actions | Create/update plan. |
| Empty State | "No pending plan updates." |
| Permissions | Trainer assigned members. |

### 3.3 Trainer Dashboard Data Contract

| Data Block | Required Fields |
| --- | --- |
| Assigned member summary | `total_assigned`, `active_members`, `low_attendance_count`, `missing_workout_count`, `missing_diet_count` |
| Assigned members list | `member_id`, `name`, `membership_status`, `goal`, `last_attendance_at`, `workout_plan_status`, `diet_plan_status` |
| Upcoming classes | `class_id`, `title`, `start_at`, `end_at`, `capacity`, `booked_count`, `status` |

## 4. Member Dashboard

### 4.1 Member Dashboard Overview

Purpose: Give members quick visibility into membership status, attendance, upcoming classes, plans, payments, and notifications.

### 4.2 Widgets

#### Membership Status Widget

| Field | Requirement |
| --- | --- |
| Purpose | Show member's current plan and renewal state. |
| Data | Active or latest membership and plan. |
| Metrics | Plan name, status, start date, end date, days remaining. |
| Visualization | Status card with color-coded state. |
| Actions | Renew, view details, pay pending invoice. |
| Empty State | "No active membership. Choose a plan to get started." |
| Permissions | Member own data. |

#### Attendance Widget

| Field | Requirement |
| --- | --- |
| Purpose | Show member engagement and visit history. |
| Data | Member attendance records. |
| Metrics | Visits this month, last visit, current streak optional. |
| Visualization | Small trend chart or calendar strip. |
| Actions | View attendance history. |
| Empty State | "No attendance recorded yet." |
| Permissions | Member own data. |

#### Upcoming Classes Widget

| Field | Requirement |
| --- | --- |
| Purpose | Show member's booked classes and available next actions. |
| Data | Upcoming class bookings. |
| Metrics | Next class, upcoming booking count. |
| Visualization | Compact list with date/time and trainer. |
| Actions | View bookings, book class, cancel booking if allowed. |
| Empty State | "No upcoming classes. Browse the schedule." |
| Permissions | Member own bookings. |

#### Workout Plan Widget

| Field | Requirement |
| --- | --- |
| Purpose | Surface assigned workout plan. |
| Data | Active published workout plan. |
| Metrics | Plan title, trainer, updated date. |
| Visualization | Summary card. |
| Actions | View workout plan. |
| Empty State | "No workout plan assigned yet." |
| Permissions | Member own plan. |

#### Diet Plan Widget

| Field | Requirement |
| --- | --- |
| Purpose | Surface assigned diet plan. |
| Data | Active published diet plan. |
| Metrics | Plan title, trainer, updated date. |
| Visualization | Summary card. |
| Actions | View diet plan. |
| Empty State | "No diet plan assigned yet." |
| Permissions | Member own plan. |

#### Notifications Widget

| Field | Requirement |
| --- | --- |
| Purpose | Show unread operational messages. |
| Data | Unread notifications. |
| Metrics | Unread count. |
| Visualization | Notification list. |
| Actions | Mark read, open related item. |
| Empty State | "No new notifications." |
| Permissions | Member own notifications. |

### 4.3 Member Dashboard Data Contract

| Data Block | Required Fields |
| --- | --- |
| Membership | `membership_id`, `plan_name`, `status`, `start_date`, `end_date`, `days_remaining`, `renewal_allowed` |
| Attendance | `visits_this_month`, `last_visit_at`, `series[]` |
| Upcoming classes | `booking_id`, `class_id`, `title`, `start_at`, `trainer_name`, `status`, `can_cancel` |
| Plans | `workout_plan_id`, `diet_plan_id`, `title`, `trainer_name`, `updated_at` |
| Notifications | `notification_id`, `title`, `type`, `created_at`, `target_type`, `target_id` |

## 5. Dashboard Access and Empty State Rules

| Role | Default Dashboard | Empty State Priority |
| --- | --- | --- |
| Super Admin | Super admin/global dashboard or admin dashboard for selected gym. | Prompt to create/select gym. |
| Gym Admin | Admin Dashboard | Prompt to create plan, add member, configure payment. |
| Reception Staff | Limited Admin/Reception Dashboard | Prompt to add lead/member or record attendance. |
| Trainer | Trainer Dashboard | Prompt to wait for assignments or update own profile. |
| Member | Member Dashboard | Prompt to complete profile, choose plan, or renew membership. |
| Guest | No dashboard | Prompt to register, book trial, or view plans. |

## 6. Dashboard Performance Requirements

- Dashboard queries must avoid N+1 loading.
- Use pre-aggregated views or cached report endpoints for high-volume data.
- Dashboard cards should load independently where possible to avoid blocking the whole page.
- Default date range should keep queries small.
- Paginate lists inside widgets and link to full reports for complete data.

