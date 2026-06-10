# 28 - Project Structure and Module Architecture

## 1. Folder Architecture

Recommended project root structure:

- `app/`
  - Next.js App Router routes, layouts, loading states, error boundaries, metadata, route handlers, and webhooks.
- `components/`
  - Shared UI primitives, layout components, shell components, data display components, and cross-feature composition components.
- `features/`
  - Feature modules with domain-specific components, actions, services, schemas, types, hooks, and constants.
- `lib/`
  - Framework-agnostic utilities, Supabase clients, auth helpers, RBAC helpers, validation utilities, SEO helpers, logging, rate limiting, and formatting.
- `hooks/`
  - Shared React hooks used across modules. Feature-specific hooks stay inside feature modules.
- `services/`
  - External service integrations such as Razorpay, Resend, analytics, storage helpers, and notification dispatchers.
- `types/`
  - Global TypeScript types, generated database types, shared utility types, and API response types.
- `stores/`
  - Zustand stores for UI, theme, auth summary, and notifications.
- `providers/`
  - App-level React providers such as theme, toast, query/state providers if added, and analytics providers.
- `actions/`
  - Cross-feature Server Actions. Feature-specific actions stay in `features/{module}/actions`.
- `schemas/`
  - Cross-feature Zod schemas. Feature schemas stay in `features/{module}/schemas`.
- `emails/`
  - Resend email templates, template variables, and email preview data.
- `middleware/`
  - Reusable middleware helpers for auth, rate limiting, request context, and security. The root Next.js `middleware.ts` imports from here.
- `public/`
  - Static assets, icons, manifest assets, robots fallback assets, and public images that are not managed through Supabase Storage.
- `supabase/`
  - Database migrations, seed files, generated types, local Supabase config, policies, and database documentation.
- `tests/`
  - Test utilities, fixtures, integration tests, and end-to-end tests.
- `docs/`
  - Product, design, architecture, and implementation documentation.

## 2. App Router Structure

Recommended `app/` route groups:

| Route Group | Purpose |
| --- | --- |
| `app/(public)/` | SEO public website pages: home, about, programs, plans, trainers, gallery, testimonials, blog, FAQ, contact, free trial. |
| `app/(auth)/` | Login, register, reset password, verify email, invite acceptance, auth callback. |
| `app/(member)/member/` | Member portal pages. |
| `app/(trainer)/trainer/` | Trainer portal pages. |
| `app/(admin)/admin/` | Admin panel pages. |
| `app/api/` | Route handlers for webhooks, public forms, exports, and API endpoints that cannot be Server Actions. |
| `app/sitemap.ts` | Dynamic sitemap generation. |
| `app/robots.ts` | Robots policy. |
| `app/manifest.ts` | PWA manifest metadata in later phase. |

Route-level files:

| File | Purpose |
| --- | --- |
| `layout.tsx` | Route group shell, navigation, providers where scoped. |
| `page.tsx` | Page entry point, preferably server component. |
| `loading.tsx` | Route-level loading skeleton. |
| `error.tsx` | Route-level client error boundary. |
| `not-found.tsx` | Not found state. |
| `route.ts` | Route handler for APIs/webhooks. |

## 3. Components Architecture

Recommended `components/` structure:

| Folder | Ownership |
| --- | --- |
| `components/ui/` | Shadcn UI primitives and project-owned variants: button, card, input, dialog, drawer, table, badge. |
| `components/layout/` | Public header/footer, portal shell, admin sidebar, mobile nav, page containers. |
| `components/forms/` | Reusable form field wrappers connected to React Hook Form. |
| `components/data-display/` | Shared stat cards, empty states, charts wrappers, status badges, tables. |
| `components/feedback/` | Toasts, alerts, loading states, skeletons, error states. |
| `components/seo/` | JSON-LD helpers and SEO composition components where needed. |
| `components/motion/` | Reusable motion wrappers with reduced-motion support. |

Rules:

- Shared components must be domain-neutral.
- Domain-specific components must stay inside `features/{module}/components`.
- Do not place business data fetching inside shared UI components.
- UI components receive typed props and callbacks only.

## 4. Feature Module Structure

Every feature module should follow the same shape:

- `features/{module}/components/`
  - Domain UI components for that module.
- `features/{module}/actions/`
  - Server Actions for validated mutations and module-specific server operations.
