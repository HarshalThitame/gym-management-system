# 35 - API Data Layer Forms and State

## 1. Data Access Architecture

The application uses a layered data model:

1. UI components.
2. Server Actions or Route Handlers.
3. Services.
4. Repositories.
5. Supabase/PostgreSQL.

UI components never call Supabase directly. This keeps security, validation, error handling, and business rules consistent.

## 2. Server Actions

Use Server Actions for:

- Authenticated form mutations.
- Admin CRUD mutations.
- Member self-service mutations.
- Trainer plan mutations.
- Small server-side operations tightly coupled to UI forms.

Server Action responsibilities:

- Resolve session.
- Validate input with Zod.
- Check authorization.
- Call service.
- Convert service result into typed action response.
- Revalidate relevant paths/tags.
- Return user-safe errors.

Server Actions should not:

- Contain raw SQL/Supabase query logic.
- Trust client-provided `gym_id`.
- Return provider secrets.
- Throw expected validation/auth/payment errors to UI.

## 3. Route Handlers

Use Route Handlers for:

- Razorpay webhooks.
- Public contact/free trial submissions where rate limiting is needed.
- File upload signing or validation endpoints.
- Report exports.
- API endpoints consumed by non-form client widgets.
- Auth callback where framework pattern requires.

Route Handler responsibilities:

- Validate method and payload.
- Apply rate limiting where needed.
- Verify provider signatures for webhooks.
- Resolve auth where needed.
- Return typed JSON responses with HTTP status codes.

## 4. Services

Services own business logic.

Examples:

| Service | Responsibilities |
| --- | --- |
| `membersService` | Create/update/archive members, assign trainer, member lifecycle rules. |
| `membershipsService` | Plan CRUD, membership creation, renewal dates, expiry. |
| `paymentsService` | Razorpay order creation, payment reconciliation, offline payments, receipts. |
| `attendanceService` | Check-ins, duplicate detection, corrections. |
| `classesService` | Class creation, capacity validation, booking/cancellation. |
| `leadsService` | Lead capture, follow-up, conversion. |
| `notificationsService` | Notification creation, read state, email dispatch requests. |
| `reportsService` | Dashboard metrics and report queries. |

Service rules:

- Accept typed validated input.
- Enforce business invariants.
- Call repositories for persistence.
- Call external services through adapters.
- Return typed domain results.
- Create audit logs for critical actions.

## 5. Repositories

Repositories own database access.

Repository responsibilities:

- Execute Supabase queries.
- Scope queries by `gym_id`, user ID, or resource ID.
- Return database rows or mapped persistence results.
- Handle pagination and filtering.
- Avoid business decisions.

Repository rules:

- Server-only.
- No UI imports.
- No React imports.
- No direct provider SDK calls except Supabase.
- Receive Supabase client context from caller.

## 6. Read Operations

Read flow:

1. Server component/layout resolves session and role.
2. Calls feature service read method.
3. Service verifies access and calls repository.
4. Repository scopes query.
5. Service maps data to view model.
6. Page renders server-side where possible.

Rules:

- Paginate all large reads.
- Use search filters with minimum query length.
- Do not fetch full entity graphs for cards/tables.
- Use view models for dashboard widgets.

## 7. Write Operations

Write flow:

1. Form submits to Server Action or Route Handler.
2. Input validates with Zod.
3. Session and permission checks run.
4. Service enforces business rules.
5. Repository writes inside transaction where needed.
6. Audit log created.
7. Cache/path revalidation runs.
8. Typed response returned.

Transaction-required operations:

- Payment capture to membership activation.
- Class booking capacity checks.
- Lead conversion to member.
- Membership renewal creation with payment record.
- Attendance correction with audit log.

## 8. Validation Layer

Validation order:

1. Client-side lightweight validation for user feedback.
2. Server-side Zod validation for trust boundary.
3. Service-level business validation.
4. Database constraints.
5. RLS enforcement.

Rules:

- Zod schemas are source of truth for input shape.
- Server validation always runs even if client validation passed.
- Provider payloads are treated as unknown.
- Error messages returned to UI must be safe and useful.

## 9. Error Handling Pattern

Use consistent application errors:

| Error Type | Example |
| --- | --- |
| Validation | Invalid phone, missing payment amount. |
| Auth | Session missing, email not verified. |
| Authorization | Role lacks permission. |
| Not Found | Resource missing or inaccessible. |
| Conflict | Duplicate booking, active membership overlap. |
| Payment | Razorpay failed, webhook mismatch. |
| Database | Constraint or connection failure. |
| Rate Limit | Too many public form submissions. |

Services should map low-level errors to stable application error codes.

## 10. API Response Pattern

All actions and route handlers return one of:

| Result | Shape |
| --- | --- |
| Success | `ok`, `data`, optional `message`, optional `meta` |
| Failure | `ok`, `error` with `code`, `message`, optional field errors |

Rules:

- Expected failures return typed failure results.
- Unexpected failures are logged and return generic message.
- Payment and webhook logs retain internal debugging metadata server-side only.

## 11. Form Architecture

Use React Hook Form with Zod.

Form layers:

| Layer | Responsibility |
| --- | --- |
| Schema | Field validation and input parsing. |
| Form component | Layout and field composition. |
| Field components | Reusable accessible input wrappers. |
| Server Action | Trusted validation and mutation. |
| Error mapper | Converts action field errors into form errors. |

## 12. Reusable Form Fields

| Field | Requirements |
| --- | --- |
| Input | Label, helper, error, required state, prefix/suffix support. |
| Textarea | Label, helper, error, character count optional. |
| Select | Keyboard accessible, hint text, loading/empty states. |
| Date Picker | Accessible input fallback, min/max validation, timezone awareness. |
| Phone Input | Country-aware formatting where needed, raw normalized value. |
| Image Upload | Type/size validation, preview, alt text requirement for public images. |
| Currency Input | Integer smallest-unit conversion, currency prefix, no floating storage. |
| Search Combobox | Debounced search, keyboard navigation, empty state. |

Form rules:

- Labels always visible.
- Inputs at least 44px high on mobile.
- Error messages text-based.
- Submit button shows loading state.
- Duplicate submissions prevented.
- Long admin forms use sections and sticky action bar.

## 13. Zustand State Architecture

Use Zustand only for client state that genuinely spans components.

Required stores:

| Store | Owns | Does Not Own |
| --- | --- | --- |
| `authStore` | Minimal client session summary, active role label, profile completion UI state. | Authoritative permissions or secure session. |
| `uiStore` | Sidebar collapsed state, drawers, command menu, table density preference. | Server data. |
| `themeStore` | Light/dark/system preference if not handled fully by provider. | Design tokens. |
| `notificationsStore` | Unread count and optimistic read state. | Full notification source of truth. |

State ownership rules:

- Server data is not global client state by default.
- URL owns filters and pagination where shareable.
- Forms own transient form state.
- Server owns auth, roles, permissions, payments, memberships, and reports.
- Zustand stores must be small and serializable.
- Clear user-sensitive stores on logout.

## 14. Client State Avoidance Rules

Do not put these in Zustand:

- Member lists.
- Payment records.
- Membership records.
- Reports.
- Class lists.
- Full user profile source of truth.
- Auth permissions as trusted source.

Use server components, Server Actions, route handlers, and URL search params instead.

## 15. Data Layer Testing Requirements

- Unit test services with mocked repositories.
- Integration test repositories against local/staging Supabase where practical.
- Test action validation failures.
- Test authorization failures.
- Test payment idempotency.
- Test class booking capacity conflict.
- Test lead conversion transaction behavior.
