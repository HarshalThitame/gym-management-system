# 07 - API Architecture

## 1. API Design Principles

- Prefer Server Actions for authenticated form mutations within the Next.js app when they improve developer experience.
- Use Route Handlers for webhooks, public form submissions, payment order creation, exports, and APIs consumed by client-side widgets.
- All API routes must validate input server-side.
- All authenticated API routes must verify Supabase session and role permissions.
- Responses should use consistent status codes and error shapes.
- Mutations that affect payments, memberships, roles, attendance, or personal data must create audit logs.

## 2. Common Response Shapes

| Response Type | Shape |
| --- | --- |
| Success single | `data`, optional `meta` |
| Success list | `data[]`, `pagination`, optional `filters` |
| Mutation success | `data`, `message` |
| Error | `error.code`, `error.message`, optional `error.details` |

## 3. Authentication APIs

Supabase Auth handles most authentication primitives. The application still needs profile and role-aware endpoints.

| Method | Route | Purpose | Request Body | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/register-profile` | Create application profile after Supabase sign-up. | `auth_user_id`, `full_name`, `email`, `phone`, optional `selected_plan_id` | `user`, `member`, `next_step` | Authenticated user or trusted auth callback |
| GET | `/api/auth/me` | Return current user, roles, gym, profile state. | None | `user`, `roles`, `gym`, `member_profile`, `trainer_profile` | Authenticated |
| POST | `/api/auth/resend-verification` | Trigger verification email through Supabase flow. | `email` | `message` | Guest or authenticated, rate limited |
| POST | `/api/auth/accept-invite` | Complete invited user profile. | `token`, `password`, `profile` | `user`, `roles`, `next_step` | Valid invite token |
| POST | `/api/auth/logout` | End current session if handled server-side. | None | `message` | Authenticated |

Notes:

- Login, password reset, and email verification are normally handled by Supabase Auth client/server SDK flows.
- Never expose service role keys through client APIs.

## 4. Members APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/members` | List/search members. | Query: `q`, `status`, `trainer_id`, `membership_status`, `page`, `limit` | `members[]`, `pagination` | Gym Admin, Reception Staff limited |
| POST | `/api/members` | Create member manually. | `full_name`, `phone`, `email`, `date_of_birth`, `emergency_contact`, `fitness_goal`, optional `plan_id`, optional `trainer_id` | `member`, optional `membership`, optional `payment` | Gym Admin, Reception Staff |
| GET | `/api/members/{memberId}` | Get member detail. | None | `member`, `membership_summary`, `trainer`, `recent_attendance` | Gym Admin, Reception Staff limited, assigned Trainer, owning Member |
| PATCH | `/api/members/{memberId}` | Update member profile. | Allowed profile fields based on role | `member` | Gym Admin, Reception Staff limited, owning Member limited |
| DELETE | `/api/members/{memberId}` | Archive member. | `reason` | `member.status=archived` | Gym Admin |
| POST | `/api/members/{memberId}/invite` | Send account setup invite. | Optional `email` | `message`, `invite_sent_at` | Gym Admin, Reception Staff if allowed |
| PATCH | `/api/members/{memberId}/trainer` | Assign or change trainer. | `trainer_id`, optional `reason` | `member`, `trainer` | Gym Admin |
| GET | `/api/members/{memberId}/attendance` | Member attendance history. | Query: `from`, `to`, `type`, `page`, `limit` | `attendance[]`, `summary`, `pagination` | Admin, Reception, assigned Trainer limited, owning Member |
| GET | `/api/members/{memberId}/payments` | Member payment history. | Query: `status`, `page`, `limit` | `payments[]`, `pagination` | Admin, Reception limited, owning Member |
| GET | `/api/members/{memberId}/plans` | Member workout and diet plan summary. | Query: `type`, `status` | `workout_plans[]`, `diet_plans[]` | Admin, assigned Trainer, owning Member |

Validation:

