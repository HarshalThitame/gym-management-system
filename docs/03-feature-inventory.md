# 03 - Feature Inventory

## 1. Feature Inventory Principles

Each feature should be implemented with:

- Clear purpose and measurable outcome.
- Typed input model and server-side validation.
- Permission check before mutation.
- Audit event where business-critical data changes.
- User feedback for success, error, loading, and empty states.
- Mobile-first responsive UI.

## 2. Public Website Features

### 2.1 Home

| Field | Specification |
| --- | --- |
| Purpose | Introduce the gym, communicate value, surface membership plans, trainers, testimonials, gallery, and lead CTAs. |
| Inputs | None for page view; CTA clicks for free trial, plans, contact, WhatsApp. |
| Outputs | Rendered landing page with hero, highlights, plan teaser, trainer teaser, testimonials, gallery preview, contact CTA. |
| Validation Rules | Public content must only show published items. CTAs must route to active pages/forms. |
| Dependencies | CMS content, membership plans, testimonials, gallery, trainer profiles, SEO metadata. |

### 2.2 About

| Field | Specification |
| --- | --- |
| Purpose | Explain gym story, facilities, mission, operating hours, values, and credibility. |
| Inputs | None. |
| Outputs | About content, facilities list, operating hours, location details, trust metrics. |
| Validation Rules | Only published content; operating hours must be valid weekday/time ranges. |
| Dependencies | Gym settings, CMS content, media storage. |

### 2.3 Membership Plans

| Field | Specification |
| --- | --- |
| Purpose | Display available membership plans and guide visitors to trial or purchase. |
| Inputs | Plan filter optional: duration, price range, type. |
| Outputs | Plan cards with price, duration, benefits, joining fee, renewal rules, CTA. |
| Validation Rules | Show only active published plans. Price must be non-negative. Duration must be positive. |
| Dependencies | `membership_plans`, Razorpay checkout flow, auth/register flow. |

### 2.4 Trainers

| Field | Specification |
| --- | --- |
| Purpose | Build trust by showing trainer profiles, specialties, certifications, and availability hints. |
| Inputs | Optional specialty filter. |
| Outputs | Trainer profile cards and detail pages. |
| Validation Rules | Only active/published trainers appear publicly. |
| Dependencies | `trainers`, media storage, CMS publishing status. |

### 2.5 Gallery

| Field | Specification |
| --- | --- |
| Purpose | Show facilities, equipment, classes, events, and transformation visuals. |
| Inputs | Optional category filter. |
| Outputs | Optimized responsive image grid/lightbox. |
| Validation Rules | Only published images. Images require alt text and category. |
| Dependencies | `gallery`, Supabase Storage, image optimization. |

### 2.6 Testimonials

| Field | Specification |
| --- | --- |
| Purpose | Show social proof from members. |
| Inputs | Optional rating/category filter. |
| Outputs | Published testimonials with name, photo, rating, quote, plan/category. |
| Validation Rules | Rating must be between 1 and 5. Consent must be recorded before public display. |
| Dependencies | `testimonials`, member records optional, media storage. |

### 2.7 Blog

| Field | Specification |
| --- | --- |
| Purpose | Provide SEO content, fitness guidance, nutrition tips, class updates, and gym announcements. |
| Inputs | Search, category, tag, pagination. |
| Outputs | Blog listing and detail pages with structured metadata. |
| Validation Rules | Only published posts. Slugs must be unique. Publish date cannot be invalid. |
| Dependencies | `blogs`, authors/users, SEO metadata, Open Graph assets. |

### 2.8 Contact

| Field | Specification |
| --- | --- |
| Purpose | Let visitors ask questions, find the gym, view contact information, and access WhatsApp. |
| Inputs | Name, phone, email optional, subject, message, consent checkbox. |
| Outputs | Lead record, confirmation email optional, admin notification. |
| Validation Rules | Name required; phone required and valid for target market; email valid if provided; message length limits; consent required. |
| Dependencies | `leads`, Resend, rate limiting, gym settings, WhatsApp integration. |

### 2.9 Free Trial

| Field | Specification |
| --- | --- |
| Purpose | Capture high-intent leads for trial sessions. |
| Inputs | Name, phone, email optional, preferred date, preferred time, fitness goal, source, consent. |
| Outputs | Trial lead, confirmation message/email, admin follow-up task. |
| Validation Rules | Date cannot be in the past; time must fit gym hours; duplicate active trial prevention by phone/email; consent required. |
| Dependencies | `leads`, operating hours, Resend, notification settings. |

## 3. Member Portal Features

### 3.1 Member Profile

