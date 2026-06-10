# 05 - Information Architecture and Sitemap

## 1. Route Group Strategy

Recommended Next.js App Router organization:

- Public website route group for SEO and marketing pages.
- Auth route group for login, registration, password reset, verification, and invite acceptance.
- Member portal route group protected by member authentication.
- Admin panel route group protected by staff/admin authorization.
- Trainer portal route group protected by trainer authorization.

The route names below describe product architecture, not implementation code.

## 2. Complete Sitemap

### 2.1 Public Website

| Page | Path | Purpose |
| --- | --- | --- |
| Home | `/` | Primary landing page and conversion hub. |
| About | `/about` | Gym story, facilities, values, operating hours. |
| Membership Plans | `/membership-plans` | Public plan comparison and purchase/trial CTA. |
| Plan Detail | `/membership-plans/{slug}` | Detailed plan benefits, price, rules, CTA. |
| Trainers | `/trainers` | Public trainer listing. |
| Trainer Detail | `/trainers/{slug}` | Trainer profile, specialties, certifications. |
| Gallery | `/gallery` | Facility and event media. |
| Testimonials | `/testimonials` | Member reviews and success stories. |
| Blog | `/blog` | SEO content listing. |
| Blog Category | `/blog/category/{slug}` | Category-filtered content. |
| Blog Detail | `/blog/{slug}` | Article page. |
| Contact | `/contact` | Contact form, location, map, WhatsApp. |
| Free Trial | `/free-trial` | Trial booking lead form. |
| Privacy Policy | `/privacy-policy` | Privacy and data handling notice. |
| Terms | `/terms` | Terms of website, membership, and payments. |
| Refund Policy | `/refund-policy` | Payment refund and cancellation policy. |

### 2.2 Auth Pages

| Page | Path | Purpose |
| --- | --- | --- |
| Login | `/login` | User authentication. |
| Register | `/register` | Account creation. |
| Forgot Password | `/forgot-password` | Password reset request. |
| Reset Password | `/reset-password` | Password update after email link. |
| Verify Email | `/verify-email` | Email verification status and resend. |
| Accept Invite | `/invite/{token}` | Staff-created member or staff account setup. |
| Auth Callback | `/auth/callback` | Supabase auth callback handling. |

### 2.3 Member Portal

| Page | Path | Purpose |
| --- | --- | --- |
| Member Dashboard | `/member` | Member overview and quick actions. |
| Profile | `/member/profile` | Personal profile and emergency contact. |
| Membership Details | `/member/membership` | Active/current membership and renewal. |
| Membership History | `/member/membership/history` | Past membership periods. |
| Attendance | `/member/attendance` | Attendance history and trends. |
| Classes | `/member/classes` | Browse eligible classes. |
| Class Detail | `/member/classes/{id}` | Class details and booking action. |
| My Bookings | `/member/bookings` | Upcoming and historical class bookings. |
| Workout Plans | `/member/workout-plans` | Current and historical workout plans. |
| Workout Plan Detail | `/member/workout-plans/{id}` | Detailed workout plan. |
| Diet Plans | `/member/diet-plans` | Current and historical diet plans. |
| Diet Plan Detail | `/member/diet-plans/{id}` | Detailed diet plan. |
| Payments | `/member/payments` | Payment history and receipts. |
| Payment Detail | `/member/payments/{id}` | Payment status and receipt details. |
| Notifications | `/member/notifications` | In-app notification center. |
| Settings | `/member/settings` | Preferences, notification settings, account actions. |

### 2.4 Trainer Portal

| Page | Path | Purpose |
| --- | --- | --- |
| Trainer Dashboard | `/trainer` | Assigned member and session overview. |
| Assigned Members | `/trainer/members` | Search/list assigned members. |
| Assigned Member Detail | `/trainer/members/{id}` | Fitness profile, attendance, plan tabs. |
| Workout Plan Editor | `/trainer/members/{id}/workout-plans/{planId}` | Create or edit workout plans. |
| Diet Plan Editor | `/trainer/members/{id}/diet-plans/{planId}` | Create or edit diet plans. |
| Trainer Classes | `/trainer/classes` | Assigned classes and attendance actions. |
| Trainer Profile | `/trainer/profile` | Trainer account and public profile fields. |

### 2.5 Admin Panel

