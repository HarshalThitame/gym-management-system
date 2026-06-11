# Application Structure

## Platform Overview

This application is a multi-tenant Gym Management SaaS built with Next.js App Router, TypeScript, Supabase Auth, Supabase PostgreSQL, Supabase Storage, and Vercel.

The business hierarchy is:

```text
Super Admin
  -> Organization Owner
    -> Gym / Branch Admin
      -> Reception Staff
      -> Trainer
      -> Member
```

Every tenant-owned record must remain scoped by the correct tenant identifiers:

```text
organization_id -> gym_id -> branch_id -> user/member/trainer/staff data
```

Super Admin is the only global role. All other roles must be restricted to their assigned organization, gym, branch, or own user record.

## Root Structure

```text
.
├── app/                 Next.js App Router routes, layouts, pages, and API handlers
├── components/          Shared reusable UI, layout, SEO, form, motion, and PWA components
├── data/                Static/local data used by public content or fixtures
├── docs/                Audit reports, role designs, architecture notes, and release documentation
├── emails/              HTML email templates
├── features/            Domain modules grouped by business capability
├── lib/                 Shared infrastructure, auth, tenant, Supabase, security, and SEO helpers
├── public/              Static assets served by Next.js
├── services/            Cross-feature service adapters such as email delivery
├── supabase/            Database migrations and Supabase project metadata
├── tests/               Unit and Playwright E2E audit tests
├── types/               Shared TypeScript domain and generated database types
├── middleware.ts        Next.js middleware entrypoint
├── next.config.ts       Next.js configuration
├── playwright.config.ts Playwright test configuration
├── vercel.json          Vercel deployment configuration
└── package.json         Scripts and dependencies
```

## App Router Structure

The `app/` folder owns routing only. Business logic should not be implemented directly inside pages unless it is very small and page-specific.

```text
app/
├── (public)/            Marketing website and public pages
├── (auth)/              Login, register, password reset, and verification pages
├── (super-admin)/       SaaS owner portal
├── (organization-owner)/Organization owner portal
├── (admin)/             Gym admin portal
├── (reception)/         Reception/front-desk portal
├── (trainer)/           Trainer portal
├── (member)/            Member portal
├── api/                 Route handlers for reports, payments, AI, PWA, auth, and domain APIs
├── auth/callback/       Supabase auth callback route
├── offline/             PWA offline fallback
└── unauthorized/        Access denied page
```

### Portal Routes

```text
/super-admin             Global SaaS administration
/organization            Organization owner dashboard and modules
/admin                   Gym admin dashboard and operations
/reception               Front-desk operations
/trainer                 Trainer workflows
/member                  Member fitness portal
```

### API Route Groups

```text
app/api/
├── ai/                  AI chat and recommendations
├── analytics/           Analytics report exports
├── attendance/          Attendance reports
├── auth/                Session/auth support endpoints
├── billing/razorpay/    Billing and Razorpay order/refund/verify/webhook handlers
├── classes/             Class report exports
├── enterprise/          Domain and enterprise tenant APIs
├── finance/             Finance report APIs
├── fitness/             Fitness report exports
├── invoices/            Invoice APIs
├── leads/               Lead capture APIs
├── memberships/         Membership report exports
├── pwa/                 Push, sync, and PWA analytics APIs
├── razorpay/            Razorpay compatibility routes
└── training/            Training report exports
```

## Feature Module Structure

The `features/` folder contains business modules. Each feature follows the same pattern where practical:

```text
features/<module>/
├── actions/             Server actions for mutations
├── components/          Module-specific UI components and forms
├── lib/                 Business rules, formatting, CSV/PDF helpers, utilities
├── schemas/             Zod validation schemas
└── services/            Server-side database and integration services
```

Current feature modules:

```text
features/
├── admin/               Admin helper logic
├── ai/                  AI features, prompt safety, OpenAI service wrapper
├── analytics/           Reports, dashboards, analytics actions
├── attendance/          QR/manual check-in, attendance rules, reports
├── auth/                Login, role actions, auth forms and schemas
├── billing/             Payments, invoices, Razorpay, financial rules
├── classes/             Class scheduling, bookings, waitlists, reports
├── communications/      Notifications, announcements, campaigns, preferences
├── enterprise/          Organizations, gyms, domains, tenant configuration
├── fitness/             Goals, measurements, nutrition, workouts, progress
├── memberships/         Members, plans, memberships, lifecycle rules
├── organization-owner/  Tenant-safe organization owner portal modules
├── profile/             User profile updates
├── public/              Public website components and schemas
├── pwa/                 Offline sync and PWA support logic
├── reception/           Front-desk dashboard and workflows
├── super-admin/         Global SaaS owner modules
└── training/            Trainers, PT sessions, workout programs, assignments
```

## Shared Component Structure

```text
components/
├── forms/               Shared form controls
├── layout/              Header, footer, portal shell, protected page helpers
├── motion/              Animation wrappers
├── pwa/                 PWA status and offline components
├── seo/                 Structured data and SEO helpers
└── ui/                  Shared design-system primitives
```

Use `components/ui` for generic primitives and `features/<module>/components` for feature-specific UI.

## Shared Library Structure

```text
lib/
├── auth/                Server auth context, guards, redirects, API guard helpers
├── security/            Security headers, validation, and safety helpers
├── seo/                 Metadata and SEO utilities
├── supabase/            Supabase clients, env validation, middleware support
└── tenant/              Tenant resolution, access checks, request header protocol
```

