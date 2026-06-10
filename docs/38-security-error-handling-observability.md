# 38 - Security Error Handling and Observability

## 1. Security Foundation

Security controls are mandatory from the first implementation phase, not deferred hardening.

Core controls:

- Supabase Auth.
- Server-side role checks.
- PostgreSQL RLS.
- Input validation.
- Rate limiting.
- Secure headers.
- CSRF-safe mutation patterns.
- XSS prevention.
- Payment webhook verification.
- Audit logs.
- Environment secret isolation.

## 2. CSRF Protection

Strategy:

- Use same-site secure cookies for auth sessions.
- Use Server Actions for authenticated form mutations where framework protections and same-origin behavior reduce CSRF risk.
- Validate origin/referer for sensitive Route Handler mutations where appropriate.
- Never allow state-changing GET routes.
- Public form routes use rate limiting and validation.

Sensitive actions requiring extra care:

- Offline payment creation.
- Refunds.
- Role changes.
- Membership cancellation.
- Attendance correction.
- Settings changes.

## 3. XSS Prevention

Rules:

- React escapes text by default; do not bypass without review.
- Avoid rendering raw HTML.
- Blog/rich content must be sanitized if rich text is introduced.
- User-generated content must be treated as untrusted.
- Image alt text and captions are plain text.
- Do not inject unsanitized provider payloads into UI.

## 4. Rate Limiting

Apply rate limiting to:

- Contact form.
- Free trial form.
- Newsletter submission.
- Resend verification email.
- Password reset request.
- Login attempts where additional app-level throttling is useful.
- Report exports.
- Payment order creation.

Rate limit keys:

- IP address.
- Email/phone fingerprint.
- Authenticated user ID.
- Gym ID for staff actions.

## 5. Secure Headers

Required headers:

| Header | Purpose |
| --- | --- |
| Content-Security-Policy | Restrict scripts, frames, images, connections. |
| X-Frame-Options or CSP frame ancestors | Prevent clickjacking except allowed payment provider frames. |
| X-Content-Type-Options | Prevent MIME sniffing. |
| Referrer-Policy | Limit referrer leakage. |
| Permissions-Policy | Restrict browser features. |
| Strict-Transport-Security | Enforce HTTPS in production. |

Payment note:

- CSP must allow Razorpay checkout domains only where needed.
- Do not loosen CSP globally without review.

## 6. Input Sanitization and Validation

Rules:

- Zod validates all inputs.
- Trim strings.
- Normalize email to lowercase.
- Normalize phone numbers where practical.
- Convert empty strings to null for nullable DB fields.
- Validate dates and timezones.
- Validate file type and size before upload.
- Treat webhook payloads as unknown until verified and parsed.

## 7. Environment Security

Rules:

- Secrets only in Vercel/Supabase environment settings.
- No secret in client bundle unless explicitly public.
- Service role key server-only.
- Separate dev/staging/prod credentials.
- Rotate secrets after suspected exposure.
- Do not log secrets or full payment signatures.

## 8. Error Handling Strategy

Error categories:

| Category | Handling |
| --- | --- |
| Validation | Return field-level errors. |
| Auth | Redirect to login or show auth prompt. |
| Authorization | Return forbidden state; log suspicious repeated failures. |
| Database | Log internal details; show generic retry/contact message. |
| Payment | Show specific safe payment state; preserve retry path. |
| Network | Show retry state and preserve user input. |
| Unknown | Log and show safe fallback. |

## 9. Error Boundaries and Fallback UI

Required:

- Root global error boundary.
- Route group error boundaries for public, auth, member, trainer, admin.
- Not found pages.
- Loading pages.
- Empty states.
- Payment pending/failure states.
- Form-level errors.

Fallback rules:

- Public error page offers navigation to home, plans, contact.
- Member error page offers retry and support.
- Admin error page offers retry and preserves filters where possible.
- Payment errors must not imply success unless verified.

## 10. Logging Strategy

Log:

- Unhandled server errors.
- Payment webhook failures.
- Payment reconciliation changes.
- Auth role/profile bootstrap errors.
- Authorization denials for staff/admin routes.
- Public form rate limit events.
- Report export requests.
- Integration failures.

Do not log:

- Passwords.
- Full secrets.
- Sensitive medical notes.
- Full payment signatures unless explicitly required and protected.
- Excess personal data.

## 11. Audit Logging

Audit required for:

- Role changes.
- Staff invites.
- Member creation/archive.
- Membership create/cancel/date/status changes.
- Offline payments.
- Payment overrides/refunds.
- Attendance corrections.
- Class cancellations.
- Lead conversion.
- Content publishing.
- Settings/integration changes.
- Report exports.

Audit fields:

- Actor user ID.
- Gym ID.
- Action.
- Entity type.
- Entity ID.
- Before data where safe.
- After data where safe.
- IP and user agent where available.
- Timestamp.

## 12. Payment Security

Rules:

- Server calculates payment amount.
- Razorpay order created server-side.
- Webhook signature verified.
- Webhook events idempotent by provider event ID.
- Payment capture activates membership only after verification.
- Client callback is not source of truth.
- Refunds require admin approval and audit.

## 13. Observability Requirements

Monitor:

- API latency.
- Server errors.
- Client errors.
- Core Web Vitals.
- Payment webhook failures.
- Form submission failures.
- Database slow queries.
- Auth failures.
- Rate limit spikes.

Launch requirement:

- Production must have a defined error reporting and log review process before real payments are enabled.