- `phone` required for new members.
- Email must be unique where user login is created.
- Member access must be scoped by `gym_id`.
- Trainers can only access assigned members.

## 5. Membership APIs

### 5.1 Membership Plan APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/membership-plans` | Public/admin plan list. | Query: `status`, `public_only`, `page`, `limit` | `plans[]`, `pagination` | Guest reads published public; Admin reads all |
| POST | `/api/membership-plans` | Create plan. | `name`, `description`, `duration_days`, `price_amount`, `joining_fee_amount`, `features`, `is_public`, `status` | `plan` | Gym Admin |
| GET | `/api/membership-plans/{planId}` | Get plan detail. | None | `plan` | Guest if published; Admin for all |
| PATCH | `/api/membership-plans/{planId}` | Update plan. | Editable plan fields | `plan` | Gym Admin |
| DELETE | `/api/membership-plans/{planId}` | Archive plan. | `reason` | `plan.status=archived` | Gym Admin |

### 5.2 Member Membership APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/memberships` | List membership records. | Query: `member_id`, `status`, `expiring_within_days`, `from`, `to`, `page`, `limit` | `memberships[]`, `pagination` | Gym Admin, Reception Staff limited |
| POST | `/api/memberships` | Create membership for member. | `member_id`, `plan_id`, `start_date`, optional `payment_id`, optional `status` | `membership` | Gym Admin, Reception Staff limited |
| GET | `/api/memberships/{membershipId}` | Get membership detail. | None | `membership`, `plan`, `member`, `payment` | Admin, Reception limited, owning Member |
| PATCH | `/api/memberships/{membershipId}` | Update membership dates/status. | `start_date`, `end_date`, `status`, `reason` | `membership` | Gym Admin |
| POST | `/api/memberships/{membershipId}/renew` | Start renewal from existing membership. | `plan_id`, `payment_method`, optional `start_date` | `renewal`, optional `razorpay_order` | Gym Admin, Reception Staff assisted, owning Member |
| POST | `/api/memberships/{membershipId}/cancel` | Cancel membership. | `reason`, optional `refund_policy_action` | `membership` | Gym Admin |

Validation:

- Plan must be active/published for member purchase.
- Membership date range must be valid.
- Overlap rules must be enforced according to business settings.
- Status changes require audit logging.

## 6. Payment APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/payments/razorpay/order` | Create Razorpay order for plan purchase or renewal. | `plan_id`, optional `membership_id`, `purpose` | `order_id`, `amount`, `currency`, `payment_id`, `razorpay_key_id` | Authenticated Member, Gym Admin assisted |
| POST | `/api/payments/razorpay/verify` | Verify client-returned Razorpay payment signature if used. | `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` | `payment_status`, `membership_status` | Authenticated payer |
| POST | `/api/webhooks/razorpay` | Process Razorpay webhook. | Raw webhook payload | `received=true` | Razorpay signature only, no user session |
| GET | `/api/payments` | List payments. | Query: `status`, `method`, `member_id`, `from`, `to`, `page`, `limit` | `payments[]`, `pagination` | Gym Admin, Reception Staff limited |
| POST | `/api/payments/offline` | Record offline payment. | `member_id`, `membership_id`, `amount`, `currency`, `method`, `reference`, `paid_at`, `notes` | `payment`, `membership` optional | Gym Admin, Reception Staff |
| GET | `/api/payments/{paymentId}` | Payment detail. | None | `payment`, `member`, `membership`, `events` optional | Gym Admin, Reception limited, owning Member |
| POST | `/api/payments/{paymentId}/receipt-email` | Resend receipt email. | Optional `email` | `message` | Gym Admin, Reception Staff, owning Member |
| POST | `/api/payments/{paymentId}/refund` | Initiate or record refund. | `amount`, `reason` | `payment`, `refund` | Gym Admin |

Validation:

- Razorpay order amount must be calculated server-side from plan/membership.
- Razorpay webhooks must verify signature.
- Webhook event IDs must be idempotent.
- Offline payments require staff identity and reference/notes depending on method.
- Refund amount cannot exceed captured amount minus previous refunds.