- `features/{module}/services/`
  - Business orchestration for the module.
- `features/{module}/repositories/`
  - Supabase database access for the module.
- `features/{module}/schemas/`
  - Zod validation schemas.
- `features/{module}/types/`
  - Domain-specific TypeScript types.
- `features/{module}/hooks/`
  - Feature-specific client hooks.
- `features/{module}/constants/`
  - Status values, labels, filter options.
- `features/{module}/utils/`
  - Pure module-specific helpers.
- `features/{module}/index.ts`
  - Explicit public exports for the module.

Rules:

- Feature modules may import shared `components`, `lib`, `types`, and `services`.
- Feature modules should not import from another module's internal folders.
- Cross-module collaboration should go through public exports, shared services, or domain events.
- Repositories are server-only.
- Actions are server-only.
- Components are server components by default unless interactivity requires client components.

## 5. Required Feature Modules

| Module | Responsibility |
| --- | --- |
| `auth` | Login, session, profile bootstrap, auth callback, password reset, email verification. |
| `members` | Member profile, list/detail, lifecycle, assigned trainer relation. |
| `trainers` | Trainer profile, public profiles, assignments, trainer portal data. |
| `memberships` | Plans, membership records, renewal logic, expiry. |
| `attendance` | Gym check-ins, class attendance, corrections. |
| `payments` | Razorpay orders, payment records, offline payments, receipts, refunds. |
| `classes` | Class schedules, capacity, bookings, cancellations. |
| `leads` | Contact/free trial leads, follow-ups, conversion. |
| `notifications` | In-app notifications, email dispatch requests, templates. |
| `reports` | Dashboard metrics, report queries, exports. |
| `settings` | Gym profile, business hours, integrations, notification templates. |

## 6. Module Contracts

### Auth

| Area | Contents |
| --- | --- |
| Components | Login form, register form, reset form, invite form, auth status banners. |
| Services | Session resolution, profile bootstrap, role redirect, invite acceptance. |
| Types | `AuthUser`, `SessionUser`, `RoleName`, `AuthRedirectTarget`. |
| Actions | Register profile, accept invite, resend verification, logout. |
| Schemas | Login, register, reset password, invite acceptance. |

### Members

| Area | Contents |
| --- | --- |
| Components | Member table, member form, member summary, status badge, profile tabs. |
| Services | Create member, update member, archive member, assign trainer. |
| Types | `Member`, `MemberStatus`, `MemberSummary`, `MemberFilters`. |
| Actions | Create, update, archive, assign trainer, invite member. |
| Schemas | Member profile, emergency contact, trainer assignment, archive reason. |

### Trainers

| Area | Contents |
| --- | --- |
| Components | Trainer card, trainer form, trainer public profile, assigned members list. |
| Services | Create/update trainer, publish profile, resolve assignments. |
| Types | `Trainer`, `TrainerStatus`, `TrainerSpecialty`, `TrainerProfile`. |
| Actions | Create trainer, update trainer, toggle public status. |
| Schemas | Trainer profile, specialties, public profile. |

### Memberships

| Area | Contents |
| --- | --- |
| Components | Plan card, plan form, membership status panel, renewal panel. |
| Services | Plan CRUD, membership creation, renewal date calculation, expiry logic. |
| Types | `MembershipPlan`, `Membership`, `MembershipStatus`, `RenewalQuote`. |
| Actions | Create plan, update plan, archive plan, create membership, renew membership. |
| Schemas | Plan form, membership form, renewal request, cancellation. |

### Attendance

| Area | Contents |
| --- | --- |
| Components | Check-in search, attendance table, attendance correction form. |
| Services | Record check-in, class attendance, duplicate detection, correction audit. |
| Types | `AttendanceRecord`, `AttendanceSource`, `AttendanceType`, `AttendanceFilters`. |
| Actions | Check in member, mark class attendance, correct attendance. |
| Schemas | Check-in, class attendance, correction reason. |

### Payments

| Area | Contents |
| --- | --- |
| Components | Payment table, receipt detail, offline payment form, payment status badge. |
| Services | Razorpay order creation, webhook handling, offline payment, receipt dispatch. |
| Types | `Payment`, `PaymentStatus`, `PaymentMethod`, `RazorpayOrderResult`. |
| Actions | Create order, verify payment, record offline payment, resend receipt. |
| Schemas | Payment order request, offline payment, refund request, webhook payload validation. |

