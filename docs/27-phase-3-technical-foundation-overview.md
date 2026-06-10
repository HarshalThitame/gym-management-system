# 27 - Phase 3 Technical Foundation Overview

## 1. Purpose

Phase 3 defines the production-grade technical foundation for the premium Gym Management Platform. This phase does not build feature modules. It establishes the architecture, folder structure, module boundaries, database/Supabase strategy, auth/RBAC/RLS model, data layer, forms, state, UI foundation, performance, SEO, security, testing, deployment, and engineering standards that future implementation phases must follow.

## 2. Target Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 App Router, React 19, TypeScript |
| Styling/UI | Tailwind CSS v4, Shadcn UI, Lucide Icons, Framer Motion |
| Backend/Data | Supabase, PostgreSQL, Row Level Security |
| Forms/Validation | React Hook Form, Zod |
| State | Zustand |
| Charts/Tables | Recharts, TanStack Table |
| Utilities | date-fns |
| Email | Resend |
| Payments | Razorpay |
| Deployment | Vercel |

## 3. Architecture Principles

| Principle | Requirement |
| --- | --- |
| Server-first | Use React Server Components by default. Client components only where interactivity, browser APIs, or local state require them. |
| Feature modularity | Feature modules own their components, actions, services, schemas, and types. Shared code is extracted only when genuinely reused. |
| Strict typing | No `any`. Unknown external data is validated through Zod before use. |
| Data access isolation | UI components never call Supabase directly. Data access goes through actions/services/repositories. |
| Security by default | Auth, RBAC, RLS, validation, rate limiting, secure headers, and audit logging are foundational. |
| Tenant isolation | All operational data is scoped by `gym_id`. RLS and server checks enforce this. |
| Performance first | Public pages are static/cached where possible; portals are dynamic but lean. |
| Accessibility required | WCAG AA behavior is part of component acceptance, not a later audit task. |
| Maintainability | Clear boundaries, consistent naming, reusable primitives, documented contracts. |

## 4. Primary Deliverables

| Deliverable | Source Document |
| --- | --- |
| Complete Project Architecture | This document and [28 - Project Structure and Module Architecture](./28-project-structure-and-module-architecture.md) |
| Folder Structure | [28 - Project Structure and Module Architecture](./28-project-structure-and-module-architecture.md) |
| Module Architecture | [28 - Project Structure and Module Architecture](./28-project-structure-and-module-architecture.md) |
| Supabase Architecture | [31 - Supabase Architecture](./31-supabase-architecture.md) |
| Authentication Design | [32 - Authentication Architecture](./32-authentication-architecture.md) |
| RBAC Design | [33 - Authorization RBAC and Permission Matrix](./33-authorization-rbac-permission-matrix.md) |
| RLS Policies Plan | [34 - Row Level Security Policy Plan](./34-row-level-security-policy-plan.md) |
| API/Data Layer Design | [35 - API Data Layer Forms and State](./35-api-data-layer-forms-state.md) |
| State Management Plan | [35 - API Data Layer Forms and State](./35-api-data-layer-forms-state.md) |
| Performance Strategy | [37 - Performance SEO and UI Foundation](./37-performance-seo-ui-foundation.md) |
| Security Strategy | [38 - Security Error Handling and Observability](./38-security-error-handling-observability.md) |
| Testing Strategy | [39 - Testing CI CD and Deployment](./39-testing-ci-cd-deployment.md) |
| Deployment Architecture | [39 - Testing CI CD and Deployment](./39-testing-ci-cd-deployment.md) |
| Engineering Standards | [40 - Development Rulebook](./40-development-rulebook.md) |

## 5. Foundation Scope

Included:

- App architecture and route group strategy.
- Folder structure and ownership model.
- Feature module contracts.
- TypeScript standards.
- PostgreSQL implementation plan and migrations.
- Supabase auth, storage, policies, functions, triggers, and environments.
- Login/logout/session/password reset/email verification design.
- Enterprise RBAC and permissions.
- RLS policy plan.
- Data access architecture.
- Form architecture.
- Zustand state plan.
- UI foundation from Phase 2.
- Performance and SEO foundation.
- Error handling and security controls.
- Testing and deployment architecture.
- Development rulebook.

Not included:

- Building feature screens.
- Implementing business workflows.
- Writing SQL migrations or app code.
- Creating actual Supabase project resources.
- Wiring Razorpay/Resend production credentials.

## 6. Official Reference Basis

Architecture decisions should stay aligned with official documentation:

- Next.js App Router and Route Handlers: https://nextjs.org/docs/app
- Next.js metadata: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Tailwind CSS v4 theme variables: https://tailwindcss.com/docs/theme
- Vercel environments and environment variables: https://vercel.com/docs/environment-variables

## 7. Architecture Summary

The platform uses a route-grouped Next.js App Router application with public, auth, member, trainer, admin, and API/webhook surfaces. Public pages are optimized for SEO, static/cached rendering, image performance, and conversion. Authenticated portals are server-first, role-protected, and scoped by gym tenant.

Supabase provides authentication, PostgreSQL database, storage, and optional edge functions/triggers. PostgreSQL RLS is the final enforcement layer for tenant isolation and least privilege. Server-side application code validates user sessions, roles, permissions, input schemas, and business rules before calling repositories. Repositories are the only layer that talks to Supabase database clients.

Feature modules own their domain UI, schemas, actions, services, and types. Shared UI primitives live under `components/ui`; cross-feature business utilities live under `lib`; external integrations live under `services`.

## 8. Future Phase Readiness

This foundation must allow future phases to add:

- Public website implementation.
- Member portal screens.
- Admin CRUD modules.
- Trainer workflows.
- Razorpay checkout and webhooks.
- Resend emails.
- Attendance and class booking.
- Workout and diet planning.
- Reports and analytics.
- Multi-branch or SaaS tenant expansion.

No future phase should need to rewrite auth, folder structure, data access, RBAC, RLS, or theme foundations.