## 7. Attendance APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/attendance` | List attendance records. | Query: `member_id`, `class_id`, `from`, `to`, `type`, `page`, `limit` | `attendance[]`, `summary`, `pagination` | Gym Admin, Reception Staff, Trainer assigned, Member own |
| POST | `/api/attendance/check-in` | Manual gym check-in. | `member_id`, `check_in_at` optional, `source=manual`, optional `notes` | `attendance`, `member_status_warning` optional | Gym Admin, Reception Staff |
| POST | `/api/attendance/class` | Mark class attendance. | `class_id`, `booking_id`, `status` | `attendance` or `booking` | Gym Admin, Reception Staff, assigned Trainer |
| PATCH | `/api/attendance/{attendanceId}` | Correct attendance record. | `check_in_at`, `check_out_at`, `status`, `correction_reason` | `attendance` | Gym Admin, Reception Staff limited |
| DELETE | `/api/attendance/{attendanceId}` | Cancel/correct attendance record. | `correction_reason` | `attendance.status=corrected/cancelled` | Gym Admin |

Validation:

- Member must belong to same gym.
- Active membership warning should be shown; override requires permission.
- Duplicate same-window check-ins should be prevented.
- Corrections require reason and audit log.

## 8. Classes APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/classes` | List upcoming/past classes. | Query: `from`, `to`, `trainer_id`, `status`, `eligible_only`, `page`, `limit` | `classes[]`, `pagination` | Guest for public/published optional; Member authenticated; Staff |
| POST | `/api/classes` | Create class. | `title`, `description`, `trainer_id`, `start_at`, `end_at`, `capacity`, `location`, `eligibility_rules`, `status` | `class` | Gym Admin |
| GET | `/api/classes/{classId}` | Class detail. | None | `class`, `trainer`, `booking_state`, `available_capacity` | Member, Trainer assigned, Staff |
| PATCH | `/api/classes/{classId}` | Update class. | Editable class fields | `class` | Gym Admin |
| DELETE | `/api/classes/{classId}` | Archive/cancel class. | `reason`, `notify_members` | `class.status` | Gym Admin |
| GET | `/api/classes/{classId}/bookings` | List bookings for class. | Query: `status`, `page`, `limit` | `bookings[]`, `pagination` | Gym Admin, Reception Staff, assigned Trainer |
| POST | `/api/classes/{classId}/bookings` | Book class. | Optional `member_id` for staff-assisted booking | `booking`, `available_capacity` | Member own, Gym Admin, Reception Staff |
| PATCH | `/api/class-bookings/{bookingId}` | Update booking status. | `status`, `reason` | `booking` | Gym Admin, Reception Staff, owning Member for cancellation, assigned Trainer attendance status |
| DELETE | `/api/class-bookings/{bookingId}` | Cancel booking. | `reason` | `booking.status=cancelled` | Member own within rules, Staff |

Validation:

- Class must be published and in the future for member booking.
- Active membership required.
- Capacity must be enforced transactionally.
- Cancellation cutoff must be enforced.
- Trainer must be active.

