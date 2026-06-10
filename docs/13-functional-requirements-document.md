# 13 - Functional Requirements Document

## 1. Purpose

This document defines what the Gym Management Website and Member Portal must do. It is organized by product module and includes actors, functional behavior, acceptance criteria, and priority.

Priority legend:

- MVP: Required for first launch.
- Phase 2: Important operational expansion.
- Phase 3: Fitness engagement expansion.
- Future: Later enhancement.

## 2. Public Website Requirements

| ID | Requirement | Actors | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| FR-PUB-001 | Display public home page with gym highlights and conversion CTAs. | Guest, Member, Staff | MVP | Visitor can view hero, highlights, plans teaser, trainers teaser, testimonials, gallery preview, and CTAs. |
| FR-PUB-002 | Display about page with facility and business information. | Guest | MVP | Page shows story, facilities, operating hours, location, and contact details. |
| FR-PUB-003 | Display public membership plans. | Guest, Member | MVP | Only published public plans appear; each plan shows price, duration, features, and CTA. |
| FR-PUB-004 | Display trainer profiles. | Guest, Member | MVP | Only active public trainers appear; detail page includes bio, specialties, and certifications. |
| FR-PUB-005 | Display gallery. | Guest, Member | MVP | Only published images appear; each image has alt text and category. |
| FR-PUB-006 | Display testimonials. | Guest, Member | MVP | Only approved/published testimonials with consent appear. |
| FR-PUB-007 | Display blog listing and blog detail pages. | Guest, Member | MVP | Published posts are crawlable, paginated, and accessible by slug. |
| FR-PUB-008 | Provide contact form. | Guest | MVP | Valid submission creates lead with source `contact` and shows success confirmation. |
| FR-PUB-009 | Provide free trial form. | Guest | MVP | Valid submission creates lead with source `free_trial`; duplicate active trial is handled. |
| FR-PUB-010 | Provide WhatsApp CTA. | Guest | MVP | CTA opens configured WhatsApp number with source-aware message. |
| FR-PUB-011 | Provide legal pages. | Guest | MVP | Privacy, terms, and refund policy pages are publicly accessible. |

## 3. Authentication Requirements

| ID | Requirement | Actors | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| FR-AUTH-001 | Register user account. | Guest | MVP | User can create account with required fields and receives verification flow. |
| FR-AUTH-002 | Login user. | Registered User | MVP | User can authenticate and is redirected to correct role dashboard. |
| FR-AUTH-003 | Logout user. | Authenticated User | MVP | Session ends and protected pages become inaccessible. |
| FR-AUTH-004 | Reset password. | Registered User | MVP | User can request reset email and set a new password. |
| FR-AUTH-005 | Verify email. | Registered User | MVP | User can verify email and verification status is reflected in profile. |
| FR-AUTH-006 | Accept staff/member invite. | Invited User | MVP | Invited user can set password and complete profile. |
| FR-AUTH-007 | Enforce role redirect. | Authenticated User | MVP | Member, trainer, and staff users land on correct dashboard. |

## 4. Member Portal Requirements

| ID | Requirement | Actors | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| FR-MEM-001 | Show member dashboard. | Member | MVP | Dashboard shows membership status, payment status, renewal CTA, and basic notifications. |
| FR-MEM-002 | Manage member profile. | Member | MVP | Member can update allowed own fields; sensitive fields follow validation. |
| FR-MEM-003 | View membership details. | Member | MVP | Member can see current plan, dates, status, and benefits. |
| FR-MEM-004 | View membership history. | Member | MVP | Member can see previous membership periods. |
| FR-MEM-005 | Renew membership. | Member | MVP | Member can choose eligible plan, pay online, and see updated membership after capture. |
| FR-MEM-006 | View payments. | Member | MVP | Member can see own payment history and receipt details. |
| FR-MEM-007 | View attendance. | Member | Phase 2 | Member can see own check-ins and class attendance with filters. |
| FR-MEM-008 | Book classes. | Member | Phase 2 | Member can book eligible classes if capacity exists and membership is active. |
| FR-MEM-009 | Cancel class booking. | Member | Phase 2 | Member can cancel own booking within cancellation rules. |
| FR-MEM-010 | View workout plans. | Member | Phase 3 | Member can view own published workout plans. |
| FR-MEM-011 | View diet plans. | Member | Phase 3 | Member can view own published diet plans. |
| FR-MEM-012 | View notifications. | Member | Phase 2 | Member can see, open, and mark own notifications as read. |

## 5. Admin Portal Requirements

