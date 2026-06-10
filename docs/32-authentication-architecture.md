# 32 - Authentication Architecture

## 1. Roles

Authenticated roles:

- Super Admin
- Gym Admin
- Reception Staff
- Trainer
- Member

Unauthenticated:

- Guest Visitor

## 2. Authentication Model

Supabase Auth manages identity and sessions. Application tables manage profiles, role assignments, and gym scope.

Required auth states:

| State | Meaning | Allowed Access |
| --- | --- | --- |
| Guest | No session. | Public pages and public form submissions. |
| Authenticated incomplete profile | Session exists but app profile incomplete. | Profile setup/invite completion only. |
| Authenticated unverified | Email not verified where verification is required. | Verification prompt and limited onboarding. |
| Authenticated active | Session, verified if required, active app user. | Role dashboard and permitted routes. |
| Suspended | App user status suspended. | No portal access; contact support message. |
| Archived | User no longer active. | No access. |

## 3. Login Flow

1. User opens `/login`.
2. If already authenticated, redirect by role.
3. User submits email/password.
4. Supabase validates credentials.
5. Server resolves application `users` row by `auth_user_id`.
6. Server checks user status.
7. Server checks role assignment.
8. Server checks profile completeness.
9. User redirects to:
   - `/admin` for Super Admin/Gym Admin/Reception Staff where allowed.
   - `/trainer` for Trainer.
   - `/member` for Member.
   - profile setup or verification screen if incomplete.

Error behavior:

| Error | UX |
| --- | --- |
| Invalid credentials | Generic invalid login message. |
| Email unverified | Show verify email prompt and resend action. |
| No app profile | Start profile bootstrap or contact support. |
| No role | Deny access and log issue. |
| Suspended user | Show contact support message. |

## 4. Logout Flow

1. User clicks logout.
2. Server/client invokes Supabase sign out.
3. Clear local stores for auth summary, notifications, and UI-sensitive state.
4. Redirect to home or login.
5. Protected routes become inaccessible.

Rules:

- Logout should be available from every authenticated shell.
- Do not leave member/admin data in client stores after logout.

## 5. Session Flow

Session handling:

- Server components resolve session from secure cookies.
- Protected layouts perform session and role checks.
- Client components receive only minimal session summary.
- Session expiry redirects to `/login` with return URL.
- Role changes should take effect on next session refresh/request.

Protected layout checks:

| Layout | Required |
| --- | --- |
| Member | Active session + member role + own member profile. |
| Trainer | Active session + trainer role + trainer profile. |
| Admin | Active session + Gym Admin/Reception/Super Admin role. |
| Super Admin future | Active session + Super Admin role. |

## 6. Password Reset Flow

1. User opens `/forgot-password`.
2. User enters email.
3. Supabase sends reset email if account exists.
4. UI always shows generic success message.
5. User opens reset link.
6. User sets new password.
7. System redirects to login or dashboard depending session.

Rules:

- Reset responses must not reveal if email exists.
- Password policy must be enforced.
- Rate limit reset requests.
- Log successful reset completion as security event if available.

## 7. Email Verification Flow

1. User registers or receives invite.
2. Supabase sends verification email.
3. User clicks verification link.
4. Supabase marks email verified.
5. App resolves role/profile state.
6. User enters correct dashboard or setup flow.

Rules:

- Staff accounts require verification before privileged access.
- Member accounts may be blocked or limited until verified based on launch policy.
- Resend verification action must be rate limited.

## 8. Registration Flow

Public self-registration:

1. User enters name, email, phone, password.
2. Supabase creates auth user.
3. Application creates `users` row and member profile.
4. Assign `member` role.
5. Send verification email.
6. Redirect to verification/profile setup/checkout continuation.

Staff-created member invite:

1. Staff creates member profile.
2. Staff sends invite.
3. User accepts invite and sets password.
4. App links Supabase auth user to existing member.
5. Assign member role if not already assigned.

Staff invite:

1. Gym Admin creates staff user.
2. Assign role and gym scope.
3. User accepts invite and verifies email.
4. Staff dashboard access begins only after active/verified state.

## 9. Protected Route Strategy

Use route group layouts for broad access control:

| Route Group | Guard |
| --- | --- |
| `(public)` | No auth required. |
| `(auth)` | Redirect authenticated users by role except callback/reset pages. |
| `(member)` | Require member role. |
| `(trainer)` | Require trainer role. |
| `(admin)` | Require staff/admin role. |
| `api/webhooks` | Provider signature/secret, not user session. |
| `api/public-forms` | Rate limit and validation. |

Root middleware responsibilities:

- Lightweight session refresh where required by Supabase auth pattern.
- Redirect obvious protected route access if no session.
- Apply security/rate-limiting helpers where appropriate.
- Do not perform expensive database role checks in middleware; use layouts/actions for deep checks.

## 10. Role-Based Redirects

Priority:

1. Super Admin -> `/admin` or future `/super-admin`.
2. Gym Admin -> `/admin`.
3. Reception Staff -> `/admin` with limited navigation.
4. Trainer -> `/trainer`.
5. Member -> `/member`.

If a user has multiple roles, the selected active role can be stored in a secure profile preference in later phases. MVP should avoid multi-role complexity unless required.

## 11. Auth Security Rules

- Never trust client role state.
- Resolve role server-side before privileged actions.
- Use RLS as final database guard.
- Use generic auth error messages.
- Rate limit reset and verification email requests.
- Audit role changes and staff invites.
- Suspended users cannot access protected pages even with valid Supabase session.
- Do not expose service role keys.

