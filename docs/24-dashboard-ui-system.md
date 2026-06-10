# 24 - Dashboard UI System

## 1. Dashboard Design Direction

Dashboards should feel like a modern SaaS product: quiet, dense, fast, and precise. They should not use oversized marketing cards or decorative visuals. The goal is to help staff, trainers, and members understand status and act quickly.

## 2. Dashboard Shell

### Desktop Layout

| Region | Requirement |
| --- | --- |
| Sidebar | Persistent, role-aware, 240px expanded, icon + text links. |
| Header | Page title, search where relevant, date range, notifications, account menu. |
| Main content | Max width only where needed; admin tables can use full available width. |
| Right rail | Optional for context: member summary, payment status, quick actions. |

### Mobile Layout

| Region | Requirement |
| --- | --- |
| Header | Menu, title/context, account/notification. |
| Main content | Single-column priority order. |
| Bottom nav | Member and trainer primary navigation. |
| Drawer | Admin/trainer full navigation and filters. |

## 3. Navigation

### Admin Sidebar

Links:

- Dashboard
- Members
- Memberships
- Payments
- Attendance
- Trainers
- Classes
- Leads
- Reports
- Settings

Rules:

- Active item has accent strip and surface background.
- Critical counts can appear as small badges: leads, failed payments, expiring.
- Collapsed sidebar uses icon-only with tooltips.

### Member Navigation

Links:

- Dashboard
- Membership
- Classes
- Attendance
- Payments
- Workout Plans
- Profile

### Trainer Navigation

Links:

- Dashboard
- Assigned Members
- Classes
- Workout Plans
- Profile

## 4. Admin Dashboard Layout

### Primary Widgets

| Widget | Layout | Data |
| --- | --- | --- |
| Revenue | Large stat + trend line | Total revenue, online/offline split, trend. |
| Active Members | Stat card | Active count, new members, expired count. |
| Expiring Memberships | Table widget | Member, plan, end date, action. |
| Attendance Trends | Chart card | Daily check-ins, peak day/time. |
| Lead Conversion | Funnel/summary | New, contacted, trial, converted. |

### Secondary Widgets

- Payment exceptions.
- Today's classes.
- Recent activity.
- Trainer load.
- Website content status.

### Visual Treatment

- Use compact stat cards in a 4-column desktop grid.
- Use charts below stat row.
- Keep table rows 48px to 56px high.
- Use sticky filters for reports where useful.
- Use clear empty states with action buttons.

## 5. Admin List Pages

### Members

Layout:

- Header: title, count, Add Member button.
- Toolbar: search, status filter, plan filter, trainer filter.
- Table: name, phone, membership status, plan, trainer, last visit, actions.
- Mobile: member cards with status and primary action.

### Payments

Layout:

- Header: total collected for selected period, Record Payment button.
- Toolbar: date range, method, status, search.
- Table: member, amount, method, status, date, receipt, actions.
- Payment status badges must be clear and text-based.

### Leads

Layout:

- Header: new lead count, Create Lead button.
- Optional pipeline tabs: New, Contacted, Trial, Converted, Lost.
- Table/card: name, phone, source, status, assigned staff, next follow-up.

### Attendance

Layout:

- Prominent member search/check-in field.
- Today's check-ins table.
- Filters for date, member, type, source.

### Classes

Layout:

- Calendar/list toggle.
- Date range controls.
- Class cards/table with capacity and trainer.

## 6. Trainer Dashboard

### Layout

- Top row: assigned members, today's classes, missing plans.
- Main: upcoming classes and assigned members needing attention.
- Secondary: recent plan updates.

### Widgets

| Widget | Content | Action |
| --- | --- | --- |
| Assigned Members | Count and list of active members. | View Members |
| Upcoming Sessions | Class/session schedule. | Open Class |
| Missing Plans | Members without workout/diet plans. | Create Plan |
| Low Attendance | Assigned members with low attendance. | Open Member |

### Trainer Member Detail

Tabs:

- Overview
- Attendance
- Workout Plans
- Diet Plans
- Notes

Rules:

- Show membership status but hide payment details.
- Plan editors should use structured sections.

## 7. Member Dashboard

### Layout

- Hero status panel: membership status and next action.
- Card grid: attendance, upcoming classes, payments, workout plan.
- Notification list.
- Support/contact CTA.

### Widgets

| Widget | Content | Action |
| --- | --- | --- |
| Membership Status | Plan, days remaining, expiry, renewal state. | Renew / View Details |
| Attendance | Visits this month, last visit. | View Attendance |
| Upcoming Classes | Next bookings. | Book Class |
| Payments | Latest payment and receipt. | View Payments |
| Workout Plan | Active plan and trainer. | View Plan |
| Notifications | Unread updates. | Open Notifications |

### Visual Tone

Member dashboard can be slightly more expressive than admin but should remain clear and practical. Use premium status panels, not giant decorative cards.

## 8. Tables and Density

| Element | Desktop | Mobile |
| --- | --- | --- |
| Row height | 48px to 56px | Cards or 56px rows if few columns. |
| Header | Sticky optional | Hidden or card labels. |
| Actions | Right-aligned menu | Visible primary action + menu. |
| Filters | Horizontal toolbar | Drawer or stacked filters. |
| Pagination | Bottom right | Previous/Next + count. |

## 9. Filters

Filter types:

- Date range.
- Status.
- Plan.
- Trainer.
- Payment method.
- Source.
- Search.

Rules:

- Filters should show active count.
- Active filters should appear as removable chips.
- Clear filters action required.
- Mobile filters go into drawer with Apply and Reset.

## 10. Charts

Chart rules:

- Use text summary before/above chart.
- Provide accessible labels.
- Keep chart colors consistent with chart tokens.
- Use simple chart types.
- Avoid 3D, heavy gradients, and decorative chart backgrounds.
- Empty charts should show a useful empty state.

## 11. Forms in Dashboards

Form patterns:

- Full page form for complex entities.
- Drawer form for quick create/edit.
- Modal confirmation for destructive actions.

Required behavior:

- Save/cancel actions visible.
- Inline validation.
- Loading state on submit.
- Audit reason field for destructive/corrective actions.

## 12. Dashboard Empty States

| Screen | Empty State |
| --- | --- |
| Members | "No members yet. Add your first member to start managing memberships and payments." |
| Payments | "No payments recorded for this period." |
| Leads | "No leads match these filters. New website inquiries will appear here." |
| Attendance | "No check-ins recorded today." |
| Classes | "No classes scheduled. Create a class to open bookings." |
| Reports | "Choose a date range to generate this report." |

## 13. Dashboard Performance Rules

- Load shell immediately.
- Use skeletons for widgets and tables.
- Fetch widgets independently where possible.
- Keep dashboard charts lazy or lightweight.
- Paginate all tables.
- Avoid client-side rendering of huge datasets.
- Preserve layout dimensions during loading.

