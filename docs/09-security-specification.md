# 09 - Security Specification

## 1. Security Objectives

- Protect member personal data, payment records, attendance, and fitness information.
- Prevent unauthorized access across roles and gym boundaries.
- Ensure payment state cannot be forged from the client.
- Maintain an audit trail for critical operational changes.
- Reduce abuse of public forms and authentication endpoints.
- Keep secrets out of client code and source control.

## 2. Authentication Strategy

### 2.1 Provider

Use Supabase Auth for:

- Email/password sign-up and login.
- Email verification.
- Password reset.
- Session issuing and refresh.
- Optional magic link or OTP in future.

### 2.2 Authenticated User Creation

Flow:

1. Supabase Auth creates the auth user.
2. Application creates or links a row in `users` using `auth_user_id`.
3. Application assigns role through `user_roles`.
4. If role is member, application creates or links `members`.
5. If role is trainer, application creates or links `trainers`.

Rules:

- A user without an application profile must be redirected to profile setup or denied access to protected portals.
- Email verification should be required before payment receipts, portal access, or staff access, depending on configuration.
- Staff-created accounts should use invite flow and force password setup.

## 3. JWT and Session Management

| Area | Requirement |
| --- | --- |
| JWT source | Supabase Auth access token. |
| Token storage | Use Supabase recommended secure cookie/session handling for server-rendered Next.js app. |
| Session refresh | Refresh through Supabase supported mechanisms. |
| Server access | Server components/actions/route handlers read session from secure cookies. |
| Client access | Client components only receive minimal user state needed for UI. |
| Session expiry | Expired sessions redirect to login with return URL. |
| Logout | Invalidate Supabase session and clear local application state. |
| Sensitive changes | Role changes, password changes, and payment actions should require active session and may require recent login in future. |

JWT claims should not be the only source of role truth unless custom claims are synchronized and trusted. The server should verify current roles from application tables for privileged actions.

## 4. Authorization Strategy

### 4.1 Role-Based Access Control

Authorization is enforced at:

1. Navigation and UI rendering.
2. Server Actions and Route Handlers.
3. PostgreSQL row-level security.

Role resolution should use:

- `users.id`
- `users.gym_id`
- `user_roles`
- Role-specific profile links, such as `members.user_id` and `trainers.user_id`

### 4.2 Permission Rules

| Rule | Requirement |
| --- | --- |
| Gym scope | Non-super-admin users can only access records for their assigned `gym_id`. |
| Member ownership | Members can only access their own profile, membership, payments, attendance, bookings, plans, and notifications. |
| Trainer assignment | Trainers can only access assigned members and assigned classes. |
| Reception limits | Reception staff cannot manage settings, roles, refunds, content publishing, or full financial reports unless explicitly granted. |
| Admin powers | Gym Admin can manage operational data inside assigned gym. |
| Super Admin powers | Super Admin can access and manage all gyms and global settings. |

### 4.3 Denial Behavior

- Return `403 Forbidden` for authenticated users without permission.
- Return `401 Unauthorized` for missing/expired sessions.
- Do not reveal whether a record exists if the user has no access.
- Log repeated authorization failures for staff accounts.

## 5. Row-Level Security Strategy

Enable row-level security on all application tables containing user, business, payment, attendance, lead, or fitness data.

Policy groups:

| Table Group | Read Policy | Write Policy |
| --- | --- | --- |
| Public content | Guests read only `published` rows. | Gym Admin manages own gym content. |
| Users | Users read own; Admin reads gym users. | Admin updates gym users; user updates limited own fields. |
| Members | Member reads own; trainer reads assigned; staff reads gym. | Staff manages; member updates limited own fields. |
| Payments | Member reads own; staff reads gym. | Server trusted routes create/update; offline entry by staff. |
| Memberships | Member reads own; staff reads gym. | Staff/server routes create/update. |
| Attendance | Member reads own; trainer reads assigned; staff reads gym. | Staff/assigned trainer where allowed. |
| Plans | Member reads own published; trainer reads/writes assigned; admin reads gym. | Trainer/admin write. |
| Leads | Staff reads gym. | Public insert only through controlled server route; staff manage. |
| Audit logs | Admin read gym, Super Admin read all. | Server insert only. |

Important: Public form submissions should not directly insert into Supabase from browser using broad anonymous policies. Use server routes/actions with validation and rate limiting.

## 6. Password Reset and Email Verification

### Password Reset

Requirements:

- User requests password reset by email.
- Response must be generic regardless of whether email exists.
- Reset link must be time-limited.
- Password must meet strength policy.
- After successful reset, user should be redirected to login or dashboard based on active session.
- Log password reset completion as a security event.

### Email Verification

Requirements:

- New users receive verification email.
- Staff accounts should not gain privileged access until email is verified.
- Members may view limited onboarding screens before verification only if business allows.
- Provide resend verification with rate limiting.

