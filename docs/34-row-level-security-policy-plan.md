# 34 - Row Level Security Policy Plan

## 1. RLS Goals

Row Level Security is the final database protection layer. It must enforce:

- Tenant isolation through `gym_id`.
- Member ownership.
- Trainer assignment boundaries.
- Least privilege for staff roles.
- Public read access only to published public content.
- No direct anonymous access to sensitive data.

RLS complements server-side authorization. It does not replace service-level business rules.

## 2. RLS Helper Concepts

Recommended helper functions:

| Helper | Purpose |
| --- | --- |
| `current_app_user_id()` | Maps `auth.uid()` to `users.id`. |
| `current_user_gym_id()` | Returns app user's gym. |
| `is_super_admin()` | True if current user has Super Admin role. |
| `has_gym_role(role_names)` | True if current user has one of the roles for the gym. |
| `is_member_owner(member_id)` | True if member row belongs to current user. |
| `is_assigned_trainer(member_id)` | True if current trainer is assigned to member. |
| `can_access_gym(gym_id)` | True for Super Admin or matching gym. |

All helper functions must be reviewed for performance and security.

## 3. Global Policy Rules

| Rule | Requirement |
| --- | --- |
| RLS enabled | Enable on every app table before production data. |
| Service role | Trusted server-only service role can bypass RLS where required. |
| Anonymous | Anonymous access only for published public content and controlled public inserts if absolutely needed. |
| Tenant scope | Every tenant-scoped policy checks `gym_id`. |
| Ownership | Member-owned policies check user/member relationship. |
| Assignment | Trainer policies check assigned trainer relationship. |
| Staff | Gym Admin/Reception policies check gym role and action scope. |

## 4. Table Policy Plan

### `users`

| Operation | Policy |
| --- | --- |
| Read | User can read own row. Gym Admin can read users in same gym. Super Admin can read all. |
| Insert | Trusted server action/service only. |
| Update | User can update limited own fields through app; Gym Admin can update gym users except protected role/status fields. |
| Delete | No hard delete through client; archive through trusted server. |

### `members`

| Operation | Policy |
| --- | --- |
| Read | Member can read own member row. Trainer can read assigned members. Gym Admin/Reception can read same gym. Super Admin can read all. |
| Insert | Gym Admin/Reception trusted action can create in same gym. Self-registration trusted action can create own member. |
| Update | Member can update limited own fields through app. Trainer can update assigned fitness-related fields only through service. Staff can update same-gym members by role. |
| Delete | No hard delete. Gym Admin can archive through trusted action. |

### `trainers`

| Operation | Policy |
| --- | --- |
| Read | Public can read published public trainer profiles. Trainer can read own row. Staff can read same-gym trainers. Super Admin can read all. |
| Insert | Gym Admin/Super Admin trusted action. |
| Update | Trainer can update limited own profile fields. Gym Admin can update same-gym trainer. |
| Delete | No hard delete. Gym Admin archives. |

### `payments`

| Operation | Policy |
| --- | --- |
| Read | Member can read own payments. Gym Admin can read same-gym payments. Reception can read limited same-gym payment data through app. Super Admin can read all. |
| Insert | Trusted server action for online order/offline payment. Members do not directly insert payment rows from browser. |
| Update | Verified webhook service or Gym Admin trusted action only. Reception can update limited offline notes/status through service if allowed. |
| Delete | No hard delete. |

### `attendance`

| Operation | Policy |
| --- | --- |
| Read | Member can read own attendance. Trainer can read assigned member/class attendance. Gym Admin/Reception can read same-gym. |
| Insert | Gym Admin/Reception can insert same-gym attendance. Assigned trainer can insert class attendance where class assigned. |
| Update | Staff can correct same-gym attendance with reason. Assigned trainer can update assigned class attendance where allowed. |
| Delete | No hard delete; correction/cancel state only. |

### `classes`