### Classes

| Area | Contents |
| --- | --- |
| Components | Class calendar, class card, class form, booking list, booking action. |
| Services | Create class, update class, capacity checks, booking, cancellation. |
| Types | `ClassSession`, `ClassBooking`, `ClassStatus`, `BookingStatus`. |
| Actions | Create class, update class, book class, cancel booking, mark attendance. |
| Schemas | Class form, booking request, cancellation request. |

### Leads

| Area | Contents |
| --- | --- |
| Components | Lead table, lead form, trial form, lead pipeline, lead status badge. |
| Services | Capture public lead, update status, assign staff, convert to member. |
| Types | `Lead`, `LeadStatus`, `LeadSource`, `LeadFilters`. |
| Actions | Submit contact, submit trial, create lead, update lead, convert lead. |
| Schemas | Contact form, trial form, lead update, conversion. |

### Notifications

| Area | Contents |
| --- | --- |
| Components | Notification list, notification bell, template form. |
| Services | Create notification, mark read, dispatch email, template rendering. |
| Types | `Notification`, `NotificationType`, `NotificationTemplate`. |
| Actions | Mark read, mark all read, send notification, update template. |
| Schemas | Notification send request, template update. |

### Reports

| Area | Contents |
| --- | --- |
| Components | Report filters, chart cards, stat cards, export controls. |
| Services | Revenue report, member report, attendance report, lead report, export orchestration. |
| Types | `ReportDateRange`, `RevenueReport`, `DashboardMetrics`. |
| Actions | Fetch report, request export. |
| Schemas | Date range, report filters, export request. |

### Settings

| Area | Contents |
| --- | --- |
| Components | Gym settings form, business hours editor, integration status, notification settings. |
| Services | Update gym settings, validate integrations, update notification templates. |
| Types | `GymSettings`, `BusinessHours`, `IntegrationStatus`. |
| Actions | Update settings, update business hours, update preferences. |
| Schemas | Gym profile, business hours, integration settings, preferences. |

## 7. Boundary Rules

| Rule | Reason |
| --- | --- |
| UI must not call Supabase directly. | Keeps data access consistent and testable. |
| Server Actions validate with Zod before service calls. | Prevents invalid business operations. |
| Services enforce business rules. | Avoids business logic scattered across components. |
| Repositories only perform persistence/query work. | Keeps database access isolated. |
| Feature modules cannot import another module's private internals. | Prevents tight coupling. |
| Shared UI cannot know gym business concepts. | Keeps shared components reusable. |
| External integrations live in `services/`. | Keeps provider code isolated and replaceable. |

## 8. Business Logic Placement

| Logic Type | Location |
| --- | --- |
| Role checks | `lib/auth`, `lib/rbac`, services/actions. |
| Membership renewal date calculation | `features/memberships/services`. |
| Payment amount calculation | `features/payments/services`, based on membership plan source of truth. |
| Attendance duplicate detection | `features/attendance/services`. |
| Class capacity check | `features/classes/services`, transaction-aware. |
| Lead conversion | `features/leads/services`, calling members service through public contract. |
| Notification creation | `features/notifications/services`. |
| Email rendering/sending | `emails/` templates and `services/resend`. |

## 9. Folder Justification

| Folder | Justification |
| --- | --- |
| `app` | Keeps Next.js routing and rendering contracts centralized. |
| `components` | Prevents duplicate UI primitives and makes design system enforceable. |
| `features` | Enables scalable domain ownership and future team/module work. |
| `lib` | Houses reusable framework/business utilities without feature ownership. |
| `services` | Isolates external providers and infrastructure dependencies. |
| `stores` | Keeps global client state small, explicit, and auditable. |
| `providers` | Centralizes app-level context and prevents provider sprawl. |
| `schemas` | Makes shared validation reusable across forms/actions/APIs. |
| `emails` | Keeps transactional email templates versioned and testable. |
| `middleware` | Keeps route/request helpers reusable while Next entry stays thin. |
| `supabase` | Makes database migrations, policies, seeds, and generated types first-class project assets. |
| `tests` | Separates test infrastructure from production modules while allowing feature-level tests. |

