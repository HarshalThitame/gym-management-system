# 14 - Non Functional Requirements Document

## 1. Purpose

This document defines quality attributes and operational constraints for the Gym Management Website and Member Portal.

## 2. Availability and Reliability

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-REL-001 | Public website availability. | 99.5 percent monthly uptime target for MVP. |
| NFR-REL-002 | Portal availability. | 99.5 percent monthly uptime target for MVP. |
| NFR-REL-003 | Payment reliability. | Payment state must be recoverable from Razorpay webhook/events. |
| NFR-REL-004 | Idempotency. | Payment webhooks, membership activation, and booking creation must be idempotent. |
| NFR-REL-005 | Data integrity. | Financial, membership, and attendance records must not be hard-deleted by normal users. |
| NFR-REL-006 | Error handling. | User-facing errors must be clear and not expose secrets or internal details. |

## 3. Performance

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-PERF-001 | Lighthouse score. | 95+ on public production pages. |
| NFR-PERF-002 | LCP. | Under 2.5 seconds on key public pages. |
| NFR-PERF-003 | INP. | Under 200 ms. |
| NFR-PERF-004 | CLS. | Under 0.1. |
| NFR-PERF-005 | Dashboard load. | Meaningful dashboard content within 2 seconds after authenticated request under normal load. |
| NFR-PERF-006 | Search response. | Member/lead search under 500 ms for typical MVP dataset. |
| NFR-PERF-007 | Report response. | Default reports load within 3 seconds for current-month data under MVP scale. |

## 4. Scalability

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-SCALE-001 | Tenant readiness. | Operational tables include `gym_id` for future multi-gym support. |
| NFR-SCALE-002 | Pagination. | All large lists must paginate. |
| NFR-SCALE-003 | Indexed queries. | Foreign keys, status fields, date ranges, and common search fields must be indexed. |
| NFR-SCALE-004 | Reporting growth. | Heavy reports can move to views/materialized views without schema redesign. |
| NFR-SCALE-005 | Media growth. | Gallery/blog/trainer media stored in object storage, not database blobs. |
| NFR-SCALE-006 | Payment volume. | Webhook processing remains idempotent and queue-ready for later asynchronous processing. |

## 5. Security

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-SEC-001 | Authentication. | Supabase Auth required for all protected portals. |
| NFR-SEC-002 | Authorization. | Role and gym scope enforced server-side and through RLS. |
| NFR-SEC-003 | Secrets. | Service role, Razorpay secret, webhook secret, and Resend API key are server-only. |
| NFR-SEC-004 | Payment security. | Razorpay webhook signatures verified before state changes. |
| NFR-SEC-005 | Auditability. | Critical admin/staff/system changes are audit logged. |
| NFR-SEC-006 | Public form abuse. | Public forms are rate limited and validated. |
| NFR-SEC-007 | Least privilege. | Staff roles receive only required access. |
| NFR-SEC-008 | Data privacy. | Members cannot access other members' personal, payment, attendance, or plan data. |

## 6. Accessibility

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-A11Y-001 | Standard. | Target WCAG 2.2 AA. |
| NFR-A11Y-002 | Keyboard access. | All controls usable by keyboard. |
| NFR-A11Y-003 | Focus states. | Visible focus styles for links, buttons, fields, dialogs, and menus. |
| NFR-A11Y-004 | Form labels. | All inputs have accessible labels and errors. |
| NFR-A11Y-005 | Contrast. | Text and controls meet AA contrast. |
| NFR-A11Y-006 | Alt text. | Public images require descriptive alt text. |
| NFR-A11Y-007 | Motion. | Motion respects reduced-motion preference. |
| NFR-A11Y-008 | Tables. | Admin tables use accessible headers and controls. |

## 7. Usability

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-USE-001 | Mobile-first public pages. | Public site works smoothly on common mobile screens. |
| NFR-USE-002 | Staff workflows. | Admin/reception actions require minimal steps for common tasks. |
| NFR-USE-003 | Member clarity. | Membership status and renewal action are obvious on dashboard. |
| NFR-USE-004 | Error recovery. | Forms preserve user input after validation errors. |
| NFR-USE-005 | Empty states. | Empty states explain the state and provide a relevant action. |
| NFR-USE-006 | Consistent navigation. | Public, member, trainer, and admin navigation remain role-appropriate and predictable. |

## 8. Maintainability

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-MAINT-001 | Typed implementation. | TypeScript types used for domain models and API payloads. |
| NFR-MAINT-002 | Validation. | Shared server-side validation schemas for forms and APIs. |
| NFR-MAINT-003 | Modular architecture. | Public, auth, member, trainer, and admin modules separated. |
| NFR-MAINT-004 | Reusable UI. | Shadcn UI components composed consistently. |
| NFR-MAINT-005 | Testability. | Critical payment, auth, and authorization flows covered by tests. |
| NFR-MAINT-006 | Documentation. | API, schema, roles, and deployment assumptions documented. |

## 9. Observability

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-OBS-001 | Error logging. | Server and client errors captured in production. |
| NFR-OBS-002 | Payment logs. | Payment order, callback, and webhook failures traceable. |
| NFR-OBS-003 | Audit logs. | Business-critical mutations searchable by actor and entity. |
| NFR-OBS-004 | Performance monitoring. | Core Web Vitals and slow API routes monitored. |
| NFR-OBS-005 | Form conversion tracking. | Trial, contact, WhatsApp, and checkout events tracked where analytics is enabled. |

## 10. Compatibility

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-COMP-001 | Browsers. | Latest two major versions of Chrome, Edge, Firefox, and Safari. |
| NFR-COMP-002 | Mobile. | Modern Android Chrome and iOS Safari. |
| NFR-COMP-003 | PWA. | Installable behavior in Phase 2 for supported browsers. |
| NFR-COMP-004 | Responsive UI. | Layout supports mobile, tablet, laptop, and desktop. |

## 11. Compliance and Privacy

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-PRIV-001 | Data minimization. | Collect only required member, lead, and payment data. |
| NFR-PRIV-002 | Consent. | Marketing and testimonial publishing require consent. |
| NFR-PRIV-003 | Legal pages. | Privacy, terms, and refund policy visible before purchase. |
| NFR-PRIV-004 | Sensitive notes. | Medical notes and diet data access limited by role. |
| NFR-PRIV-005 | Export control. | Report exports restricted and audited. |

## 12. Deployment and Operations

| ID | Requirement | Target |
| --- | --- | --- |
| NFR-OPS-001 | Hosting. | Deploy on Vercel with production and preview environments. |
| NFR-OPS-002 | Database. | Supabase PostgreSQL with backups according to selected plan. |
| NFR-OPS-003 | Environment variables. | Managed through Vercel and Supabase dashboards. |
| NFR-OPS-004 | Email domain. | Resend sender domain configured and verified before production email. |
| NFR-OPS-005 | Payment setup. | Razorpay production keys and webhook URL configured before launch. |
| NFR-OPS-006 | Rollback. | Vercel deployment rollback available for failed releases. |

