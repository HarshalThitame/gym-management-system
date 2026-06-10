# 39 - Testing CI/CD and Deployment

## 1. Testing Strategy

Testing stack:

- Vitest for unit tests.
- Testing Library for React component tests.
- Playwright for end-to-end tests.

Testing pyramid:

| Level | Focus |
| --- | --- |
| Unit | Pure utilities, services, validation schemas, RBAC helpers. |
| Component | Shared UI, forms, accessible behavior, feature components. |
| Integration | Server Actions, repositories, RLS behavior, payment service with mocks. |
| E2E | Critical user flows across browser, app, API, and database. |

## 2. Test Folder Structure

Recommended:

- `tests/unit/`
  - Pure functions, services, schemas, RBAC.
- `tests/components/`
  - Shared UI and feature component behavior.
- `tests/integration/`
  - Server Actions, repositories, Supabase local/staging tests.
- `tests/e2e/`
  - Playwright browser flows.
- `tests/fixtures/`
  - Test data builders.
- `tests/mocks/`
  - Provider mocks for Razorpay, Resend, Supabase adapters.
- `tests/utils/`
  - Test helpers, render wrappers, auth fixtures.

Feature-local tests are allowed when they improve ownership:

- `features/members/__tests__/`
- `features/payments/__tests__/`

## 3. Unit Test Requirements

Must test:

- Zod schemas.
- Role and permission checks.
- Membership renewal date calculations.
- Payment amount calculations.
- Attendance duplicate rules.
- Class capacity rules.
- Error mapping.
- Formatting utilities.

## 4. Component Test Requirements

Must test:

- Button variants and disabled/loading states.
- Form field label/error behavior.
- Dialog/drawer accessibility behavior.
- Data table empty/loading states.
- Status badges include readable text.
- Keyboard navigation for menus/tabs/accordions where practical.

## 5. Integration Test Requirements

Must test:

- Server Action validation failure.
- Server Action authorization failure.
- Repository tenant scoping.
- RLS direct access denial.
- Payment webhook idempotency.
- Lead conversion transaction.
- Class booking capacity conflict.
- Attendance correction audit.

## 6. E2E Test Requirements

Critical Playwright flows:

| Flow | Coverage |
| --- | --- |
| Guest free trial | Public page -> form -> success -> lead exists. |
| Member registration/login | Register -> verify/mock -> login -> member dashboard. |
| Membership purchase | Select plan -> payment mock -> membership active/pending state. |
| Admin add member | Login admin -> add member -> member appears. |
| Offline payment | Record payment -> membership status updates. |
| Attendance check-in | Search member -> check in -> attendance visible. |
| Class booking | Member books eligible class -> capacity updates. |
| Trainer assigned member | Trainer sees assigned member only. |
| RBAC denial | Member cannot open admin route; trainer cannot open unassigned member. |

## 7. Accessibility Testing

Required:

- Automated accessibility checks for key pages/components.
- Keyboard navigation manual/automated checks.
- Focus trap checks for dialogs/drawers.
- Color contrast review for light/dark themes.
- Reduced motion behavior check.

## 8. CI Pipeline

Recommended CI steps:

1. Install dependencies.
2. Type check.
3. Lint.
4. Format check.
5. Unit tests.
6. Component tests.
7. Build.
8. Playwright smoke tests for preview/staging.
9. Migration validation where Supabase local/staging is available.

Rules:

- Type errors fail CI.
- Lint errors fail CI.
- Unit tests fail CI.
- Build failure blocks deployment.
- E2E can run as required gate for production promotion.

## 9. Vercel Deployment Architecture

Environments:

| Vercel Environment | Purpose |
| --- | --- |
| Development | Local development and local env values. |
| Preview | Pull request/branch deployments. |
| Production | Live production deployment. |

Rules:

- Preview uses staging Supabase and test payment/email credentials.
- Production uses production Supabase and live provider credentials.
- Environment variables are scoped by Vercel environment.
- Never expose service role key to preview logs or client bundle.

## 10. Environment Variable Strategy

Categories:

| Category | Examples |
| --- | --- |
| Public client-safe | Supabase URL, anon key, public app URL if needed. |
| Server secrets | Supabase service role, Razorpay secret, webhook secret, Resend API key. |
| Provider public IDs | Razorpay key ID. |
| Operational | App URL, environment name, cron secret, analytics ID. |

Rules:

- Validate env vars at app startup/server usage with Zod.
- Separate `.env.local`, staging, and production values.
- Do not commit env files.
- Document all required variables.

## 11. Release Strategy

Recommended flow:

1. Feature branch.
2. Pull request.
3. Preview deployment.
4. Automated checks.
5. Staging validation.
6. Database migration review.
7. Production deployment.
8. Smoke tests.
9. Monitor logs and payments.

For database migrations:

- Apply migration to staging before production.
- Generate database types after migration.
- Run RLS and critical flow tests.
- Use forward-fix plan for production issues.

## 12. Deployment Checklist

Pre-production:

- Env vars configured.
- Supabase migrations applied.
- RLS enabled.
- Roles seeded.
- Razorpay webhook configured.
- Resend domain verified.
- Public metadata configured.
- Sitemap/robots validated.
- Lighthouse checks pass.
- Accessibility smoke checks pass.
- Critical E2E flows pass.

Post-deployment:

- Check public home page.
- Check login.
- Check admin dashboard.
- Check payment order test/live as appropriate.
- Check webhook receipt.
- Check email delivery.
- Check logs for errors.

## 13. Rollback Strategy

Vercel rollback:

- Use for app deployment regressions.
- Does not roll back database migrations.

Database rollback:

- Prefer forward-fix migration.
- Avoid destructive rollback in production.
- Keep release notes linking app deploy and migration version.

Provider rollback:

- Payment provider config changes require manual review.
- Email template regressions can be reverted independently if templates are versioned.