## 9. Trainer and Plan APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/trainers` | List trainers. | Query: `public_only`, `status`, `specialty`, `page`, `limit` | `trainers[]`, `pagination` | Guest for published; Admin all |
| POST | `/api/trainers` | Create trainer profile. | `user_id`, `display_name`, `bio`, `specialties`, `certifications`, `is_public`, `status` | `trainer` | Gym Admin |
| GET | `/api/trainers/{trainerId}` | Trainer detail. | None | `trainer`, optional `assigned_members`, `classes` based on role | Guest if public; Admin; trainer own |
| PATCH | `/api/trainers/{trainerId}` | Update trainer profile. | Editable trainer fields | `trainer` | Gym Admin, trainer own limited |
| GET | `/api/trainers/{trainerId}/members` | Assigned members. | Query: `q`, `status`, `page`, `limit` | `members[]`, `pagination` | Trainer own, Gym Admin |
| GET | `/api/workout-plans` | List workout plans. | Query: `member_id`, `trainer_id`, `status` | `workout_plans[]` | Admin, assigned Trainer, owning Member |
| POST | `/api/workout-plans` | Create workout plan. | `member_id`, `title`, `goal`, `start_date`, `end_date`, `plan_data`, `status` | `workout_plan` | Assigned Trainer, Gym Admin |
| PATCH | `/api/workout-plans/{planId}` | Update workout plan. | Editable plan fields | `workout_plan` | Assigned Trainer, Gym Admin |
| GET | `/api/diet-plans` | List diet plans. | Query: `member_id`, `trainer_id`, `status` | `diet_plans[]` | Admin, assigned Trainer, owning Member |
| POST | `/api/diet-plans` | Create diet plan. | `member_id`, `title`, `goal`, `calorie_target`, `macro_targets`, `restrictions`, `plan_data`, `status` | `diet_plan` | Assigned Trainer, Gym Admin |
| PATCH | `/api/diet-plans/{planId}` | Update diet plan. | Editable plan fields | `diet_plan` | Assigned Trainer, Gym Admin |

Validation:

- Trainer must be assigned to member before creating plans unless Gym Admin override.
- Published workout plans require structured exercise data.
- Published diet plans require structured meal data.
- Members can view published plans only.

## 10. Lead APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/leads/contact` | Public contact form submission. | `name`, `phone`, `email`, `subject`, `message`, `consent`, `utm` | `message`, `lead_id` optional | Guest, rate limited |
| POST | `/api/leads/free-trial` | Public free trial request. | `name`, `phone`, `email`, `preferred_trial_at`, `fitness_goal`, `consent`, `utm` | `message`, `lead_id` optional | Guest, rate limited |
| GET | `/api/leads` | List leads. | Query: `status`, `source`, `assigned_to`, `from`, `to`, `q`, `page`, `limit` | `leads[]`, `pagination` | Gym Admin, Reception Staff |
| POST | `/api/leads` | Staff creates lead manually. | Lead fields | `lead` | Gym Admin, Reception Staff |
| GET | `/api/leads/{leadId}` | Lead detail. | None | `lead`, `notes`, `status_history` optional | Gym Admin, Reception Staff |
| PATCH | `/api/leads/{leadId}` | Update lead status/details. | Lead editable fields, `status`, `notes` | `lead` | Gym Admin, Reception Staff |
| POST | `/api/leads/{leadId}/convert` | Convert lead to member. | Member fields, optional `plan_id` | `member`, `membership` optional | Gym Admin, Reception Staff |

Validation:

- Name and phone required.
- Duplicate phone/email should warn staff and optionally merge.
- Public routes must be rate limited and bot protected.

## 11. Reports APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/reports/dashboard` | Admin dashboard metrics. | Query: `from`, `to` | `revenue`, `active_members`, `expiring_memberships`, `attendance_trends`, `lead_conversion` | Gym Admin |
| GET | `/api/reports/revenue` | Revenue report. | Query: `from`, `to`, `method`, `plan_id` | `summary`, `series`, `payments` | Gym Admin |
| GET | `/api/reports/members` | Member lifecycle report. | Query: `from`, `to`, `status` | `summary`, `new_members`, `renewals`, `expiries`, `churn` | Gym Admin |
| GET | `/api/reports/attendance` | Attendance report. | Query: `from`, `to`, `member_id`, `type` | `summary`, `series`, `peak_times`, `records` | Gym Admin, Reception limited |
| GET | `/api/reports/leads` | Lead conversion report. | Query: `from`, `to`, `source` | `summary`, `funnel`, `source_breakdown` | Gym Admin |
| GET | `/api/reports/classes` | Class performance report. | Query: `from`, `to`, `trainer_id` | `summary`, `occupancy`, `cancellations`, `trainer_utilization` | Gym Admin |
| POST | `/api/reports/export` | Export report. | `report_type`, `from`, `to`, `filters`, `format` | `export_id` or `download_url` | Gym Admin |

