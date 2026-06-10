# Phase 15 - Final QA, Security Audit, UAT, and Go-Live Readiness

Date: 2026-06-10  
Scope: Gym Management Platform built with Next.js 15, TypeScript, Supabase/PostgreSQL, Tailwind CSS v4, Shadcn UI, Vercel, Razorpay, and Resend.

## 1. Executive Summary

The platform has reached a production-candidate state for code quality, static validation, unit coverage, protected-route smoke testing, security header hardening, and dependency audit status.

Launch recommendation: Conditional Go-Live Approval.

The application can proceed to staging release and controlled UAT. Public production launch should be approved only after the staging gates in this document pass: Supabase migration/RLS validation, live Razorpay webhook validation, Lighthouse audit, cross-browser testing beyond Chromium, load testing, backup restore drill, and production environment review.

## 2. Automated Verification Status

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript strict check | Passed | `npm run typecheck` |
| ESLint | Passed | `npm run lint` |
| Unit tests | Passed | `npm run test` - 10 files, 64 tests |
| Dependency audit | Passed | `npm audit --omit=dev` - 0 vulnerabilities after PostCSS remediation |
| Production build | Passed | `npm run build` |
| E2E protected route suite | Passed | `npm run test:e2e` - 10 tests across desktop/mobile Chromium |
| Local smoke | Passed | `/` returns 200; `/admin/settings` and `/admin/reports` redirect anonymous users to login |
| Security header smoke | Passed | CSP, HSTS, COOP, CORP, frame denial, nosniff, referrer policy, and permissions policy present |

## 3. Full System Audit

| Module | Status | Implementation Evidence | Launch Notes |
| --- | --- | --- | --- |
| Public website | Complete | Public route group, SEO metadata, sitemap, robots, lead forms | Needs Lighthouse and content review in production domain. |
| Authentication | Complete foundation | Supabase Auth helpers, protected route middleware, login/register/reset flows | Requires live Supabase Auth email templates and redirect URLs. |
| RBAC | Complete foundation | `lib/rbac.ts`, role matrix tests, protected layouts | Branch-specific permissions added in Phase 14; verify with seeded users. |
| Memberships | Complete foundation | Member onboarding, plans, lifecycle actions, reports | UAT must validate duplicate-active-membership rules on live DB. |
| Payments | Complete foundation | Financial schema, invoice/PDF helpers, Razorpay signature verification helpers | Live webhook route/workflow must be tested with Razorpay test mode before production. |
| Attendance | Complete foundation | QR tokens, manual check-in, access validation, analytics | Hardware integrations remain future-ready, not implemented. |
| Classes | Complete foundation | Class management, recurring sessions, booking, waitlist, reports | UAT must validate capacity and waitlist promotion with real data. |
| Trainer operations | Complete foundation | Trainer profiles, sessions, PT packages, staff operations | UAT must validate trainer scoping and assignment changes. |
| Fitness and nutrition | Complete foundation | Goals, workouts, measurements, meal tracking, reports | Member privacy and RLS must be validated in staging. |
| Notifications | Complete foundation | In-app notifications, Resend email architecture, WhatsApp/SMS provider-ready logs | WhatsApp/SMS are architecture-ready; provider production integration remains a future gate. |
| Analytics and BI | Complete foundation | Executive dashboards, reports, exports, forecasting foundation | Accuracy depends on seeded/staging data reconciliation. |
| Enterprise settings | Complete foundation | Organizations, branches, tenant config, feature flags, licensing, compliance, backups, health | Requires staging validation of organization/branch RLS. |
| Documentation center | Complete foundation | Seeded enterprise docs and planning docs | End-user help content should be reviewed by operations team. |

## 4. Requirements Traceability Matrix