| Field | Specification |
| --- | --- |
| Purpose | Let members maintain personal information and fitness context. |
| Inputs | Name, phone, email, gender optional, date of birth optional, address optional, emergency contact, fitness goals, medical notes optional. |
| Outputs | Updated profile and confirmation. |
| Validation Rules | Email format; phone format; date of birth cannot be future; emergency phone format; medical fields protected. |
| Dependencies | Supabase Auth, `users`, `members`, audit logs for sensitive fields. |

### 3.2 Membership Details

| Field | Specification |
| --- | --- |
| Purpose | Show active membership, plan benefits, start date, end date, status, renewal options. |
| Inputs | None, or selected membership record for history. |
| Outputs | Membership summary, renewal CTA, expiry warning, plan details. |
| Validation Rules | Member can only view own membership records. |
| Dependencies | `memberships`, `membership_plans`, `payments`. |

### 3.3 Attendance

| Field | Specification |
| --- | --- |
| Purpose | Let members see gym visits and class attendance. |
| Inputs | Date range filter, attendance type filter. |
| Outputs | Attendance list, streaks, monthly count, missed-period indicators. |
| Validation Rules | Date range must be valid; member can only view own records. |
| Dependencies | `attendance`, class bookings, reporting queries. |

### 3.4 Book Classes

| Field | Specification |
| --- | --- |
| Purpose | Let members discover, book, and cancel eligible classes. |
| Inputs | Class selected, date, booking action, cancellation reason optional. |
| Outputs | Booking confirmation, waitlist status optional, updated capacity. |
| Validation Rules | Active membership required; capacity not exceeded; no duplicate booking; cancellation must be before cutoff; class must not be in the past. |
| Dependencies | `classes`, `class_bookings`, `memberships`, notifications. |

### 3.5 Workout Plans

| Field | Specification |
| --- | --- |
| Purpose | Let members view assigned workouts and training instructions. |
| Inputs | Plan/date filter, mark exercise complete optional in future. |
| Outputs | Current workout plan, exercises, sets, reps, rest, notes, trainer details. |
| Validation Rules | Member can only view own published/active plans. |
| Dependencies | `workout_plans`, trainer assignment, member profile. |

### 3.6 Diet Plans

| Field | Specification |
| --- | --- |
| Purpose | Let members view nutrition guidance assigned by trainer. |
| Inputs | Plan/date filter. |
| Outputs | Diet plan, meals, calories/macros optional, restrictions, notes. |
| Validation Rules | Member can only view own published/active plans. |
| Dependencies | `diet_plans`, trainer assignment, member profile. |

### 3.7 Payments

| Field | Specification |
| --- | --- |
| Purpose | Let members pay online, view payment history, and access receipt information. |
| Inputs | Selected plan or renewal, billing details if needed, Razorpay payment response. |
| Outputs | Razorpay order, payment status, receipt, membership activation/renewal. |
| Validation Rules | Amount must match server-side plan price; payment status updated only by verified webhook or verified callback; member can only view own payments. |
| Dependencies | Razorpay, `payments`, `memberships`, Resend receipts. |

### 3.8 Notifications

| Field | Specification |
| --- | --- |
| Purpose | Inform members about expiry, bookings, payment status, trainer plan updates, offers, and announcements. |
| Inputs | Read/unread action, optional preferences. |
| Outputs | Notification list, unread count, read state. |
| Validation Rules | User can only view own notifications. |
| Dependencies | `notifications`, Resend optional, event triggers. |

## 4. Admin Portal Features

### 4.1 Admin Dashboard

| Field | Specification |
| --- | --- |
| Purpose | Give administrators an operational and financial overview. |
| Inputs | Date range, branch/gym filter future, metric filters. |
| Outputs | Revenue, active members, expiring memberships, attendance trends, lead conversion, payment status, class occupancy. |
| Validation Rules | Admin role required; date range valid. |
| Dependencies | Members, memberships, payments, attendance, leads, classes, reporting views. |

### 4.2 Members

| Field | Specification |
| --- | --- |
| Purpose | Manage member lifecycle from creation to renewal and archival. |
| Inputs | Profile fields, contact details, membership selection, trainer assignment, status, search/filter. |
| Outputs | Member list, member detail, created/updated member, audit log. |
| Validation Rules | Required name and phone; unique email if provided; phone duplicate warning; status valid; cannot delete members with payment history, archive instead. |
| Dependencies | `users`, `members`, `memberships`, `payments`, trainer assignments. |

### 4.3 Memberships

| Field | Specification |
| --- | --- |
| Purpose | Manage membership plans and individual membership records. |
| Inputs | Plan name, duration, price, features, status, member, dates, renewal action. |
| Outputs | Plan catalog, member membership records, expiry lists. |
| Validation Rules | Plan price non-negative; duration positive; active membership overlap rules; archived plans cannot be sold. |
| Dependencies | `membership_plans`, `memberships`, payments. |

### 4.4 Payments

