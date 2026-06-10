# 31 - Supabase Architecture

## 1. Supabase Responsibilities

Supabase provides:

- Authentication.
- PostgreSQL database.
- Row Level Security.
- Storage for public and protected media.
- Database triggers and functions.
- Local development stack.
- Generated database types.

Supabase does not replace application-layer authorization. The platform uses both server-side role checks and database RLS.

## 2. Environment Strategy

Required environments:

| Environment | Purpose | Data |
| --- | --- | --- |
| Development | Local or shared dev work. | Fake/non-sensitive data only. |
| Staging | Production-like QA and release validation. | Sanitized or manually seeded data. |
| Production | Live customer/member data. | Real data, strict access. |

Rules:

- Each environment should have separate Supabase project resources.
- Never reuse production service role keys outside production.
- Staging must use separate Razorpay/Resend credentials where possible.
- Environment variables must be managed in Vercel and local `.env` files that are not committed.

## 3. Authentication Architecture

Supabase Auth is responsible for:

- Email/password authentication.
- Email verification.
- Password reset.
- Session issuing and refresh.
- Auth user ID source.

Application database is responsible for:

- User profile.
- Gym scope.
- Role assignments.
- Member/trainer profile linkage.
- Account status.

Auth user mapping:

| Supabase Auth | Application DB |
| --- | --- |
| `auth.users.id` | `users.auth_user_id` |
| Auth email | `users.email` |
| Email verified state | Read from auth/session or synchronized where needed. |
| Session | Resolved server-side before protected route access. |

## 4. Database Architecture

Database configuration:

- Enable RLS on all application tables.
- Use UUID primary keys.
- Use `gym_id` for tenant-scoped data.
- Use generated types.
- Use migrations for every schema change.
- Use database functions for security-sensitive helper checks only where appropriate.

Recommended database helpers:

| Helper | Purpose |
| --- | --- |
| `current_app_user_id()` | Resolve app `users.id` from `auth.uid()`. |
| `current_user_gym_id()` | Resolve authenticated user's gym. |
| `has_role(role_name)` | Check role assignment. |
| `has_permission(permission_key)` | Future dynamic permission check. |
| `is_super_admin()` | Platform-level access check. |
| `is_gym_staff()` | Gym admin/reception/trainer helper where needed. |
| `is_assigned_trainer(member_id)` | Trainer-member relationship check. |

Rules:

- Helper functions used in RLS must be stable, secure, and carefully reviewed.
- Avoid expensive RLS helper queries where indexes are missing.

## 5. Storage Architecture

Storage buckets:

| Bucket | Access | Content |
| --- | --- | --- |
| `public-assets` | Public read, admin write. | Published gallery, trainer photos, blog images, OG images. |
| `private-member-files` | Authenticated restricted read/write. | Future progress photos or private documents. |
| `email-assets` | Public or signed read depending usage. | Email-safe brand assets. |
| `temp-uploads` | Short-lived restricted access. | Pending image uploads before moderation/publish. |

Storage rules:

- Public content must still have metadata rows in PostgreSQL.
- Storage access policies must align with database role rules.
- Image uploads require file type and size validation in the app before upload.
- Public images require alt text in metadata before publishing.
- Never store payment secrets or sensitive documents in public buckets.

## 6. Policies and RLS

RLS policy architecture:

| Scope | Policy Intent |
| --- | --- |
| Public content | Anonymous users can read published content only. |
| Member-owned data | Members can read only their own data. |
| Trainer-assigned data | Trainers can read/update assigned member fitness data. |
| Staff data | Gym Admin/Reception can access operational data for their gym based on role. |
| Super Admin | Can access all tenant data. |
| Webhook/service operations | Trusted server/service role handles payment webhooks and system jobs. |

Important:

- Anonymous browser clients should not directly insert sensitive rows.
- Public lead forms should go through server routes/actions with rate limiting.
- Service role use must be limited to trusted server-only code.

## 7. Database Functions and Triggers

Recommended functions/triggers:

| Function/Trigger | Purpose |
| --- | --- |
| `set_updated_at` trigger | Update `updated_at` on row changes. |
| `create_audit_log` helper | Centralize audit writes from trusted server actions. |
| `generate_member_number` | Create unique member numbers per gym. |
| `sync_new_auth_user` optional | Bootstrap application profile after auth user creation if desired. |
| `expire_memberships_job` future | Scheduled status updates for expired memberships. |
| `membership_expiry_notification_job` future | Scheduled reminder creation. |

Rules:

- Keep complex business workflows in application services unless database-level atomicity is required.
- Use database triggers for metadata, audit enforcement, and consistency, not broad hidden business logic.
- Payment activation should be controlled by verified webhook service flow, with transaction boundaries.

## 8. Supabase Client Strategy

Client types:

| Client | Location | Use |
| --- | --- | --- |
| Browser anon client | Client components only | Auth state, allowed browser reads/writes protected by RLS. |
| Server user client | Server components/actions/route handlers | Session-aware reads/writes with user permissions. |
| Service role client | Trusted server-only services | Webhooks, admin system operations, migrations/seeds. |

Rules:

- Service role client must never be imported by client code.
- Browser client must never bypass RLS assumptions.
- Server components use server user client when data is user-scoped.
- Repositories receive the correct client context from service/action layer.

## 9. Environment Variables

| Variable | Environment | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Client-safe. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Client-safe only with RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Secret. |
| `SUPABASE_DB_PASSWORD` | Local/CI only where needed | Secret. |
| `RAZORPAY_KEY_ID` | Client/server where checkout needs key ID | Public-ish but managed. |
| `RAZORPAY_KEY_SECRET` | Server only | Secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Server only | Secret. |
| `RESEND_API_KEY` | Server only | Secret. |
| `APP_URL` | All server contexts | Environment-specific canonical URL. |
| `CRON_SECRET` | Server only | Secret for scheduled jobs if used. |

## 10. Local Development

Local development should support:

- Supabase local stack where practical.
- Local migrations.
- Seed roles and sample data.
- Generated types.
- Separate local auth users.
- Local webhook testing through provider CLI/tunnel when needed.

Rules:

- Never develop against production by default.
- `.env.local` is not committed.
- Seed data must avoid real personal data.

## 11. Staging

Staging should support:

- Production-equivalent RLS.
- Preview deployments.
- Payment test mode.
- Email test domain/sender.
- Full auth flows.
- Release candidate validation.

Staging acceptance before production:

- Migrations applied successfully.
- RLS checks pass.
- Auth role redirects pass.
- Payment test webhooks pass.
- Public forms rate limit properly.
- Lighthouse and accessibility checks pass.

## 12. Production

Production requirements:

- RLS enabled on all sensitive tables.
- Service role key limited to server-only environment.
- Verified Razorpay webhooks.
- Verified Resend domain.
- Backups and retention aligned with Supabase project plan.
- Audit logs active.
- Monitoring and alerting configured.