| Requirement Area | BRD/FR/NFR Source | Implemented Surface | Status |
| --- | --- | --- | --- |
| Public marketing website | BRD, FR public pages, SEO NFR | Home, about, programs, plans, trainers, gallery, testimonials, FAQ, blog, contact | Complete |
| Lead generation | FR lead forms, security NFR | `/api/leads`, rate limiting, Zod validation | Complete |
| Auth and user management | FR auth, security spec | Supabase session middleware, auth pages, profiles, RBAC | Complete |
| Role-based portals | Role matrix | Admin, member, trainer layouts and protected routes | Complete |
| Membership lifecycle | FR memberships | Plans, member onboarding, lifecycle, history, reports | Complete |
| Payments and billing | FR payments | Payments, invoices, coupons/refunds schema, Razorpay helpers | Partial until live Razorpay checkout/webhook UAT passes |
| Trainer/staff operations | FR trainer/staff | Trainer management, sessions, PT packages, staff module | Complete foundation |
| Attendance/access control | FR attendance | QR/manual check-in, occupancy, reports | Complete foundation |
| Class booking | FR classes | Categories, schedules, sessions, bookings, waitlists, attendance | Complete foundation |
| Fitness tracking | FR fitness | Goals, workouts, measurements, nutrition, progress | Complete foundation |
| Notifications/engagement | FR communications | In-app notifications, email, templates, campaigns, provider-ready WhatsApp/SMS | Complete foundation; external providers gated |
| Analytics/reporting | FR reports/NFR performance | Executive dashboard, exports, forecasting foundation | Complete foundation |
| Enterprise SaaS readiness | Phase 14 requirements | Organizations, branches, tenant configs, feature flags, licensing, compliance, backups, health | Complete foundation |
| Performance | NFR performance | Server components, optimized build, route splitting, image config | Needs Lighthouse and load test gate |
| Accessibility | NFR accessibility | Semantic forms, labels, focus-capable UI | Needs screen reader and keyboard UAT gate |
| Security | Security spec | RLS migrations, RBAC, audit logs, rate limiting, secure headers, signature checks | Needs live RLS and penetration test gate |

## 5. End-to-End Test Plan

| Role | Critical Scenarios | Acceptance Criteria |
| --- | --- | --- |
| Guest | Browse public pages, submit contact/free trial, view plans/trainers/blog | Pages render on mobile/desktop; forms validate; lead stored or graceful fallback shown. |
| Member | Register/login, view membership, QR attendance, book class, view workouts/nutrition, update profile | Member sees only own data; protected routes redirect when anonymous; forms validate. |
| Trainer | Login, view assigned members, manage sessions, update workout plans, view progress | Trainer sees only assigned members/classes/sessions. |
| Reception staff | Add member, collect manual payment, check in/out member, manage leads | No access to super-admin licensing/security controls; operations are audited. |
| Gym admin | Manage plans, members, payments, trainers, classes, communications, reports, settings | Gym-scoped records only; reports export; settings updates audited. |
| Super admin | Manage organizations, branches, tenant configs, feature flags, licenses, audit/security center | Platform-wide visibility; tenant isolation preserved for non-super-admins. |

## 6. UAT Scripts

### UAT-01 Membership Purchase

1. Login as reception staff or gym admin.
2. Create a new member with valid profile and emergency contact data.
3. Assign a membership plan.
4. Generate invoice/payment record.
5. Confirm membership status and member dashboard visibility.

Expected outcome: one active membership exists; invoice/payment record is linked; audit log records creation.

### UAT-02 Membership Renewal

1. Open a member with an active/expiring membership.
2. Renew using the same or upgraded plan.
3. Confirm old membership history and new expiry date.

Expected outcome: renewal history is preserved; duplicate active memberships are prevented.

### UAT-03 Attendance and QR Check-In

1. Login as member and view QR code.
2. Login as reception staff and scan or submit the QR token.
3. Check out the same member.

Expected outcome: active membership is required; duplicate check-in is blocked; visit duration is calculated.

### UAT-04 Trainer Assignment and Session

1. Assign a trainer to a member.
2. Schedule a PT session.
3. Login as trainer and complete the session with notes.

Expected outcome: trainer sees assigned member only; session status and notes are saved; audit records are created.

### UAT-05 Class Booking and Waitlist

1. Create a class session with limited capacity.
2. Book seats as members until full.
3. Add a member to waitlist.
4. Cancel one booking.

Expected outcome: overbooking is blocked; waitlist order is preserved; promotion workflow is available.

### UAT-06 Workout and Nutrition Tracking

1. Trainer assigns workout and nutrition plan.
2. Member logs workout, body measurement, and meal entry.
3. Trainer reviews progress.

Expected outcome: privacy is preserved; charts and reports reflect logged activity.

### UAT-07 Reporting and Export

1. Login as admin.
2. Open `/admin/reports`.
3. Export KPI CSV and a PDF report.

Expected outcome: unauthenticated users receive 401/redirect; authenticated export is generated and audit/export row is stored.

### UAT-08 Enterprise Settings

1. Login as super admin.
2. Create organization, branch, tenant config, feature flag, license limits, and retention policy.
3. Login as gym admin for a scoped branch.

Expected outcome: super admin has platform scope; gym admin sees only allowed organization/branch data.

## 7. Functional and Regression Testing