| Field | Specification |
| --- | --- |
| Purpose | Track online/offline payments, reconciliation, receipts, refunds, and failed payment follow-up. |
| Inputs | Member, amount, method, reference, status, notes, provider metadata. |
| Outputs | Payment records, receipt, payment reports, membership status update. |
| Validation Rules | Amount positive; currency required; offline payments require recorded-by staff; online status changes require verified provider event; refund cannot exceed captured amount. |
| Dependencies | Razorpay, `payments`, `memberships`, audit logs, Resend. |

### 4.5 Attendance

| Field | Specification |
| --- | --- |
| Purpose | Record and review gym visits and class attendance. |
| Inputs | Member, date/time, check-in type, source, recorded-by, class optional. |
| Outputs | Attendance record, attendance reports, member attendance history. |
| Validation Rules | Active member required for gym check-in unless override permission; no duplicate check-in in same configured window; timestamp valid. |
| Dependencies | `attendance`, `members`, `classes`, `class_bookings`. |

### 4.6 Trainers

| Field | Specification |
| --- | --- |
| Purpose | Manage trainer profiles, specialties, status, assignments, and class ownership. |
| Inputs | User account, bio, specialties, certifications, availability, image, public visibility. |
| Outputs | Trainer list, public trainer profiles, assignment records, trainer dashboard data. |
| Validation Rules | Trainer must map to a user account; public profiles require name, bio, image alt text; inactive trainers cannot receive new assignments. |
| Dependencies | `users`, `trainers`, member assignments, classes. |

### 4.7 Classes

| Field | Specification |
| --- | --- |
| Purpose | Manage group class schedules, capacity, trainer assignment, and bookings. |
| Inputs | Class title, description, trainer, start/end time, capacity, location, eligibility, status. |
| Outputs | Class calendar, booking list, attendance list, capacity state. |
| Validation Rules | End time after start time; capacity positive; trainer active; no invalid schedule; cannot reduce capacity below confirmed bookings without admin override. |
| Dependencies | `classes`, `trainers`, `class_bookings`, notifications. |

### 4.8 Leads

| Field | Specification |
| --- | --- |
| Purpose | Manage inquiries, trials, follow-ups, source attribution, and conversion to member. |
| Inputs | Lead source, name, phone, email, message, interest, trial date/time, status, notes, assigned staff. |
| Outputs | Lead list, lead detail, follow-up tasks, conversion record. |
| Validation Rules | Name and phone required; valid status transitions; duplicate lead warning; trial date not past unless historical entry. |
| Dependencies | Public forms, `leads`, notifications, member creation. |

### 4.9 Reports

| Field | Specification |
| --- | --- |
| Purpose | Provide operational and financial analysis. |
| Inputs | Date range, report type, filters, export action. |
| Outputs | Revenue report, member report, attendance report, expiring membership report, lead conversion report, class occupancy report. |
| Validation Rules | Admin permission required; date range size may be limited; exports audit logged. |
| Dependencies | Reporting queries/views, payments, memberships, attendance, leads, classes. |

### 4.10 Settings

| Field | Specification |
| --- | --- |
| Purpose | Configure gym profile, business hours, contact details, integrations, notification templates, tax/payment settings, branding. |
| Inputs | Gym name, address, phone, email, hours, social links, Razorpay keys server-side only, Resend settings, WhatsApp number, policies. |
| Outputs | Updated settings, public site data, integration behavior. |
| Validation Rules | Admin permission; valid contact fields; integration secrets stored securely; business hours valid. |
| Dependencies | `gyms` or settings table, Vercel env vars for secrets, Resend, Razorpay. |

## 5. Cross-Cutting Features

| Feature | Purpose | Inputs | Outputs | Validation | Dependencies |
| --- | --- | --- | --- | --- | --- |
| Authentication | Register and verify users. | Email, password, profile info. | Session, user profile. | Strong password, verified email where required. | Supabase Auth |
| Authorization | Enforce roles and permissions. | User session, role, gym scope. | Allow/deny decision. | Server-side check required. | Roles, RLS |
| Audit Logs | Track critical actions. | Actor, action, entity, before/after metadata. | Immutable audit trail. | Actor and entity required. | Database, server actions |
| Search | Find members, leads, payments, classes. | Query, filters, pagination. | Paginated results. | Query length limits. | Database indexes |
| File Uploads | Manage images and documents. | File, metadata, alt text. | Stored asset URL/path. | File type, size, image dimensions. | Supabase Storage |
| Email Notifications | Send transactional messages. | Recipient, template, variables. | Email event status. | Verified sender, unsubscribe for marketing. | Resend |
| PWA | Installable portal shell and offline-friendly UX. | Browser install prompt, cache. | App install and cached shell. | Auth-sensitive pages not cached with private data. | Service worker, manifest |