| ID | Requirement | Actors | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| FR-ADM-001 | Show admin dashboard. | Gym Admin | MVP | Dashboard shows revenue, active members, expiring memberships, and lead summary. |
| FR-ADM-002 | Manage members. | Gym Admin, Reception | MVP | Staff can create, search, view, edit allowed fields, and archive members. |
| FR-ADM-003 | Manage membership plans. | Gym Admin | MVP | Admin can create, edit, publish, unpublish, and archive plans. |
| FR-ADM-004 | Manage memberships. | Gym Admin, Reception limited | MVP | Staff can create, renew, and inspect membership records according to permissions. |
| FR-ADM-005 | Manage payments. | Gym Admin, Reception limited | MVP | Staff can view payments, record offline payments, and send receipts. |
| FR-ADM-006 | Process payment webhooks. | System | MVP | Verified Razorpay webhook updates payment and membership status idempotently. |
| FR-ADM-007 | Manage leads. | Gym Admin, Reception | MVP | Staff can view, update, assign, note, and convert leads. |
| FR-ADM-008 | Manage trainers. | Gym Admin | MVP | Admin can create trainer profiles and control public visibility. |
| FR-ADM-009 | Manage public content. | Gym Admin | MVP | Admin can manage blogs, testimonials, and gallery content. |
| FR-ADM-010 | Manage attendance. | Gym Admin, Reception | Phase 2 | Staff can record, view, and correct attendance with audit reason. |
| FR-ADM-011 | Manage classes. | Gym Admin | Phase 2 | Admin can create classes, set capacity, assign trainer, and manage bookings. |
| FR-ADM-012 | Generate reports. | Gym Admin | MVP/Phase 2 | Admin can view revenue and member reports in MVP, then attendance/leads/classes in Phase 2. |
| FR-ADM-013 | Manage settings. | Gym Admin | MVP | Admin can update gym profile, hours, contact, branding, and notification settings. |
| FR-ADM-014 | View audit logs. | Gym Admin | MVP | Admin can view critical events for assigned gym. |

## 6. Trainer Portal Requirements

| ID | Requirement | Actors | Priority | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| FR-TRN-001 | Show trainer dashboard. | Trainer | Phase 2 | Trainer sees assigned members and upcoming classes. |
| FR-TRN-002 | View assigned members. | Trainer | Phase 2 | Trainer can only view members assigned to them. |
| FR-TRN-003 | View assigned classes. | Trainer | Phase 2 | Trainer can view own upcoming classes and bookings. |
| FR-TRN-004 | Mark class attendance. | Trainer | Phase 2 | Trainer can mark attendance only for assigned classes where allowed. |
| FR-TRN-005 | Create workout plans. | Trainer | Phase 3 | Trainer can create draft and published workout plans for assigned members. |
| FR-TRN-006 | Create diet plans. | Trainer | Phase 3 | Trainer can create draft and published diet plans for assigned members. |
| FR-TRN-007 | Update own public profile. | Trainer | Phase 2 | Trainer can update allowed bio/profile fields subject to admin approval if configured. |

## 7. Payment Requirements

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| FR-PAY-001 | Create Razorpay order from selected plan. | MVP | Server calculates amount and creates order. |
| FR-PAY-002 | Verify Razorpay payment result. | MVP | Signature/webhook validation prevents forged success. |
| FR-PAY-003 | Activate membership after captured payment. | MVP | Membership changes to active/scheduled only after verified capture. |
| FR-PAY-004 | Record offline payment. | MVP | Staff can record payment with method, amount, reference, and recorded-by user. |
| FR-PAY-005 | Send payment receipt. | MVP | Successful payment triggers receipt email and member payment history update. |
| FR-PAY-006 | Handle failed payment. | MVP | Failed payment is recorded and user can retry. |
| FR-PAY-007 | Handle refunds. | Phase 2 | Admin can initiate/record refund and audit event. |

## 8. Notification Requirements

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| FR-NOT-001 | Send trial confirmation. | MVP | Valid trial request sends confirmation if email exists. |
| FR-NOT-002 | Send payment receipt. | MVP | Captured payment sends receipt email. |
| FR-NOT-003 | Send membership expiry reminder. | MVP/Phase 2 | Expiring members receive reminder based on configured schedule. |
| FR-NOT-004 | Create in-app notifications. | Phase 2 | Notifications appear in member portal and can be marked read. |
| FR-NOT-005 | Send class booking notification. | Phase 2 | Booking/cancellation creates member notification. |
| FR-NOT-006 | Send plan update notification. | Phase 3 | Workout/diet publish creates member notification. |

## 9. Reporting Requirements

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| FR-REP-001 | Revenue report. | MVP | Admin can filter by date range, method, and plan. |
| FR-REP-002 | Active/expired members report. | MVP | Admin can view member counts and expiry list. |
| FR-REP-003 | Lead conversion report. | Phase 2 | Admin can view funnel by source and status. |
| FR-REP-004 | Attendance report. | Phase 2 | Admin can view check-in trends and peak times. |
| FR-REP-005 | Class report. | Phase 2 | Admin can view occupancy, cancellations, and trainer utilization. |
| FR-REP-006 | Export reports. | Phase 2 | Admin can export selected reports with audit logging. |

## 10. Content Management Requirements

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| FR-CMS-001 | Manage blog posts. | MVP | Admin can create, edit, publish, archive posts with SEO fields. |
| FR-CMS-002 | Manage testimonials. | MVP | Admin can publish only testimonials with consent. |
| FR-CMS-003 | Manage gallery. | MVP | Admin can upload/manage images with alt text and publish state. |
| FR-CMS-004 | Manage trainer public profiles. | MVP | Admin controls public visibility of trainers. |
| FR-CMS-005 | Manage website settings. | MVP | Admin can update contact, hours, social links, and branding. |

## 11. Cross-Functional Acceptance Rules

- All mutations must validate input server-side.
- All protected reads and writes must verify permission.
- All list screens must support pagination.
- All forms must show validation, loading, success, and error states.
- Business-critical mutations must write audit logs.
- Public form submissions must be rate limited.
- Payment and membership state transitions must be idempotent.