| Page | Path | Purpose |
| --- | --- | --- |
| Admin Dashboard | `/admin` | Business overview and key metrics. |
| Members | `/admin/members` | Member list, filters, actions. |
| Add Member | `/admin/members/new` | Create member manually. |
| Member Detail | `/admin/members/{id}` | Profile, membership, attendance, payments, trainer assignment. |
| Membership Plans | `/admin/membership-plans` | Manage plan catalog. |
| Membership Plan Detail | `/admin/membership-plans/{id}` | Edit plan details. |
| Member Memberships | `/admin/memberships` | Membership record list and expiry tracking. |
| Payments | `/admin/payments` | Payment list, reconciliation, filters. |
| Payment Detail | `/admin/payments/{id}` | Payment metadata, status, receipt, webhook history. |
| Attendance | `/admin/attendance` | Check-in entry and attendance history. |
| Trainers | `/admin/trainers` | Trainer profiles and status. |
| Trainer Detail | `/admin/trainers/{id}` | Trainer assignments, classes, public profile. |
| Classes | `/admin/classes` | Class calendar/list. |
| Class Detail | `/admin/classes/{id}` | Class schedule, capacity, bookings, attendance. |
| Leads | `/admin/leads` | Lead pipeline and follow-ups. |
| Lead Detail | `/admin/leads/{id}` | Lead notes, status, trial details, conversion. |
| Reports | `/admin/reports` | Report categories and dashboard. |
| Revenue Report | `/admin/reports/revenue` | Revenue analytics. |
| Member Report | `/admin/reports/members` | Membership and retention analytics. |
| Attendance Report | `/admin/reports/attendance` | Attendance trends and peak usage. |
| Lead Report | `/admin/reports/leads` | Lead conversion and source analytics. |
| Class Report | `/admin/reports/classes` | Class occupancy and trainer utilization. |
| Website Content | `/admin/content` | Content management hub. |
| Blog Admin | `/admin/content/blogs` | Blog CRUD. |
| Testimonials Admin | `/admin/content/testimonials` | Testimonial CRUD and approval. |
| Gallery Admin | `/admin/content/gallery` | Gallery asset management. |
| Settings | `/admin/settings` | Gym profile, hours, branding, integrations, notifications. |
| Audit Logs | `/admin/audit-logs` | Critical action history for authorized admins. |

## 3. Page-Level Architecture

### 3.1 Public Website Pages

| Page | Components | Required Data |
| --- | --- | --- |
| Home | Header, hero, facility highlights, membership teaser, trainer teaser, testimonials, gallery preview, blog teaser, CTA band, footer. | Gym profile, published plans, published trainers, testimonials, gallery, latest blogs, SEO metadata. |
| About | Header, story section, facilities, operating hours, location, values, team preview, footer. | Gym content, facilities, business hours, location, media. |
| Membership Plans | Header, plan filters, plan cards, FAQ, trial CTA, footer. | Active published membership plans, plan features, pricing, policy snippets. |
| Plan Detail | Header, plan hero, benefits, inclusions/exclusions, renewal policy, CTA, related plans. | Plan by slug, pricing, duration, features, policy content. |
| Trainers | Header, filter controls, trainer grid, CTA, footer. | Published active trainers, specialties, profile images. |
| Trainer Detail | Profile header, bio, specialties, certifications, class association optional, CTA. | Trainer by slug, profile, media, public schedule optional. |
| Gallery | Header, category filters, image grid, lightbox, CTA. | Published gallery items, categories, alt text, image paths. |
| Testimonials | Header, testimonial list, rating summary optional, CTA. | Published testimonials, member consent state, media. |
| Blog | Header, search/filter, article cards, pagination, newsletter CTA. | Published blogs, categories, tags, authors. |
| Blog Detail | Article header, content, author, related posts, share links, CTA. | Blog by slug, SEO metadata, author, related content. |
| Contact | Contact form, contact details, map, hours, WhatsApp CTA. | Gym contact settings, lead form config, map link. |
| Free Trial | Trial form, benefits, schedule notes, testimonials, FAQ. | Trial policy, business hours, lead form config. |
| Privacy/Terms/Refund | Legal content layout, updated date. | Static legal content or CMS content. |

### 3.2 Member Portal Pages

| Page | Components | Required Data |
| --- | --- | --- |
| Member Dashboard | Status cards, membership summary, attendance snapshot, upcoming classes, notifications, quick actions. | Member profile, active membership, attendance summary, bookings, notifications. |
| Profile | Profile form, emergency contact form, fitness goals, account email state. | User, member profile, validation rules. |
| Membership Details | Current plan card, dates, expiry alert, benefits, renewal CTA, payment link. | Active membership, plan, payment state. |
| Membership History | Table/list of past plans. | Membership records, plan names, dates, statuses. |
| Attendance | Filter bar, attendance list, trend chart, empty state. | Attendance records, aggregate counts. |
| Classes | Calendar/list toggle, filters, class cards. | Upcoming classes, capacity, booking state, eligibility. |
| Class Detail | Class info, trainer, capacity, booking/cancel CTA, policy. | Class record, trainer, member booking, membership eligibility. |
| My Bookings | Upcoming and past booking tabs. | Class bookings, class info, statuses. |
| Workout Plans | Active plan card, history list. | Workout plans assigned to member. |
| Workout Plan Detail | Plan sections, exercises, notes, trainer. | Workout plan details and trainer profile. |
| Diet Plans | Active diet plan card, history list. | Diet plans assigned to member. |
| Diet Plan Detail | Meal schedule, notes, restrictions, trainer. | Diet plan details and trainer profile. |
| Payments | Payment table, status filters, receipt links, renew CTA. | Payments for member, related memberships. |
| Payment Detail | Payment status, method, amount, receipt data. | Payment record and membership link. |
| Notifications | Notification list, unread filter, mark all read. | Notifications for member. |
| Settings | Notification preferences, password/account actions. | User preferences, auth state. |