Validation:

- Date ranges required.
- Large ranges may require asynchronous export.
- Exports must be audit logged.

## 12. Notification APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/notifications` | List current user's notifications. | Query: `status`, `page`, `limit` | `notifications[]`, `unread_count`, `pagination` | Authenticated |
| PATCH | `/api/notifications/{notificationId}` | Mark notification read/archived. | `status` | `notification` | Owner only |
| POST | `/api/notifications/mark-all-read` | Mark current user's notifications read. | None | `updated_count` | Authenticated |
| POST | `/api/notifications/send` | Send admin notification. | `recipient_scope`, `user_ids`, `title`, `body`, `type`, `channel` | `notification_batch` | Gym Admin |
| GET | `/api/notification-templates` | List templates. | Query: `channel`, `template_key` | `templates[]` | Gym Admin |
| PATCH | `/api/notification-templates/{templateId}` | Update template. | `subject`, `body`, `is_active` | `template` | Gym Admin |

Validation:

- Users can only mutate their own notification state.
- Bulk send must validate recipient scope and gym ownership.
- Marketing emails require consent and unsubscribe compliance.

## 13. Content APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/content/blogs` | List blog posts for admin or public widgets. | Query: `status`, `category`, `q`, `page`, `limit` | `blogs[]`, `pagination` | Guest published; Admin all |
| POST | `/api/content/blogs` | Create blog post. | Blog fields | `blog` | Gym Admin |
| PATCH | `/api/content/blogs/{blogId}` | Update blog post. | Blog editable fields | `blog` | Gym Admin |
| DELETE | `/api/content/blogs/{blogId}` | Archive blog post. | `reason` | `blog.status=archived` | Gym Admin |
| GET | `/api/content/testimonials` | List testimonials. | Query: `status`, `page`, `limit` | `testimonials[]`, `pagination` | Guest published; Admin all |
| POST | `/api/content/testimonials` | Create testimonial. | Testimonial fields | `testimonial` | Gym Admin |
| PATCH | `/api/content/testimonials/{testimonialId}` | Update testimonial. | Testimonial editable fields | `testimonial` | Gym Admin |
| GET | `/api/content/gallery` | List gallery items. | Query: `status`, `category`, `page`, `limit` | `gallery[]`, `pagination` | Guest published; Admin all |
| POST | `/api/content/gallery` | Create gallery item metadata after upload. | `title`, `alt_text`, `category`, `image_path`, `status` | `gallery_item` | Gym Admin |
| PATCH | `/api/content/gallery/{galleryId}` | Update gallery item. | Gallery editable fields | `gallery_item` | Gym Admin |

## 14. Settings APIs

| Method | Route | Purpose | Request Body or Query | Response Body | Permissions |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/settings/gym` | Get gym settings. | None | `gym`, `public_settings`, `operational_settings` based on role | Gym Admin, public subset for guest through public pages |
| PATCH | `/api/settings/gym` | Update gym profile/settings. | Gym editable fields | `gym` | Gym Admin |
| GET | `/api/settings/integrations` | Integration health/config summary. | None | `razorpay_configured`, `resend_configured`, `supabase_configured` | Gym Admin |
| PATCH | `/api/settings/notification-preferences` | Update current user's preferences. | Preference fields | `preferences` | Authenticated |

## 15. API Security Requirements

- All mutating routes must use CSRF-safe patterns or same-site protections where applicable.
- Public form APIs must be rate limited by IP and fingerprint where possible.
- Payment webhooks must use raw body verification.
- Use service role access only inside trusted server routes and never pass service role tokens to clients.
- Validate `gym_id` scope from authenticated user context, not from client-provided body.
- Return generic authorization errors to avoid leaking data existence.