| Operation | Policy |
| --- | --- |
| Read | Members can read published eligible same-gym classes. Trainers can read assigned classes. Staff can read same-gym classes. |
| Insert | Gym Admin creates same-gym classes. |
| Update | Gym Admin updates same-gym classes. Assigned trainer can update attendance-related fields only through service if modeled. |
| Delete | No hard delete; cancel/archive through Gym Admin. |

### `class_bookings`

| Operation | Policy |
| --- | --- |
| Read | Member can read own bookings. Trainer can read bookings for assigned classes. Staff can read same-gym bookings. |
| Insert | Member can book own eligible class through trusted action; staff can book for same-gym member. |
| Update | Member can cancel own booking within rules through service. Staff can update same-gym bookings. Trainer can mark assigned class attendance where allowed. |
| Delete | No hard delete; status changes only. |

### `membership_plans`

| Operation | Policy |
| --- | --- |
| Read | Public can read published public plans. Staff can read all same-gym plans. |
| Insert | Gym Admin/Super Admin. |
| Update | Gym Admin/Super Admin. |
| Delete | Archive only. |

### `memberships`

| Operation | Policy |
| --- | --- |
| Read | Member can read own memberships. Trainer can read assigned member summary without financial detail through view/service. Staff can read same-gym. |
| Insert | Trusted staff/payment service. |
| Update | Trusted staff/payment service. |
| Delete | No hard delete; cancel/archive only. |

### `leads`

| Operation | Policy |
| --- | --- |
| Read | Gym Admin/Reception can read same-gym leads. Super Admin can read all. |
| Insert | Prefer trusted public form route. Anonymous direct insert only if heavily constrained. |
| Update | Gym Admin/Reception same-gym. |
| Delete | Archive only. |

### `notifications`

| Operation | Policy |
| --- | --- |
| Read | User can read own notifications. Admin can read same-gym system notifications/templates. |
| Insert | Trusted server services and Gym Admin bulk send. |
| Update | User can update own read/archive state. Admin can update templates, not user read state except support flow. |
| Delete | Archive only. |

### `blogs`, `gallery`, `testimonials`

| Operation | Policy |
| --- | --- |
| Read | Public can read published rows. Staff can read same-gym all statuses. |
| Insert | Gym Admin. |
| Update | Gym Admin. |
| Delete | Archive only. |

### `audit_logs`

| Operation | Policy |
| --- | --- |
| Read | Super Admin all. Gym Admin same-gym. |
| Insert | Trusted server only. |
| Update | Not allowed. |
| Delete | Not allowed. |

## 5. Zero Data Leakage Requirements

- All policies must include gym scope where table is tenant-scoped.
- Members must never query by arbitrary member ID without ownership check.
- Trainers must never see payment details.
- Reception must not see integration secrets, full audit exports, or refund controls.
- Public policies must filter by published status and public visibility.
- RLS must be tested with direct database client attempts.

## 6. RLS Testing Matrix

| Actor | Test |
| --- | --- |
| Anonymous | Can read published plans/blogs/gallery/testimonials only. |
| Anonymous | Cannot read members/users/payments/attendance/classes requiring auth. |
| Member A | Can read own profile, memberships, payments, attendance, bookings. |
| Member A | Cannot read Member B data by ID. |
| Trainer | Can read assigned member fitness data. |
| Trainer | Cannot read unassigned member or payments. |
| Reception | Can manage allowed same-gym operational data. |
| Reception | Cannot change settings/roles/refunds. |
| Gym Admin | Can manage same-gym data. |
| Gym Admin | Cannot access another gym's data. |
| Super Admin | Can access all tenant data. |

## 7. RLS Implementation Rules

- Add RLS policies in migrations.
- Review policies before adding new tables.
- Include policy tests in integration suite.
- Keep policies readable and named consistently.
- Avoid broad `using (true)` except public published content with status checks.
- Prefer trusted server routes over anonymous insert policies for public forms.