| Suite | Current Automated Coverage | Manual/UAT Coverage Required |
| --- | --- | --- |
| Business rules | Unit tests for auth, RBAC, membership, attendance, classes, training, fitness, communications, analytics, enterprise | Edge cases using staging data. |
| Protected routes | Playwright checks for anonymous redirects on member/admin/trainer routes | Authenticated role-specific navigation. |
| Forms | Zod validation unit coverage and server action type safety | Browser validation and error-state review. |
| Exports | Unit tests for CSV/Excel/PDF generation in several modules | Large report export performance and download validation. |
| Regression | `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e` | Run before every production release. |

## 8. Performance Audit Report

| Area | Status | Notes |
| --- | --- | --- |
| Build size | Acceptable for protected admin dashboards | Largest protected dashboards include Recharts and forms; public pages remain smaller. |
| Rendering | Server Components by default | Client components isolated for forms/charts/interactions. |
| Images | Next image remote allowlist configured | Production assets should be reviewed for dimensions and compression. |
| Reports | Bounded queries and export payloads | Very large exports should move to background jobs before high-volume customers. |
| Database | Indexes and views added in migrations | Run `EXPLAIN ANALYZE` on staging with realistic data. |
| Load testing | Not executed locally | Required staging gate for 1,000 and 5,000 concurrent user simulations. |
| Lighthouse | Not executed locally | Required staging gate. Target: Performance 95+, Accessibility 100, Best Practices 100, SEO 100. |

## 9. Database Performance Review

Required staging checks:

- Run all migrations on a fresh database.
- Refresh generated database types after migration.
- Seed realistic data volumes: 50k members, 100k payments, 100k attendance logs, 10k classes/bookings, analytics snapshots.
- Run `EXPLAIN ANALYZE` for member search, attendance dashboard, class calendar, revenue reports, analytics dashboard, and enterprise tenant usage views.
- Validate indexes for `gym_id`, `organization_id`, `branch_id`, status/date columns, and report/export timestamps.
- Confirm materialized view refresh strategy for analytics under load.

## 10. Security Audit Report

| Control | Status | Evidence / Requirement |
| --- | --- | --- |
| Auth | Implemented | Supabase Auth with server session middleware. |
| Authorization | Implemented | Central RBAC matrix and route guards. |
| RLS | Implemented in migrations | Must be verified in live/staging Supabase with test users. |
| Public form abuse | Implemented foundation | Lead API rate limit and validation. |
| Input validation | Implemented | Zod schemas for forms/actions. |
| Payment signatures | Implemented helpers | Razorpay checkout and webhook signature verification helpers. |
| Audit logs | Implemented | `audit_logs`, activity/security events, write helpers. |
| Security headers | Hardened in Phase 15 | CSP, HSTS, COOP, CORP, frame denial, nosniff, referrer policy, permissions policy. |
| Dependency audit | Passed | `npm audit --omit=dev` returns 0 vulnerabilities. |
| File uploads | Storage policies exist for avatars and documents | Validate bucket policies and max file sizes in Supabase dashboard. |
| Secrets | Environment-variable based | Verify Vercel production/staging secrets and no secrets in client bundle. |

Penetration testing checklist:

- XSS: verify all user-controlled HTML is escaped; schema JSON scripts only use controlled JSON serialization.
- CSRF: validate SameSite cookie behavior and server-side auth checks for mutations.
- SQL injection: confirm all data access uses Supabase typed query builder/RPC, not string-built SQL.
- Privilege escalation: test member, trainer, reception, gym admin, and super admin role boundaries.
- Broken object-level access: test direct IDs across gyms, branches, members, payments, reports, and fitness data.
- Payment replay: verify webhook idempotency and duplicate transaction prevention before production launch.

## 11. Payment Security Review

| Item | Status | Gate |
| --- | --- | --- |
| Razorpay credentials | Environment based | Configure separate test/live keys. |
| Checkout signature verification | Implemented helper | Validate in integration test. |
| Webhook signature verification | Implemented helper | Validate with Razorpay test webhook delivery. |
| Card data handling | Compliant architecture | No sensitive card data stored locally. |
| Invoices/receipts | Implemented foundation | Finance UAT required for tax/legal format. |
| Refund workflow | Implemented foundation | Test partial and full refund reconciliation. |

## 12. Accessibility Report

Current status: implementation uses semantic form labels, buttons, headings, and protected route shells. Automated accessibility tooling beyond Playwright visibility assertions was not executed locally.

Required WCAG AA staging audit:

