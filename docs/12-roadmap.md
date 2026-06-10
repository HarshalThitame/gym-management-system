# 12 - MVP Scope and Future Roadmap

## 1. Roadmap Principles

- MVP should launch a credible website, lead funnel, membership management, and payment flow.
- Operational modules should be introduced in phases to reduce risk.
- Payment, security, and role access must be production-grade from MVP.
- Data model should support future features even if UI modules ship later.
- Avoid overbuilding advanced fitness tracking before core sales and operations work reliably.

## 2. MVP Scope

### 2.1 MVP Goals

- Launch public gym website with SEO-ready pages.
- Capture inquiries and free trial leads.
- Manage members and membership plans.
- Sell memberships through Razorpay.
- Track payment status and receipts.
- Provide basic member portal.
- Provide admin dashboard and operational management.
- Support transactional emails.

### 2.2 MVP Features

| Module | Included Features |
| --- | --- |
| Public Website | Home, About, Membership Plans, Trainers, Gallery, Testimonials, Blog, Contact, Free Trial, legal pages. |
| Auth | Register, login, logout, password reset, email verification, invite flow. |
| Member Portal | Profile, membership details, payment history, renewal/payment CTA, basic notifications. |
| Admin Portal | Dashboard, members, membership plans, memberships, payments, leads, trainers, content, settings. |
| Payments | Razorpay order creation, verified payment processing, webhooks, offline payment recording, receipts. |
| Email | Verification, password reset through Supabase, trial confirmation, payment receipt, membership expiry reminder. |
| SEO | Metadata, sitemap, robots, schema markup, local SEO, Google Business links. |
| Security | RBAC, RLS, audit logs, rate-limited public forms, secure secrets. |
| Deployment | Vercel production and preview deployments, Supabase project, environment variables. |

### 2.3 MVP Exclusions

- QR check-in.
- Class booking.
- Automated recurring billing mandates.
- Full workout tracking.
- Full diet tracking.
- Mobile app.
- AI fitness coach.
- Inventory/POS.
- Corporate accounts.

### 2.4 MVP Acceptance Criteria

| Area | Acceptance Criteria |
| --- | --- |
| Website | All public pages are responsive, SEO-ready, and load with Lighthouse 95+ target. |
| Leads | Contact and free trial forms create leads and notify staff. |
| Auth | Users can register, verify email, login, reset password, and reach role dashboard. |
| Members | Admin can create, search, update, and archive members. |
| Plans | Admin can create and publish membership plans. |
| Payments | Member can purchase/renew plan through Razorpay; webhook activates membership. |
| Offline Payments | Staff can record offline payment and activate membership according to permission. |
| Member Portal | Member can view profile, membership status, payments, and renewal CTA. |
| Admin Dashboard | Admin can see revenue, active members, expiring memberships, and leads summary. |
| Security | Member cannot access other member data; trainer/admin permissions enforced. |
| Emails | Payment receipt and trial confirmation are sent through Resend where configured. |

## 3. Phase 2

### 3.1 Phase 2 Goals

- Improve operational depth after core membership and payment workflows stabilize.
- Add attendance and class booking.
- Improve notifications and staff productivity.
- Add PWA support for member convenience.

### 3.2 Phase 2 Features

| Module | Features |
| --- | --- |
| Attendance | Manual check-in, attendance history, attendance reports, correction audit. |
| Class Booking | Admin class creation, class capacity, member booking/cancellation, trainer class view. |
| Trainer Dashboard | Assigned members, upcoming classes, basic member visibility. |
| Notifications | In-app notification center, unread counts, class and membership notifications. |
| Reports | Attendance report, lead conversion report, class occupancy report. |
| PWA | Installable member portal, app manifest, safe static asset caching, offline fallback. |
| Lead Follow-up | Status history, assigned staff, follow-up reminders. |
| Expiry Automation | Scheduled membership expiry reminders. |

### 3.3 Phase 2 Acceptance Criteria

| Area | Acceptance Criteria |
| --- | --- |
| Attendance | Staff can check in members and members can view own attendance. |
| Classes | Admin can create classes; members can book if eligible and capacity exists. |
| Trainer | Trainer can view assigned classes and assigned members. |
| Notifications | Members receive booking and expiry notifications. |
| Reports | Admin can analyze attendance, lead conversion, and class occupancy. |
| PWA | Member portal can be installed and provides safe offline fallback. |

## 4. Phase 3

### 4.1 Phase 3 Goals

- Expand from operations into member fitness engagement.
- Give trainers structured tools for workout and diet planning.
- Improve retention through personalized plans and progress touchpoints.

### 4.2 Phase 3 Features

| Module | Features |
| --- | --- |
| Workout Plans | Trainer creates, drafts, publishes, and updates workout plans. |
| Diet Plans | Trainer creates, drafts, publishes, and updates diet plans. |
| Member Plan Views | Members view current and historical workout/diet plans. |
| Plan Notifications | Members receive notifications when plans change. |
| Trainer Workload | Admin sees missing plan counts and trainer assignment load. |
| Progress Notes | Trainers add private/admin-visible notes for assigned members. |
| Plan Templates | Reusable workout/diet templates for trainers. |

### 4.3 Phase 3 Acceptance Criteria

