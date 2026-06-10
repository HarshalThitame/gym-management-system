# QA Phase 6 - Production Readiness, Go-Live Certification, Deployment Validation, and Launch Approval

Date: 2026-06-10  
Project: Gym Management SaaS Platform  
Result: GO WITH RISKS for limited production launch; NO GO for full feature launch

## Executive Summary

The release candidate code builds, passes local validation, has been deployed to Vercel production, and the linked Supabase database is up to date with the available migrations.

The platform is suitable for a limited launch that excludes unavailable provider-dependent capabilities such as Razorpay online payments, Resend email delivery, push notifications, AI features, and external monitoring. Full unrestricted launch should wait until the remaining operational gates in this report are closed.

## Validation Passed

| Check | Result |
| --- | --- |
| ESLint | Passed with `npm run lint` |
| Production dependency audit | Passed with `npm audit --omit=dev --audit-level=high`; 0 vulnerabilities |
| TypeScript | Passed with `npm run typecheck` |
| Unit and business-rule tests | Passed with `npm run test`; 77/77 tests passed |
| Playwright smoke tests | Passed with `npm run test:e2e`; 14/14 tests passed across desktop and mobile Chromium |
| Production build | Passed with `npm run build`; 80 routes generated |
| Vercel production deployment | Passed; live at `https://apexgymmanagementsystem.vercel.app` |
| Supabase project link | Passed; remote project is linked and reachable |
| Supabase migrations | Passed; `npx supabase db push --dry-run` reports remote database is up to date |
| Production smoke - public routes | `/` and `/membership-plans` returned 200 on production |
| Production smoke - protected routes | `/member` and `/admin/settings` redirected to login on production |
| Production PWA assets | `/manifest.webmanifest`, `/offline`, and `/sw.js` returned 200 on production |
| Production security headers | Passed; CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy observed |
| Local production smoke - public routes | `/`, `/membership-plans`, and `/contact` returned 200 |
| Local production smoke - protected routes | `/member`, `/admin/settings`, and `/trainer` redirected to login |
| PWA assets | `/manifest.webmanifest`, `/offline`, and `/sw.js` returned 200 |

## Remaining Launch Gates

| Area | Status | Remaining Gate |
| --- | --- | --- |
| Release governance | Conditional pass | Working tree is clean and latest commit is deployed. Tag the release candidate for immutable release tracking. |
| Vercel readiness | Pass | Production project, deployment, domain, SSL, and production smoke tests are validated. Preview environment variables still need branch-specific setup. |
| Supabase readiness | Conditional pass | Project is linked and migrations are applied. Backup restore drill and production role/RLS scenario tests still need evidence. |
| Environment parity | Conditional pass | Production app envs are configured for Supabase and site URL. `DATABASE_URL`, `SUPABASE_POOLER_URL`, and provider keys remain missing where applicable. |
| Mobile QR readiness | Pass | Camera permission policy now allows `camera=(self)` and is deployed. |
| Monitoring | Blocked | No confirmed Sentry, Datadog, Logtail, Vercel alert routing, or equivalent production monitoring integration. |
| Payment go-live | Deferred | Razorpay keys and webhook validation are not available. Do not enable online payments until Razorpay is configured and tested. |
| Email go-live | Blocked | Resend API key and sender/domain verification are not configured. |
| Push go-live | Blocked | VAPID public/private keys are not configured. |
| AI go-live | Blocked | OpenAI API key, model limits, cost controls, and production validation are not configured. |
| Disaster recovery | Blocked | No backup restore drill evidence is available. |

## Production Readiness Assessment

| Category | Assessment |
| --- | --- |
| Code and build readiness | Pass |
| Security posture | Conditional pass; deployed headers and protected-route smoke tests passed, but production RLS role-matrix testing and provider security validation remain open |
| Performance posture | Local build pass; production route smoke passed; production Lighthouse/load tests were not executed in this phase |
| Operational readiness | Conditional; core app is live, but monitoring, backup restore, provider readiness, and runbooks remain incomplete |
| Deployment readiness | Pass for Vercel production deployment |
| Rollback readiness | Conditional; Vercel rollback is available, but database restore drill is not complete |

## Deployment Readiness Report

The application can produce a successful production build locally and has been deployed to Vercel production.

Validated deployment details:

- Production URL: `https://apexgymmanagementsystem.vercel.app`
- Deployment status: Ready
- Deployment ID: `dpl_DtNmRfqP9tR6rya3jhkwsTUeW9iu`
- Vercel project: `gym-management-system`
- Production site URL envs: `NEXT_PUBLIC_SITE_URL` and `APP_URL`

Required before production:

1. Tag the release candidate.
2. Configure preview branch environment variables for branch-based preview deployments.
3. Configure remaining provider secrets only when those services are ready.
4. Run final production Lighthouse and role-based smoke tests.
5. Keep rollback steps available during launch.

## Infrastructure Readiness Report

Vercel and Supabase production infrastructure are linked and partially certified.

Open infrastructure gates:

- Preview environment variable setup needs the correct preview branch.
- Supabase backups and restore procedures not demonstrated.
- Monitoring and alert routing not demonstrated.
- Provider integrations remain unconfigured for Razorpay, Resend, web push, and OpenAI.

## Backup and Recovery Report

Backup and recovery are not certified.

Required evidence:

- Supabase production backup schedule.
- Point-in-time recovery or snapshot policy.
- Storage bucket backup strategy.
- Restore drill to staging or recovery project.
- Documented RTO and RPO acceptance.

Recommended targets:

