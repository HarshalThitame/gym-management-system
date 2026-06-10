# 01 - Business Requirements Document

## 1. Product Context

A commercial gym needs to sell memberships, acquire leads, manage active members, record attendance, coordinate trainers, run group classes, process payments, and communicate with members. The current alternatives are often manual registers, spreadsheets, WhatsApp, fragmented payment records, and disconnected website forms. This product centralizes those workflows into one public website, member portal, and admin panel.

## 2. Business Goals

| Goal | Description | Success Metric |
| --- | --- | --- |
| Increase membership sales | Convert website visitors and walk-ins into paid members. | Lead-to-member conversion rate, monthly new memberships |
| Reduce administrative effort | Automate member records, renewals, payment receipts, reminders, and reporting. | Staff time saved, fewer manual errors |
| Improve retention | Remind members before expiry, improve engagement through attendance, classes, and plans. | Renewal rate, churn rate, attendance frequency |
| Improve payment collection | Support online payment and clear reconciliation. | Payment success rate, overdue balance value |
| Improve trainer productivity | Let trainers view assigned members and update workout or diet plans. | Trainer plan update frequency, member progress engagement |
| Build local brand presence | Use SEO, local SEO, testimonials, gallery, and blog content to attract prospects. | Organic traffic, Google Business clicks, inquiry volume |
| Support future growth | Create a scalable foundation for multiple branches, mobile app, QR attendance, and AI-assisted coaching. | Ability to add branches and modules without redesign |

## 3. Revenue Streams

| Revenue Stream | Description | Product Support |
| --- | --- | --- |
| Membership subscriptions | Monthly, quarterly, half-yearly, annual, and custom memberships. | Plan catalog, online checkout, renewals, expiry tracking |
| Personal training packages | Add-on packages assigned to trainer-led sessions. | Trainer assignments, package payments, future session scheduling |
| Group classes | Yoga, Zumba, HIIT, CrossFit-style sessions, dance fitness, strength classes. | Class catalog, capacity, bookings, attendance |
| Free trial conversion | Trial sessions used as acquisition funnel. | Trial lead capture, confirmation email, follow-up status |
| Merchandise and supplements | Optional in future. | Future POS/inventory module |
| Events and workshops | Paid workshops, transformation programs, challenges. | Future event booking and payment module |
| Corporate wellness | Bulk plans for companies. | Future B2B account and invoice module |

## 4. Membership Models

| Model | Description | Rules |
| --- | --- | --- |
| Fixed duration membership | Starts on purchase or activation date and ends after configured duration. | Duration in days/months; renewal creates new membership period |
| Recurring membership | Member is charged periodically. | MVP can support manual renewal; recurring mandate can be Phase 2 or later |
| Trial membership | Free or discounted short access. | Limited duration, one active trial per phone/email by default |
| Personal training add-on | Extra package linked to trainer and member. | Can coexist with base membership |
| Class pass | Limited class bookings over a period. | Future enhancement unless included in Phase 2 |
| Family/corporate plan | Multiple members under one payer. | Future enhancement |

## 5. Staff and Operational Roles

### Super Admin

Owns the platform-level configuration. In a single-gym deployment, this may be the business owner. In a SaaS or multi-branch model, this role manages all gyms, billing, global settings, and cross-tenant governance.

### Gym Admin

Manages a specific gym's operations: members, plans, trainers, payments, attendance, leads, classes, reports, public content, and settings.

### Reception Staff

Handles front-desk activity: walk-in inquiries, member creation, check-ins, payment collection entry, trial scheduling, and renewal reminders.

### Trainer

Handles member fitness delivery: assigned members, workout plans, diet plans, class sessions, attendance support, and progress notes.

### Member

Uses the portal to view profile, membership, attendance, bookings, plans, payments, and notifications.

### Guest Visitor

Uses the public website to learn about the gym, view plans, submit inquiries, book trials, and begin membership purchase.

## 6. Customer Journey