| Area | Acceptance Criteria |
| --- | --- |
| Workout Plans | Assigned trainer can create and publish a plan for member. |
| Diet Plans | Assigned trainer can create and publish a diet plan for member. |
| Member Views | Member can view own published plans only. |
| Authorization | Trainer cannot access unassigned member plans. |
| Notifications | Plan publish/update creates in-app notification. |

## 5. Future Enhancements

| Enhancement | Description | Business Value |
| --- | --- | --- |
| Mobile App | Native or cross-platform mobile app for members and trainers. | Better engagement and retention. |
| QR Check-in | Member QR or dynamic QR attendance. | Faster attendance and reduced staff work. |
| Biometric Integration | Integrate with fingerprint/face attendance devices. | Operational automation. |
| AI Fitness Coach | AI-assisted workout suggestions, Q&A, adherence nudges. | Differentiated member experience. |
| Recurring Billing | Automated mandates/subscriptions where supported. | Better payment collection. |
| Corporate Accounts | Company accounts, employee member groups, invoices. | B2B revenue. |
| POS/Inventory | Sell merchandise, supplements, and services. | Additional revenue tracking. |
| Multi-Branch Management | Branch pages, branch-specific plans, staff, reports. | Business expansion support. |
| Advanced Analytics | Churn prediction, retention cohorts, trainer performance. | Better decisions. |
| Progress Tracking | Body measurements, progress photos, goals, milestones. | Member motivation. |
| WhatsApp Automation | Template messages and follow-up reminders. | Higher lead conversion. |
| Referral Program | Member referral tracking and rewards. | Organic acquisition. |
| Coupons and Offers | Promo codes, seasonal campaigns, plan discounts. | Sales campaigns. |
| Waitlist Management | Waitlist for full classes. | Better class utilization. |
| Push Notifications | Web push or mobile push. | Timely engagement. |

## 6. Recommended Build Sequence

### 6.1 Foundation

1. Project setup with Next.js, TypeScript, Tailwind CSS, Shadcn UI, Supabase, Vercel.
2. Environment variable strategy for Supabase, Razorpay, Resend.
3. Database schema, RLS policies, seed roles.
4. Auth flows and role-aware routing.
5. Shared validation and authorization utilities.

### 6.2 Public Website and Content

1. Public layout, navigation, footer.
2. Home, about, plans, trainers, gallery, testimonials, blog, contact, free trial.
3. Admin content management for plans, trainers, gallery, testimonials, blogs.
4. SEO metadata, sitemap, robots, schema markup.

### 6.3 Member and Admin Operations

1. Member management.
2. Membership plan management.
3. Member portal profile and membership views.
4. Admin dashboard basics.
5. Leads management.

### 6.4 Payments and Emails

1. Razorpay order creation.
2. Razorpay checkout integration.
3. Webhook verification and idempotency.
4. Membership activation/renewal.
5. Resend payment receipts and trial confirmations.
6. Offline payment entry.

### 6.5 Hardening and Launch

1. RLS and authorization testing.
2. Payment failure and webhook retry testing.
3. Lighthouse optimization.
4. Accessibility review.
5. Production deployment.
6. Admin onboarding and content entry.

## 7. Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Payment webhook mismatch or delay | Membership activation confusion. | Use pending state, idempotent webhook processing, admin reconciliation screen. |
| Weak authorization | Data leakage across members or roles. | Server-side checks, RLS, security test checklist. |
| Scope creep | MVP delay. | Keep attendance/classes/plans phased unless explicitly promoted. |
| Poor content readiness | Website launch quality suffers. | Provide content checklist and admin CMS. |
| SEO underperformance | Lower organic leads. | Implement metadata/schema/local SEO from MVP and publish blog content regularly. |
| Staff usability issues | Operational adoption drops. | Dense admin UX, search-first workflows, simple forms, clear empty/error states. |
| Duplicate leads/members | Messy CRM and member records. | Duplicate detection by phone/email and merge/link workflows in later phase. |
| Report performance | Slow dashboards with data growth. | Indexes, pagination, aggregate views, date range limits. |

## 8. Implementation Strategy

### 8.1 Product Strategy

- Treat public website and lead funnel as revenue-critical, not secondary marketing pages.
- Treat payments and membership state as the highest-risk operational workflow.
- Keep member portal simple in MVP: status, payments, renewal, profile.
- Add attendance and bookings after membership/payment flows are stable.

### 8.2 Technical Strategy

- Use Next.js App Router with route groups for public, auth, member, trainer, and admin areas.
- Use Supabase Auth and PostgreSQL with RLS.
- Use Razorpay webhooks as source of truth for online payment capture.
- Use Resend for transactional email.
- Use server-side validation and authorization for every mutation.
- Use cached rendering for public pages and dynamic rendering for portals.

### 8.3 UX Strategy

- Public website should optimize for trust and conversion.
- Admin panel should optimize for repeated operational work, search, filtering, and fast actions.
- Member portal should optimize for clarity: membership status, renewal, classes, plans, payments.
- Trainer portal should optimize for assigned member workflow and plan updates.

## 9. Definition of Done for Phase 1 Documentation

Phase 1 is complete when the following exist:

- Business requirements.
- Functional requirements.
- Non-functional requirements.
- Role matrix.
- Feature inventory.
- User flows.
- Sitemap and page architecture.
- Database schema.
- API specification.
- Dashboard requirements.
- Security specification.
- SEO and marketing requirements.
- Performance requirements.
- MVP scope and roadmap.