### 3.3 Trainer Portal Pages

| Page | Components | Required Data |
| --- | --- | --- |
| Trainer Dashboard | Assigned member count, upcoming sessions/classes, recent plan updates. | Trainer profile, assigned members, classes, notifications. |
| Assigned Members | Search, filters, member list, status badges. | Members assigned to trainer, membership status, goals. |
| Assigned Member Detail | Profile summary, attendance, workout tab, diet tab, notes. | Member profile, attendance summary, active plans. |
| Workout Plan Editor | Plan fields, exercise builder, draft/publish actions. | Member, trainer, existing plan optional. |
| Diet Plan Editor | Meal plan builder, restrictions, draft/publish actions. | Member, trainer, existing plan optional. |
| Trainer Classes | Class schedule, capacity, attendance controls. | Classes assigned to trainer, bookings. |
| Trainer Profile | Account fields, public bio, specialties, image. | User and trainer profile. |

### 3.4 Admin Panel Pages

| Page | Components | Required Data |
| --- | --- | --- |
| Admin Dashboard | Metric cards, charts, tables for expiring memberships and leads. | Revenue, member counts, attendance, leads, payments. |
| Members | Search, filters, table, bulk actions future, add CTA. | Members, memberships, assigned trainers. |
| Add Member | Member form, optional membership/payment section. | Plans, trainers, validation config. |
| Member Detail | Tabs: profile, memberships, payments, attendance, bookings, plans, notes. | Member, user, memberships, payments, attendance, bookings, trainer assignment. |
| Membership Plans | Plan table/cards, status filters, create CTA. | Plans, sales count optional. |
| Membership Plan Detail | Plan form, publish/archive actions. | Plan record, audit state. |
| Member Memberships | Membership table, expiry filters, renew action. | Memberships, members, plans. |
| Payments | Payment filters, reconciliation table, create offline payment. | Payments, members, memberships. |
| Payment Detail | Status, provider metadata, receipt, audit events. | Payment, Razorpay references, webhook events optional. |
| Attendance | Check-in search, today's attendance, manual entry form. | Members, attendance records, classes optional. |
| Trainers | Trainer list, status filters, create/edit actions. | Trainers, users, assignment counts. |
| Trainer Detail | Profile, assignments, classes, public visibility. | Trainer, user, assigned members, classes. |
| Classes | Calendar/list, filters, create CTA. | Classes, trainers, booking counts. |
| Class Detail | Class form, bookings table, attendance controls. | Class, trainer, bookings, attendance. |
| Leads | Pipeline columns or table, filters, create lead. | Leads, assigned staff, source data. |
| Lead Detail | Lead profile, notes, follow-up, convert action. | Lead, notes, status history, optional member link. |
| Reports | Report cards, date selector, export actions. | Aggregated report data. |
| Website Content | Content module cards. | Counts and recent content. |
| Blog Admin | Blog table/editor. | Blogs, authors, categories. |
| Testimonials Admin | Approval table/editor. | Testimonials, consent, media. |
| Gallery Admin | Upload grid, categories, publish state. | Gallery assets, storage paths. |
| Settings | Settings forms and integration status. | Gym settings, notification templates, public profile. |
| Audit Logs | Filterable audit table. | Audit events, actors, entities. |

## 4. Navigation Model

### Public Navigation

Primary nav:

- Home
- About
- Membership Plans
- Trainers
- Gallery
- Blog
- Contact
- Free Trial CTA
- Login

Mobile nav should be a compact drawer with the same links and a persistent trial CTA.

### Member Navigation

Primary nav:

- Dashboard
- Profile
- Membership
- Attendance
- Classes
- Workout Plans
- Diet Plans
- Payments
- Notifications

### Trainer Navigation

Primary nav:

- Dashboard
- Assigned Members
- Classes
- Profile

### Admin Navigation

Primary nav:

- Dashboard
- Members
- Memberships
- Payments
- Attendance
- Trainers
- Classes
- Leads
- Reports
- Content
- Settings

## 5. Global Layout Requirements

| Area | Requirement |
| --- | --- |
| Public layout | SEO-first, fast-loading, responsive header/footer, CTA visibility. |
| Portal layout | Authenticated shell with sidebar or top nav, account menu, notifications, role-aware links. |
| Admin layout | Dense operational layout with search, filters, tables, date ranges, and quick actions. |
| Empty states | Include clear action: create, book, renew, contact, or learn more. |
| Error states | Include permission, validation, network, payment, and not-found states. |
| Loading states | Use skeletons for dashboards and tables. |
| Breadcrumbs | Use for admin detail pages, trainer member detail, and long member flows. |

