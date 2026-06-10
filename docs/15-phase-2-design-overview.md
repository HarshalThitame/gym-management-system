# 15 - Phase 2 Design Overview

## 1. Purpose

Phase 2 defines the premium UI/UX system, brand design, content architecture, motion language, mobile behavior, dashboard design, accessibility rules, and performance-first design constraints for the Gym Management Website and Member Portal.

This phase intentionally does not include application code. It is a design and UX implementation specification for a future Next.js 15+, TypeScript, Tailwind CSS v4, Shadcn UI, Framer Motion, Supabase, PostgreSQL, and Vercel build.

## 2. Working Brand

Use the working brand name `Apex Performance Club` throughout content and design examples. If the real gym brand is different, replace:

| Token | Working Value |
| --- | --- |
| `brand.name` | Apex Performance Club |
| `brand.short_name` | Apex |
| `brand.tagline` | Train with intent. Move with power. |
| `brand.category` | Premium fitness club |
| `brand.location_label` | Your city |

## 3. Product Experience Goals

| Goal | Meaning |
| --- | --- |
| Premium, not generic | The UI should feel like a high-end fitness club and a serious SaaS product, not a template gym site. |
| Conversion-first public site | Every public page should guide visitors toward free trial, membership purchase, or WhatsApp/contact. |
| Operationally dense dashboards | Admin and staff screens should prioritize speed, clarity, filtering, tables, and fast actions. |
| Member confidence | Member portal should make status, payments, classes, and plans obvious. |
| Trainer focus | Trainer UI should prioritize assigned members, upcoming sessions, and plan work. |
| Performance-first | Design choices must support Lighthouse 95+ and Core Web Vitals targets. |
| Accessible by default | Color, focus, keyboard, reduced motion, and screen reader behavior must be built into the system. |

## 4. Design Direction

The product should combine:

- Luxury fitness club confidence.
- Modern startup website precision.
- Quiet SaaS dashboard density.
- Athletic energy through contrast, rhythm, photography, and restrained motion.

Avoid:

- Generic dumbbell icons as the main identity.
- Overused black/red gym palette.
- Heavy grunge textures.
- Excessive gradients.
- Clip-art fitness illustrations.
- Decorative orbs, bokeh blobs, and generic abstract shapes.
- Marketing-only layouts that hide the actual product experience.

## 5. Documentation Map

| Deliverable | File |
| --- | --- |
| Complete Design System | [18 - Component Library Specification](./18-component-library-specification.md) |
| Color Tokens | [16 - Brand Guidelines and Color Tokens](./16-brand-guidelines-color-tokens.md) |
| Typography System | [17 - Typography System](./17-typography-system.md) |
| Component Library Specification | [18 - Component Library Specification](./18-component-library-specification.md) |
| Homepage Wireframe Structure | [20 - Premium Homepage Design](./20-premium-homepage-design.md) |
| Mobile UX Specification | [23 - Mobile UX Specification](./23-mobile-ux-specification.md) |
| Dashboard Design Specification | [24 - Dashboard UI System](./24-dashboard-ui-system.md) |
| Animation Guidelines | [22 - Motion Design System](./22-motion-design-system.md) |
| Production-Ready Website Content | [21 - Production-Ready Content Strategy](./21-production-ready-content-strategy.md) |
| UI/UX Documentation | This Phase 2 documentation set |

## 6. Implementation Fit for the Planned Stack

| Stack Item | Design Implication |
| --- | --- |
| Next.js 15+ | Public pages should be server-rendered or cached; portal/admin pages dynamic and role-protected. |
| Tailwind CSS v4 | Design tokens should map cleanly to CSS variables and utility classes later. |
| Shadcn UI | Components should be specified as owned, customized primitives with Radix-compatible accessibility behavior. |
| Framer Motion | Motion should be restrained, GPU-friendly, and disabled or simplified with reduced motion. |
| Supabase/PostgreSQL | Dashboards should expect real loading, empty, error, and permission states. |
| Vercel | Design must preserve fast TTFB, image optimization, static/cached public pages, and small client bundles. |

