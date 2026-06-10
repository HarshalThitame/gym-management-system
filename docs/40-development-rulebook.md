# 40 - Development Rulebook

## 1. Mandatory Engineering Rules

These rules are non-negotiable for future implementation phases.

## 2. Architecture Rules

- No direct database calls in UI components.
- No business logic in shared UI components.
- Feature modules own their domain code.
- Do not import another feature module's private internals.
- Server Actions validate input and check authorization before service calls.
- Services own business rules.
- Repositories own persistence.
- External provider code stays in `services/`.
- Public routes, portal routes, API routes, and webhooks are separated.

## 3. TypeScript Rules

- No `any`.
- No `as any`.
- No unchecked external payloads.
- No unnecessary non-null assertions.
- Use strict TypeScript.
- Use generated database types.
- Use Zod for input validation.
- Use typed action/API responses.
- Store money as integer smallest currency unit.
- Use string literal unions for statuses and roles.

## 4. UI Rules

- Use shared design system components before creating new components.
- Do not duplicate components.
- Do not nest cards inside cards.
- Use lucide icons for standard icons.
- Icon-only buttons require accessible labels.
- Loading states preserve layout dimensions.
- Empty states include one clear action.
- Mobile-first layout is required.
- Text must not overflow at 320px.
- Focus states must be visible.

## 5. Accessibility Rules

- WCAG AA target is mandatory.
- Forms require labels and text errors.
- Keyboard navigation must work.
- Modals and drawers trap focus.
- Focus returns after modal/drawer close.
- Status cannot rely on color alone.
- Images require alt text unless decorative.
- Charts require text summary.
- Reduced motion must be respected.

## 6. Performance Rules

- Server Components by default.
- Client Components only when necessary.
- Do not load payment SDK until checkout action.
- Do not load chart libraries on public marketing pages.
- Optimize images and reserve dimensions.
- Use optimized fonts.
- Paginate all large data sets.
- Avoid unbounded dashboard/report queries.
- Use lazy loading for below-fold heavy UI.
- Lighthouse 95+ is a release target for public pages.

## 7. Security Rules

- Never trust client role state.
- Never trust client payment status or amount.
- Verify Razorpay webhooks.
- Use RLS on sensitive tables.
- Keep service role server-only.
- Validate all inputs server-side.
- Rate limit public forms and sensitive requests.
- No state-changing GET routes.
- Audit critical actions.
- Do not log secrets or sensitive personal data.

## 8. Data Rules

- All operational records include `gym_id`.
- Tenant scope is enforced in queries and RLS.
- Financial records are not hard-deleted.
- Audit logs are append-only.
- Public content uses draft/published/archived.
- Member-owned data is private by default.
- Trainer access is assignment-based.
- Report exports are permission-gated and audited.

## 9. Content Rules

- No hardcoded production copy inside deeply nested components when content should be CMS/config-driven.
- Public page copy should be SEO-friendly and production-quality.
- CTAs use action verbs.
- Avoid shame-based fitness language.
- Public testimonials require consent.
- Legal/payment policy text must be visible before purchase.

## 10. Testing Rules

- Critical business logic requires unit tests.
- RBAC and RLS require tests.
- Payment webhook idempotency requires tests.
- Forms require validation tests.
- Critical user flows require Playwright coverage.
- Accessibility checks are required for core components/pages.
- A build that fails typecheck or tests cannot be promoted.

## 11. Git and Review Rules

- Small, focused changes.
- No unrelated refactors in feature work.
- Database migrations reviewed separately.
- Security-sensitive changes require extra review.
- Payment/auth/RLS changes require tests.
- PR descriptions must mention schema/env changes.
- Generated files should be updated intentionally.

## 12. Environment Rules

- No secrets in source control.
- Use separate dev/staging/prod credentials.
- Validate required env vars.
- Preview deployments use staging/test provider credentials.
- Production provider keys are only in production environment.
- Rotate keys after exposure.

## 13. Definition of Done

A future implementation task is done only when:

- It follows folder/module boundaries.
- It is strictly typed.
- It validates inputs.
- It enforces authorization.
- It respects RLS assumptions.
- It has loading/empty/error states.
- It works on mobile.
- It meets accessibility requirements.
- It avoids unnecessary client JavaScript.
- It includes tests proportional to risk.
- It updates docs if architecture/contracts changed.

## 14. Anti-Patterns to Reject

- Direct Supabase calls from client UI for privileged data.
- Hardcoded role checks scattered across components.
- Business logic inside page components.
- `any` to bypass type issues.
- Duplicate button/card/form variants.
- Unpaginated tables.
- Payment activation from client callback alone.
- Public anonymous insert policies without rate-limited server validation.
- Overly broad RLS policies.
- Heavy animation that forces client rendering of static pages.
- Dashboards styled like marketing pages.
- Forms that rely on hint text instead of labels.