Important rules:

- Pages must call auth guards before loading protected data.
- Server services must enforce role and tenant scope.
- Tenant context must come from trusted server-side resolution, not client input.
- API handlers must use API guards and validate input before mutation.

## Data And Database Structure

```text
supabase/
└── migrations/          SQL migrations for schema, RLS, policies, functions, indexes

types/
├── database.ts          Generated or maintained Supabase database types
├── auth.ts              Auth and role types
├── membership.ts        Member and membership domain types
├── attendance.ts        Attendance domain types
├── billing.ts           Billing and payment types
├── training.ts          Trainer/PT/workout types
├── fitness.ts           Fitness and nutrition types
├── classes.ts           Class booking types
├── communications.ts    Notification and campaign types
├── analytics.ts         Analytics types
├── ai.ts                AI feature types
└── enterprise.ts        Organization, gym, tenant, and domain types
```

Database responsibility is split like this:

```text
Supabase Auth      -> user identity and sessions
profiles           -> app user profile data
roles/user_roles   -> RBAC assignments
organizations      -> SaaS tenants
gyms/branches      -> tenant operational units
members/trainers   -> gym people records
memberships        -> membership lifecycle
payments/invoices  -> financial records
attendance_*       -> visits, QR tokens, attendance reports
classes_*          -> class scheduling and booking
fitness_*          -> goals, progress, nutrition, workouts
communications_*   -> notifications, campaigns, announcements
tenant_domains     -> custom domain and white-label routing
audit_logs         -> sensitive action traceability
```

## Authentication And Authorization Flow

```text
Request
  -> middleware.ts
  -> Supabase session refresh
  -> tenant host resolution
  -> route protection
  -> page/layout auth guard
  -> server service data loading
  -> Supabase RLS and app-level tenant checks
```

Main auth helpers:

```text
lib/auth/session.ts      Builds the server auth context
lib/auth/guards.ts       requireAuth, requireRole, requirePrimaryRole
lib/auth/api-guards.ts   API-level role and tenant guards
lib/rbac.ts              Role hierarchy and permission helpers
lib/tenant/*             Tenant context and access validation
```

## Role Portal Ownership

```text
Role                Route             Scope
Super Admin         /super-admin      All organizations, gyms, users, settings
Organization Owner  /organization     Own organization and its gyms/branches
Gym Admin           /admin            One assigned gym/branch
Reception Staff     /reception        Front-desk operations for assigned gym
Trainer             /trainer          Assigned gym and assigned members only
Member              /member           Own profile, membership, fitness, payments
```

Route access must always match the user primary role unless a route explicitly supports a safe multi-role workflow.

## External Integrations

```text
Supabase            Auth, PostgreSQL, RLS, storage
Vercel              Hosting, deployment, custom domains
Razorpay            Orders, verification, refunds, webhooks
Resend              Transactional email
OpenAI              AI text and embeddings when configured
PWA/Web Push        Offline shell, push subscriptions, background sync support
```

Integration code should stay in:

```text
services/           Cross-feature adapters
features/*/services Feature-specific server services
app/api/*           Public HTTP handlers and webhooks
lib/*               Shared platform helpers
```

## Testing Structure

```text
tests/
├── unit/            Business rules, tenant logic, domain rules, provider tests
└── e2e/             Playwright audit suites for auth, RBAC, roles, workflows, mobile, security
```

Main verification commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test
```

## Development Rules

1. Add new routes under the correct `app/(role-group)/` folder.
2. Put business logic in `features/<module>/services`, not directly in pages.
3. Put mutations in `features/<module>/actions` or guarded API routes.
4. Validate all external input with Zod schemas from `features/<module>/schemas`.
5. Keep shared UI in `components/ui`; keep module UI in `features/<module>/components`.
6. Use `lib/auth/guards.ts` for page protection and `lib/auth/api-guards.ts` for API protection.
7. Always enforce tenant scope in service queries.
8. Add or update Supabase migrations for schema/RLS/index changes.
9. Add tests for security-sensitive, financial, tenant, or workflow changes.
10. Do not hardcode production secrets, test passwords, domains, provider keys, or model names.

## Recommended New Feature Placement

```text
New member-facing page
  -> app/(member)/member/<route>/page.tsx
  -> features/<domain>/components/*
  -> features/<domain>/services/*
  -> features/<domain>/schemas/*

New admin operation
  -> app/(admin)/admin/<route>/page.tsx
  -> features/<domain>/actions/*
  -> features/<domain>/services/*
  -> Supabase migration if schema/RLS changes

New API endpoint
  -> app/api/<domain>/<operation>/route.ts
  -> lib/auth/api-guards.ts for auth
  -> features/<domain>/schemas/* for validation
  -> features/<domain>/services/* for business logic

New tenant/domain capability
  -> features/enterprise/*
  -> lib/tenant/*
  -> app/api/enterprise/*
  -> Supabase migration for tenant registry or RLS changes
```

## Production Readiness Ownership

```text
Code quality         lint, typecheck, tests, build
Security             auth guards, API guards, RLS, CSP, tenant isolation
Performance          dashboard-sized queries, pagination, report limits, bundle control
Reliability          graceful provider fallbacks, error states, no hardcoded dev defaults
Operations           Vercel env vars, Supabase backups, monitoring, logs, runbooks
```

The codebase is structured as a modular monolith: one Next.js application with clear domain modules, role-based portals, Supabase-backed data isolation, and Vercel deployment support.