| Stage | User Need | Product Touchpoints |
| --- | --- | --- |
| Awareness | Find a local gym and understand credibility. | SEO pages, Google Business, home, about, gallery, testimonials, blog |
| Consideration | Compare plans, trainers, facilities, timing, and trust signals. | Membership page, trainers page, testimonials, contact |
| Lead capture | Ask a question or book free trial. | Contact form, free trial form, WhatsApp link |
| Trial | Attend trial and receive follow-up. | Lead status, trial date, notifications, admin follow-up |
| Purchase | Choose plan and pay. | Plan selection, Razorpay checkout, payment receipt |
| Onboarding | Create profile, verify email, understand membership. | Auth, profile, membership details, welcome email |
| Engagement | Attend gym, book classes, follow plans. | Attendance, class booking, workout plans, diet plans |
| Renewal | Renew before expiry. | Expiry reminders, renewal CTA, payment |
| Retention | Stay engaged and satisfied. | Notifications, trainer updates, progress visibility, offers |

## 7. Business Requirements

### BR-01 Public Website

The system must provide a public website for marketing, trust-building, lead generation, membership plan discovery, trainer profiles, gallery, testimonials, blog content, and contact.

### BR-02 Lead Management

The system must capture leads from contact, free trial, membership interest, WhatsApp click tracking, and newsletter forms. Staff must be able to update lead status and follow-up notes.

### BR-03 Membership Sales

The system must allow admins to create plans and allow members or staff to create memberships. Online payment through Razorpay must be supported.

### BR-04 Member Management

The system must maintain member profiles, emergency contacts, fitness goals, membership status, attendance, payments, bookings, and assigned trainer relationships.

### BR-05 Attendance Management

The system must record gym check-ins and class attendance. MVP can support manual attendance by staff; future phases can add QR, biometric, or NFC check-in.

### BR-06 Class Booking

The system must let admins create group classes and let eligible members book available slots. Capacity, cancellation windows, and booking status must be tracked.

### BR-07 Trainer Operations

The system must let trainers view assigned members and create or update workout and diet plans for them.

### BR-08 Payment Management

The system must store Razorpay order/payment metadata, payment status, amount, currency, receipt reference, and membership linkage.

### BR-09 Reporting

The system must provide reports for revenue, active members, expiring memberships, attendance, class occupancy, lead conversion, and trainer load.

### BR-10 Notifications

The system must send and display notifications for payment confirmation, trial confirmation, membership expiry, class booking, class cancellation, and plan updates.

### BR-11 Access Control

The system must enforce role-based access control and prevent users from seeing or mutating data outside their permissions.

### BR-12 SaaS Readiness

The architecture should support future multi-gym or multi-branch expansion with tenant-aware data modeling, even if the MVP launches for one gym.

## 8. Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-001 | Guest visitors can view public pages without login. | MVP |
| FR-002 | Guest visitors can submit contact inquiries and free trial requests. | MVP |
| FR-003 | Guest visitors can view membership plans and start purchase flow. | MVP |
| FR-004 | Users can register, log in, log out, reset password, and verify email. | MVP |
| FR-005 | Members can view and update allowed profile fields. | MVP |
| FR-006 | Members can view membership status, start date, end date, plan, and renewal action. | MVP |
| FR-007 | Members can view payment history and receipts. | MVP |
| FR-008 | Admins can create, read, update, archive, and search members. | MVP |
| FR-009 | Admins can create, read, update, archive, and reorder membership plans. | MVP |
| FR-010 | Admins can record offline payments and reconcile online payments. | MVP |
| FR-011 | Admins and reception staff can record attendance manually. | Phase 2 |
| FR-012 | Members can view attendance history. | Phase 2 |
| FR-013 | Admins can create classes with trainer, capacity, schedule, and eligibility. | Phase 2 |
| FR-014 | Members can book and cancel classes subject to rules. | Phase 2 |
| FR-015 | Trainers can view assigned members. | Phase 2 |
| FR-016 | Trainers can create and update workout plans. | Phase 3 |
| FR-017 | Trainers can create and update diet plans. | Phase 3 |
| FR-018 | Admins can manage website content such as blogs, testimonials, gallery, and trainers. | MVP |
| FR-019 | Admins can view dashboard metrics and reports. | MVP |
| FR-020 | System sends transactional emails through Resend. | MVP |
| FR-021 | System handles Razorpay webhook events to update payment and membership state. | MVP |
| FR-022 | Members receive in-app notifications. | Phase 2 |
| FR-023 | Public pages support SEO metadata and schema markup. | MVP |
| FR-024 | App can be installed as a PWA and works with basic offline shell for member portal. | Phase 2 |

## 9. Non Functional Requirements