## 7. Audit Logs

### 7.1 Events to Audit

| Event Category | Examples |
| --- | --- |
| Authentication/security | Staff invite accepted, role changed, account suspended, password reset completed. |
| Member management | Member created, profile changed, trainer assigned, member archived. |
| Membership | Membership created, renewed, cancelled, date changed, status changed. |
| Payments | Offline payment recorded, online payment captured, refund initiated, payment status manually changed. |
| Attendance | Manual check-in, attendance correction, attendance cancellation. |
| Classes | Class created, capacity changed, class cancelled, attendance marked. |
| Leads | Lead converted, lead marked lost, trial confirmed. |
| Content | Blog/testimonial/gallery published or archived. |
| Settings | Gym settings changed, notification template changed, integration status changed. |

### 7.2 Audit Log Requirements

- Store actor, action, entity type, entity ID, timestamp, IP, user agent, and before/after snapshots where practical.
- Audit logs must be append-only.
- Users cannot edit or delete audit log rows.
- Report exports should be logged.
- Payment webhook events should be traceable through `payment_events` and payment audit logs.

## 8. Rate Limiting and Abuse Prevention

| Surface | Requirement |
| --- | --- |
| Contact form | Rate limit by IP and phone/email fingerprint. |
| Free trial form | Rate limit and duplicate active trial detection. |
| Login | Rely on Supabase protections and add UX throttling where possible. |
| Resend verification | Rate limit per email and IP. |
| Password reset | Generic responses and rate limiting. |
| Razorpay webhook | Verify signature; reject invalid signatures. |
| Admin exports | Rate limit and audit. |
| Search endpoints | Minimum query length and pagination limits. |

Recommended controls:

- Vercel platform-level firewall/rate limiting where available.
- Server-side IP-aware limiter for public forms.
- CAPTCHA or invisible bot protection only if abuse appears or launch risk is high.

## 9. Payment Security

| Area | Requirement |
| --- | --- |
| Order creation | Amount and currency calculated server-side. |
| Client trust | Do not trust client-submitted payment amount or status. |
| Webhook verification | Verify Razorpay webhook signature using server secret. |
| Idempotency | Store provider event IDs and payment IDs to prevent duplicate processing. |
| Membership activation | Activate membership only after verified captured payment or authorized offline payment entry. |
| Offline payments | Require staff identity, method, amount, timestamp, and reference/notes. |
| Refunds | Restrict to Gym Admin and audit every refund. |
| Secrets | Razorpay key secret stored only in server environment variables. |

## 10. Data Protection

### Sensitive Data

Sensitive data includes:

- Member contact data.
- Medical notes.
- Emergency contact data.
- Payment metadata.
- Attendance patterns.
- Fitness goals and diet plans.
- Staff roles and audit logs.

Requirements:

- Limit visibility by role.
- Avoid exposing sensitive data in public/client-rendered payloads.
- Do not log full payment payloads if they contain unnecessary sensitive details.
- Store only required metadata.
- Use HTTPS everywhere.
- Use secure cookies and same-site protections.
- Backups should be protected according to Supabase controls.

## 11. Environment and Secret Management

| Secret | Storage |
| --- | --- |
| Supabase URL | Vercel environment variable; public URL may be client-safe. |
| Supabase anon key | Vercel environment variable; can be client-exposed with RLS. |
| Supabase service role key | Server-only Vercel environment variable. Never expose to client. |
| Razorpay key ID | Public enough for checkout, but still configured through env. |
| Razorpay key secret | Server-only Vercel environment variable. |
| Razorpay webhook secret | Server-only Vercel environment variable. |
| Resend API key | Server-only Vercel environment variable. |
| Email sender domain config | Resend dashboard and env references. |

## 12. Security Testing Checklist

| Test | Expected Result |
| --- | --- |
| Member tries to open another member payment | Access denied. |
| Trainer tries to open unassigned member | Access denied. |
| Reception tries to change integration settings | Access denied. |
| Guest posts invalid free trial repeatedly | Rate limited and rejected. |
| Razorpay webhook sent with invalid signature | Rejected without state change. |
| Payment callback sends modified amount | Rejected; server amount wins. |
| Expired session opens admin page | Redirect to login. |
| Suspended staff account logs in | Login/session denied or no privileged access. |
| Admin archives member with payments | Soft archive only; payment history retained. |
| RLS direct query with anon key attempts private data access | Denied. |

## 13. Security Roadmap

| Phase | Additions |
| --- | --- |
| MVP | Supabase Auth, RBAC, RLS, secure payment webhooks, audit logs, rate-limited public forms. |
| Phase 2 | More granular permissions, export audit, notification preferences, session hardening for staff. |
| Phase 3 | MFA for staff/admins, device/session management, advanced anomaly detection. |
| Future | SSO for corporate clients, branch-specific permission groups, compliance dashboards. |