| Asset | RPO Target | RTO Target |
| --- | ---: | ---: |
| PostgreSQL data | 15 minutes | 2 hours |
| Storage files | 24 hours | 4 hours |
| Vercel deployment | Last successful build | 30 minutes |
| Environment secrets | Controlled manual process | 1 hour |

## Monitoring and Alerting Report

Monitoring is not certified for production launch.

Required alerts:

- Application 5xx error spike.
- Auth failures and suspicious login patterns.
- Supabase database availability or latency.
- Razorpay webhook failures.
- Payment verification failures.
- Email delivery failures.
- AI API failures or cost spike.
- PWA sync/push failures.

Required integrations:

- Error tracking: Sentry, Datadog, Logtail, or equivalent.
- Uptime checks for public and protected health endpoints.
- Vercel deployment and function monitoring.
- Supabase database monitoring.
- Alert routing to owner/admin support channel.

## Security Posture Report

Local security posture is acceptable for staging, but production security certification remains conditional.

Passed locally:

- Dependency audit found 0 high vulnerabilities.
- Protected route smoke tests passed.
- Security headers were present in local production smoke checks.
- RBAC and business-rule tests passed.

Open production gates:

- Production RLS validation for every role.
- Multi-tenant data isolation validation.
- File upload bucket policy validation.
- Razorpay webhook replay/idempotency validation.
- Resend, OpenAI, and push notification secret validation.

## Payment Go-Live Report

Payment go-live is not certified.

Required before accepting production payments:

1. Configure Razorpay live keys only in production.
2. Configure Razorpay test keys in staging/preview.
3. Register production webhook URL.
4. Verify webhook signature delivery.
5. Execute successful payment test.
6. Execute failed payment test.
7. Execute partial refund test.
8. Execute full refund test.
9. Reconcile invoice, payment, refund, and transaction records.

## Launch Checklist

| Item | Status |
| --- | --- |
| RC committed and tagged | Partially complete; clean commit exists, tag still needed |
| Vercel project linked | Complete |
| Production env vars configured | Partially complete; core Supabase/site vars present, provider vars missing |
| Production domain configured | Complete |
| SSL active | Complete |
| Supabase project linked | Complete |
| Migrations applied to staging | Not verified |
| Migrations applied to production | Complete; remote database is up to date |
| RLS role tests passed on staging | Not verified |
| Razorpay webhook tested | Not verified |
| Resend sender domain verified | Not verified |
| Push notification keys verified | Not verified |
| OpenAI key/rate limits verified | Not verified |
| Monitoring and alerting active | Not complete |
| Backup restore drill completed | Not complete |
| Rollback plan rehearsed | Partially complete; Vercel rollback path exists, database restore drill not complete |
| Production smoke tests completed | Complete for public/protected/PWA route health |

## Rollback Plan

Application rollback:

1. Use Vercel rollback to return to the previous stable deployment.
2. Confirm public pages, auth redirects, payment routes, and dashboards after rollback.
3. Keep the incident channel active until metrics stabilize.

Database rollback:

1. Avoid destructive schema rollback in production.
2. Prefer forward-fix migrations.
3. Restore from Supabase PITR/snapshot only for severe data corruption incidents.
4. Validate restored data in recovery/staging before promoting.

Provider rollback:

1. Disable Razorpay webhook if duplicate or incorrect financial events occur.
2. Pause Resend campaigns if delivery or template issues occur.
3. Disable AI features through configuration if cost, safety, or reliability issues occur.

## Launch Day Runbook

1. Tag the deployed RC commit, for example `rc-qa6`.
2. Configure preview environment variables once the preview branch is confirmed.
3. Run staging smoke tests and role-based RLS checks.
4. Complete Razorpay webhook/payment/refund validation in test mode before enabling online payments.
5. Verify Resend sender domain and transactional email delivery before enabling email automation.
6. Configure VAPID keys before enabling push notifications.
7. Configure OpenAI keys, limits, and fallback policy before enabling AI features.
8. Enable production monitoring and alert routing.
9. Take a final database backup or confirm latest PITR point.
10. Complete at least one restore drill to staging or a recovery project.
11. Run final production smoke tests.
12. Monitor for at least 24 hours after launch.

## Post-Launch Monitoring Plan

| Window | Monitoring Focus |
| --- | --- |
| First 24 hours | Auth errors, payment failures, lead submissions, public route health, protected route redirects, Supabase errors |
| First 72 hours | Attendance flow, class bookings, invoice/payment reconciliation, email delivery, admin dashboards |
| First 7 days | Performance trends, database slow queries, support tickets, member onboarding friction, trainer/reception workflows |
| First 30 days | Churn/retention metrics, payment disputes/refunds, analytics accuracy, capacity planning, backup drill review |

## Final Risk Assessment

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Monitoring not connected | High | Configure error tracking, uptime checks, and alert routing |
| Backup restore not drilled | High | Complete restore drill before public launch |
| Razorpay production flow unverified | High | Run test-mode payment, webhook, failure, and refund validation |
| Resend production delivery unverified | High | Configure sender domain and send transactional email smoke tests |
| AI provider configuration missing | Medium | Keep AI features disabled or in fallback mode until OpenAI envs and cost controls are configured |
| Push notification configuration missing | Medium | Keep web push disabled until VAPID keys and opt-in flow are validated |
| Preview env branch not configured | Medium | Add preview env vars for the correct non-production branch |

## Go-Live Certification

Final recommendation: GO WITH RISKS for limited launch; NO GO for unrestricted full-feature launch.

The release candidate is code-valid, deployed to production, and connected to Supabase. It can support a limited operational launch if the business accepts disabled/deferred Razorpay, email automation, push notifications, AI, monitoring, and disaster-recovery evidence. Full enterprise launch remains blocked until those provider and operations gates are closed.