| Category | Requirement |
| --- | --- |
| Availability | Public website and portals should target 99.5 percent monthly availability for MVP. |
| Reliability | Payment and membership activation must be idempotent and webhook-safe. |
| Maintainability | Codebase should use typed domain models, server-side validation, and modular route groups. |
| Observability | Log auth, payment, membership, attendance, and admin mutation events. |
| Compliance | Store only necessary personal and fitness data; protect sensitive fields. |
| Portability | Use standard PostgreSQL and avoid lock-in beyond deliberate platform choices. |
| Usability | Flows must work for non-technical staff and mobile-first members. |
| Internationalization readiness | MVP may launch in English, but content and currency formatting should not block future localization. |

## 10. Security Requirements

| ID | Requirement |
| --- | --- |
| SR-001 | All authenticated routes must require a valid Supabase session. |
| SR-002 | All privileged actions must verify role and permission server-side. |
| SR-003 | PostgreSQL row-level security must be enabled for user-owned and tenant-scoped tables. |
| SR-004 | Razorpay webhooks must verify signature before processing. |
| SR-005 | Password reset and email verification must use time-limited tokens handled by Supabase Auth. |
| SR-006 | Admin actions that mutate business-critical data must be audit logged. |
| SR-007 | Public forms must use rate limiting and bot protection. |
| SR-008 | Sensitive environment variables must be stored only in Vercel/Supabase secrets, never in the client bundle. |
| SR-009 | Members must not access other members' profile, payment, plan, attendance, or booking data. |
| SR-010 | Staff access should be least-privilege and revocable. |

## 11. Scalability Requirements

| Area | Requirement |
| --- | --- |
| Data model | Include tenant or gym ownership fields for future multi-branch/multi-gym support. |
| Payments | Webhook processing must be idempotent by provider event ID and payment ID. |
| Queries | Dashboards must use indexed tables, summary views, or cached aggregates for high traffic. |
| Media | Gallery and trainer images should use managed object storage and optimized delivery. |
| Public website | Static or cached rendering should be used for marketing pages where possible. |
| Admin reports | Large date-range reports should paginate and support asynchronous export in later phases. |

## 12. Performance Requirements

| Area | Requirement |
| --- | --- |
| Public pages | Largest Contentful Paint under 2.5 seconds on mobile for key pages. |
| Portal pages | Main dashboards should load meaningful content within 2 seconds after authentication. |
| Search | Member and lead search should respond within 500 ms for typical datasets. |
| Database | High-cardinality queries must use indexes on foreign keys, status, date ranges, and search fields. |
| Images | Use responsive image sizes, lazy loading, and optimized formats. |
| Forms | Submission should provide immediate feedback and avoid duplicate submissions. |

## 13. Accessibility Requirements

| Area | Requirement |
| --- | --- |
| Standards | Target WCAG 2.2 AA for public website and portals. |
| Keyboard | All interactive controls must be keyboard accessible. |
| Focus | Visible focus states must be present across forms, nav, dialogs, and buttons. |
| Semantics | Use proper headings, labels, landmarks, tables, and form descriptions. |
| Contrast | Text and UI controls must meet color contrast requirements. |
| Motion | Motion should respect reduced-motion preferences. |
| Errors | Form errors must be text-based, close to fields, and announced to assistive technology. |
| Touch targets | Mobile controls should have comfortable tap areas. |

## 14. Key Business Assumptions

| Assumption | Impact |
| --- | --- |
| MVP starts with a single gym but should not block multi-branch expansion. | Include `gym_id` or tenant ownership in operational tables. |
| Razorpay is the primary online payment provider. | Payment model includes Razorpay order, payment, signature, and webhook metadata. |
| Supabase Auth is the authentication provider. | User records should link to Supabase auth user IDs. |
| Staff may collect offline payments. | Payment model supports cash, UPI, card, bank transfer, and online provider payments. |
| Attendance can start manual and later become QR-based. | Attendance table should include check-in source and recorded-by user. |
| Website content should be manageable by admins. | Blogs, testimonials, trainers, gallery, and plans require admin CRUD. |

## 15. Out of Scope for MVP

- Native mobile apps.
- Biometric attendance integration.
- Automated recurring mandates.
- Full POS and inventory management.
- Payroll and trainer commission automation.
- Corporate account billing.
- AI fitness coach.
- Advanced progress analytics with body measurements and wearables.

