# Gym Management Website and Member Portal - Phase 1 Documentation

This folder contains the product discovery, requirements analysis, and system architecture documentation for a modern gym management website and member portal.

Planned technology stack:

- Next.js 15+ with App Router
- TypeScript
- Tailwind CSS
- Shadcn UI
- Supabase Auth, Database, Storage, and Realtime where appropriate
- PostgreSQL
- Vercel
- Resend Email
- Razorpay
- PWA support

No application code is included in this phase. These documents are intended to be detailed enough for a developer or another AI agent to implement the product without requiring additional discovery.

## Documents

### Phase 1 - Product Discovery and Architecture

1. [Business Requirements Document](./docs/01-business-requirements.md)
2. [Functional Requirements Document](./docs/13-functional-requirements-document.md)
3. [Non Functional Requirements Document](./docs/14-non-functional-requirements-document.md)
4. [User Roles and Permissions Matrix](./docs/02-user-roles-matrix.md)
5. [Feature Inventory](./docs/03-feature-inventory.md)
6. [User Flows](./docs/04-user-flows.md)
7. [Information Architecture and Sitemap](./docs/05-information-architecture.md)
8. [Database Architecture](./docs/06-database-architecture.md)
9. [API Architecture](./docs/07-api-architecture.md)
10. [Dashboard Requirements](./docs/08-dashboard-requirements.md)
11. [Security Specification](./docs/09-security-specification.md)
12. [SEO and Marketing Requirements](./docs/10-seo-marketing-requirements.md)
13. [Performance Requirements](./docs/11-performance-requirements.md)
14. [MVP Scope and Future Roadmap](./docs/12-roadmap.md)

### Phase 2 - Premium UI/UX, Brand, and Content Architecture

15. [Phase 2 Design Overview](./docs/15-phase-2-design-overview.md)
16. [Brand Guidelines and Color Tokens](./docs/16-brand-guidelines-color-tokens.md)
17. [Typography System](./docs/17-typography-system.md)
18. [Component Library Specification](./docs/18-component-library-specification.md)
19. [Premium Website Information Architecture](./docs/19-premium-information-architecture.md)
20. [Premium Homepage Design](./docs/20-premium-homepage-design.md)
21. [Production-Ready Content Strategy](./docs/21-production-ready-content-strategy.md)
22. [Motion Design System](./docs/22-motion-design-system.md)
23. [Mobile UX Specification](./docs/23-mobile-ux-specification.md)
24. [Dashboard UI System](./docs/24-dashboard-ui-system.md)
25. [Accessibility and Performance-First Design](./docs/25-accessibility-and-performance-first-design.md)
26. [Phase 2 UI/UX Documentation Handoff](./docs/26-phase-2-ui-ux-documentation.md)

### Phase 3 - Technical Foundation and Development Architecture

27. [Phase 3 Technical Foundation Overview](./docs/27-phase-3-technical-foundation-overview.md)
28. [Project Structure and Module Architecture](./docs/28-project-structure-and-module-architecture.md)
29. [TypeScript Standards](./docs/29-typescript-standards.md)
30. [Database Foundation and Migrations](./docs/30-database-foundation-and-migrations.md)
31. [Supabase Architecture](./docs/31-supabase-architecture.md)
32. [Authentication Architecture](./docs/32-authentication-architecture.md)
33. [Authorization RBAC and Permission Matrix](./docs/33-authorization-rbac-permission-matrix.md)
34. [Row Level Security Policy Plan](./docs/34-row-level-security-policy-plan.md)
35. [API Data Layer Forms and State](./docs/35-api-data-layer-forms-state.md)
36. [UI Foundation and Design System Implementation](./docs/36-ui-foundation-design-system-implementation.md)
37. [Performance SEO and UI Foundation](./docs/37-performance-seo-ui-foundation.md)
38. [Security Error Handling and Observability](./docs/38-security-error-handling-observability.md)
39. [Testing CI/CD and Deployment](./docs/39-testing-ci-cd-deployment.md)
40. [Development Rulebook](./docs/40-development-rulebook.md)

## Product Summary

The product is a SaaS-ready gym management platform for a commercial fitness business. It combines a public marketing website, a member self-service portal, and an internal admin panel for operations, billing, attendance, trainer assignments, class management, lead handling, and reporting.

## Primary Outcomes

- Convert website visitors into free trial leads and paid members.
- Reduce manual reception work for membership sales, renewals, attendance, and payment tracking.
- Give members a self-service experience for plans, class bookings, payments, workouts, diet plans, and notifications.
- Give trainers a focused workspace for assigned members, sessions, and fitness plan updates.
- Give gym owners and administrators accurate visibility into revenue, retention, attendance, lead conversion, and operational performance.

## Architecture Notes

- Use Next.js App Router route groups for public website, member portal, admin panel, and auth screens.
- Use Supabase PostgreSQL as the system of record.
- Use Supabase Auth for authentication, with role and permission enforcement in database row-level security and server-side authorization checks.
- Use Razorpay for online payments and webhooks for payment status reconciliation.
- Use Resend for transactional emails such as email verification, password reset, payment receipts, trial confirmations, membership expiry reminders, and class notifications.
- Use Vercel for deployment, environment management, preview deployments, and edge-friendly caching of public pages.