- Keyboard-only navigation for public site, auth pages, admin dashboards, member portal, trainer portal.
- Visible focus states for links, buttons, inputs, selects, drawers, modals, and forms.
- Screen reader labels for icon-only controls, charts, QR code, and status badges.
- Color contrast across light/dark surfaces and badge variants.
- Reduced motion check for animated public pages and dashboards.
- Mobile viewport checks at 320px, 375px, 390px, 414px, and 768px.

## 13. SEO Report

| Area | Status | Notes |
| --- | --- | --- |
| Metadata | Implemented | `createMetadata` used across pages. |
| Open Graph | Implemented | Default and page-specific metadata. |
| Structured data | Implemented | FAQ/blog schema scripts. |
| Sitemap | Implemented | `app/sitemap.ts`. |
| Robots | Implemented | `app/robots.ts`. |
| Canonicals | Implemented | Metadata helper generates canonical URLs. |
| Production domain | Required | Set `NEXT_PUBLIC_SITE_URL` and `APP_URL` to final HTTPS domain. |

## 14. Mobile and Cross-Browser Test Plan

Local automated coverage currently includes Chromium desktop and Pixel 7 mobile via Playwright.

Required staging matrix:

| Browser / Device | Required Viewports |
| --- | --- |
| Chrome | 320, 375, 390, 414, 768, 1024, 1440 |
| Edge | 375, 768, 1440 |
| Firefox | 375, 768, 1440 |
| Safari / WebKit | 375, 414, 768, 1440 |
| iOS Safari real device | 390, 414 |
| Android Chrome real device | 360, 390, 414 |

## 15. Error Handling and Observability Review

| Area | Status | Notes |
| --- | --- | --- |
| Validation errors | Implemented | Form messages and field-level errors. |
| Auth errors | Implemented | Login/reset flows and protected redirects. |
| API errors | Implemented foundation | JSON errors for public leads and report APIs. |
| Payment errors | Implemented foundation | Razorpay helpers return explicit failure messages. |
| Audit logging | Implemented | Authenticated actions write audit records where configured. |
| System health | Implemented foundation | Enterprise health checks table and dashboard. |
| Error tracking | Not connected | Add Sentry, Logtail, Datadog, or Vercel monitoring before public launch. |

## 16. Backup and Recovery Plan

Recovery objectives:

| Asset | RPO | RTO | Recovery Procedure |
| --- | --- | --- | --- |
| PostgreSQL data | 15 minutes for production target | 2 hours | Restore latest Supabase PITR/snapshot to recovery project, validate checksums, promote or replay migration delta. |
| Storage files | 24 hours | 4 hours | Restore bucket backup or replicated object store, validate sample member documents/photos/invoices. |
| Tenant configuration | 15 minutes | 2 hours | Restore database config rows and verify tenant domains/branding/settings. |
| Vercel deployment | Last successful build | 30 minutes | Roll back to previous Vercel deployment. |
| Environment secrets | Manual controlled process | 1 hour | Restore from password manager/Vercel env history with two-person approval. |

Backup validation schedule:

- Daily automated database backup check.
- Weekly file/storage sample restore.
- Monthly full restore drill to staging.
- Quarterly disaster recovery tabletop with product, engineering, operations, and support.

## 17. Deployment Checklist

Environment:

- `NEXT_PUBLIC_SITE_URL` and `APP_URL` set to final HTTPS domain.
- Supabase URL, publishable key, anon key, service role key configured per environment.
- Resend API key and verified sender domain configured.
- Razorpay key ID, key secret, and webhook secret configured for correct mode.
- Vercel project linked to production domain with SSL active.
- DNS records verified for root, www, and any white-label domains.
- Supabase migrations applied in order.
- Storage buckets and policies validated.
- RLS policies tested with role-specific seed users.
- Webhook URLs configured and tested.
- Error monitoring, uptime monitoring, and alert channels configured.

Release:

- Create staging deployment from release branch.
- Run migrations on staging.
- Run full automated suite.
- Run UAT scripts with stakeholders.
- Run Lighthouse and accessibility scans.
- Run load test and database query review.
- Approve production migration window.
- Deploy production with migration checklist.
- Smoke test public pages, login, admin, member, trainer, reports, payments webhook.
- Keep rollback owner and communication channel active for first 24 hours.

## 18. Disaster Recovery and Incident Response

Severity levels:

| Severity | Definition | Response |
| --- | --- | --- |
| SEV-1 | Data loss, payment outage, auth outage, cross-tenant data exposure | Immediate rollback/containment, executive notification, incident bridge, postmortem. |
| SEV-2 | Major workflow outage for admins/members/trainers | Hotfix or rollback within SLA, stakeholder update. |
| SEV-3 | Partial degradation or non-critical report/export issue | Scheduled fix and monitoring. |
| SEV-4 | Cosmetic/content issue | Backlog or next maintenance release. |

Escalation path:

1. On-call engineer triages alert.
2. Product owner confirms user impact.
3. DevOps lead handles deployment/rollback.
4. Security lead owns incidents involving auth, data, payments, or tenant isolation.
5. Support lead communicates status to gym operators.

## 19. Post-Launch Support Plan

| Support Area | SLA Target |
| --- | --- |
| SEV-1 acknowledgement | 15 minutes |
| SEV-1 mitigation target | 2 hours |
| SEV-2 acknowledgement | 30 minutes |
| SEV-2 mitigation target | 8 business hours |
| Standard support acknowledgement | 1 business day |
| Maintenance window | Weekly low-traffic window |

Post-launch monitoring:

- Watch auth errors, lead submissions, payment webhooks, attendance check-ins, report exports, and API 5xx rates.
- Daily audit log review for first week.
- Daily payment reconciliation for first week.
- Weekly dependency audit.
- Monthly access review for admins and service-role keys.

## 20. Documentation Review

Existing documentation covers BRD, roles, feature inventory, flows, IA, database architecture, API architecture, dashboard requirements, security, SEO, performance, roadmap, design system, technical foundation, and engineering standards.

Documentation still required before public go-live:

- Role-specific UAT walkthroughs with screenshots.
- Admin operations handbook for membership/payment/attendance exceptions.
- Payment reconciliation handbook.
- Data retention and privacy request SOP.
- Incident response runbook with named owners.
- White-label domain setup guide for enterprise customers.

## 21. Defect Register

| ID | Severity | Status | Finding | Resolution / Gate |
| --- | --- | --- | --- | --- |
| QA-001 | Medium | Resolved | `npm audit --omit=dev` reported PostCSS advisory through Next nested dependency. | Pinned/overrode PostCSS to `8.5.15`; audit now 0 vulnerabilities. |
| QA-002 | High | Resolved | Security headers lacked CSP/HSTS/COOP/CORP hardening. | Added production security headers in `next.config.ts`. |
| QA-003 | High | Open Gate | Full staging RLS and tenant isolation testing not executed locally. | Required before production launch. |
| QA-004 | High | Open Gate | Razorpay live/test webhook end-to-end validation not executed locally. | Required before accepting production payments. |
| QA-005 | Medium | Open Gate | Lighthouse/Core Web Vitals not executed locally. | Required on staging and production preview. |
| QA-006 | Medium | Open Gate | Firefox, Safari/WebKit, and Edge tests not executed locally because only Chromium browser is installed. | Required before public launch. |
| QA-007 | Medium | Open Gate | Load testing for 1,000/5,000 concurrent users not executed locally. | Required on staging infrastructure. |
| QA-008 | Medium | Open Gate | Backup restore drill not executed locally. | Required before public launch. |

## 22. Go-Live Checklist

Security:

- Dependency audit passes.
- CSP/HSTS/security headers verified in production.
- Supabase RLS tested for every role.
- Service role key never exposed client-side.
- Razorpay signatures verified.
- Admin access review completed.

Performance:

- Production build passes.
- Lighthouse target met.
- Load test completed.
- Database query review completed.
- Report exports tested with large data.

Data:

- Migrations applied in order.
- Seed/admin users created.
- Backups enabled.
- Restore drill completed.
- Payment reconciliation tested.

Infrastructure:

- Vercel production domain and SSL active.
- Supabase production project configured.
- Resend verified domain configured.
- Razorpay production webhooks configured.
- Monitoring and alerting active.

Support:

- Support SLAs approved.
- Incident response owners assigned.
- Admin/trainer/member guides reviewed.
- Rollback plan approved.

## 23. Final Production Readiness Report

| Category | Current Status | Recommendation |
| --- | --- | --- |
| Code quality | Pass | Continue. |
| Dependency security | Pass | Continue weekly audits. |
| Application security | Pass foundation / staging gate remains | Complete RLS, payment, and penetration tests before public launch. |
| Performance | Pass build / staging gate remains | Run Lighthouse, load tests, and database explain review. |
| Accessibility | Foundation ready / audit gate remains | Complete keyboard/screen reader/contrast audit. |
| SEO | Foundation ready | Verify production domain metadata and rich results. |
| Reliability | Foundation ready / DR gate remains | Complete backup restore drill and monitoring setup. |
| Compliance | Foundation ready | Legal review of retention/privacy workflows required. |

Final recommendation: Conditional Approval for staging UAT and controlled pilot. Do not approve unrestricted public launch until all open gates in the defect register are closed.
