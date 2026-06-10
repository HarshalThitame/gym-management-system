# 11 - Performance Requirements

## 1. Performance Goals

| Area | Target |
| --- | --- |
| Lighthouse Performance | 95+ for key public pages on production. |
| Lighthouse Accessibility | 95+ minimum; target 100 where practical. |
| Lighthouse Best Practices | 95+ minimum. |
| Lighthouse SEO | 95+ minimum for public pages. |
| Mobile-first loading | Public pages optimized for mobile network and viewport. |
| Portal usability | Authenticated dashboards provide meaningful content quickly and avoid blocking on non-critical widgets. |

## 2. Core Web Vitals Targets

| Metric | Target | Notes |
| --- | --- | --- |
| LCP | Under 2.5 seconds | Optimize hero media, server rendering, and critical CSS. |
| INP | Under 200 ms | Keep client JavaScript small and interactions efficient. |
| CLS | Under 0.1 | Reserve dimensions for images, cards, tables, nav, and dashboard widgets. |
| TTFB | Under 800 ms for public cached pages | Use static/cached rendering where possible. |
| FCP | Under 1.8 seconds | Reduce render-blocking assets and large bundles. |

## 3. Next.js Rendering Strategy

| Page Type | Recommended Rendering |
| --- | --- |
| Home | Static or cached rendering with revalidation after content changes. |
| About | Static/cached. |
| Membership Plans | Cached public data; revalidate on plan publish/update. |
| Trainers | Cached public data; revalidate on trainer publish/update. |
| Gallery | Cached public data with lazy image loading. |
| Testimonials | Cached public data; revalidate on publish/update. |
| Blog Listing | Cached/paginated; revalidate on publish/update. |
| Blog Detail | Static/cached by slug; revalidate on content update. |
| Contact | Static/cached shell; form submission dynamic. |
| Free Trial | Static/cached shell; form submission dynamic. |
| Member Portal | Dynamic authenticated rendering. |
| Trainer Portal | Dynamic authenticated rendering. |
| Admin Panel | Dynamic authenticated rendering. |
| Payment Routes | Dynamic server route handlers only. |
| Webhooks | Dynamic route handlers with raw body verification. |

## 4. Image Optimization

Requirements:

- Use optimized responsive images for public content.
- Reserve width/height or aspect ratio for all images to prevent layout shift.
- Use priority loading only for the primary above-fold LCP image.
- Lazy-load below-fold gallery, trainer, testimonial, and blog images.
- Use modern formats where supported.
- Require alt text for gallery, trainer, blog, testimonial, and facility images.
- Avoid oversized original images in public pages.
- Store assets in Supabase Storage or another managed storage layer and serve through approved image optimization config.

Image-specific rules:

| Image Type | Requirement |
| --- | --- |
| Hero image | Must be compressed, responsive, and sized for mobile/desktop. |
| Gallery images | Use thumbnails for grid and larger image only in lightbox/detail. |
| Trainer photos | Use consistent aspect ratio. |
| Blog images | Use featured image with fixed aspect ratio and alt text. |
| Logo | Use small optimized asset with explicit dimensions. |

## 5. JavaScript and Bundle Requirements

| Requirement | Detail |
| --- | --- |
| Server Components first | Keep public and dashboard data rendering server-side where possible. |
| Client components only when needed | Use client components for forms, modals, filters, interactive charts, and Razorpay checkout. |
| Lazy-load heavy UI | Charts, lightboxes, editors, and rich text tools should be dynamically loaded. |
| Avoid unused libraries | Do not add heavy dependencies for simple UI behavior. |
| Analyze bundle | Run bundle analysis before production launch. |
| Forms | Use progressive enhancement where possible. |

## 6. Caching Strategy

### 6.1 Public Content

| Data | Cache Strategy |
| --- | --- |
| Home content | Cache and revalidate on content/settings changes. |
| Membership plans | Cache published plans; revalidate when plan status/pricing changes. |
| Trainers | Cache public trainer profiles; revalidate on profile update. |
| Gallery | Cache published gallery metadata; revalidate on publish/archive. |
| Testimonials | Cache published testimonials; revalidate on approval/update. |
| Blogs | Cache published blog list/detail; revalidate on publish/update/archive. |

### 6.2 Authenticated Data

| Data | Cache Strategy |
| --- | --- |
| Member dashboard | Do not publicly cache. Can use request-scoped server fetch caching only if safe. |
| Admin dashboard | Do not publicly cache. Consider short-lived server-side aggregate cache in later phase. |
| Reports | Cache aggregates per gym/date range if report usage becomes heavy. |
| Notifications | No public cache; client refresh or realtime optional. |

### 6.3 Payment Data

- Never cache payment mutation responses publicly.
- Payment status pages may poll or refetch from server.
- Webhook processing must be idempotent and not rely on cached state.

## 7. Database Optimization

Required indexes are defined in the database architecture. Additional performance rules:

- Always paginate lists: members, leads, payments, attendance, classes, blogs, gallery.
- Use date range filters on reports.
- Use indexed status/date fields for dashboard widgets.
- Avoid querying large JSONB plan data when only summary is needed.
- Use summary views or materialized views for heavy reporting if volume grows.
- Use transaction-safe booking capacity checks.
- Avoid N+1 queries by loading related data through joins or batched queries.
- Use search indexes for member/lead search once datasets grow.

## 8. API Performance Requirements

| API Category | Requirement |
| --- | --- |
| Public forms | Validate and respond quickly; email sending can happen asynchronously where possible. |
| Dashboards | Return summary payloads rather than full table data. |
| Reports | Paginate and restrict date ranges; export large reports asynchronously in later phases. |
| Search | Enforce minimum query length and pagination. |
| Payments | Keep order creation fast; avoid blocking on non-critical emails. |
| Webhooks | Verify, persist event, process idempotently, respond quickly. |

## 9. PWA Performance Requirements

| Area | Requirement |
| --- | --- |
| App shell | Member portal should be installable with manifest and icons. |
| Offline behavior | Show cached shell or helpful offline page; do not expose stale private data unintentionally. |
| Caching | Cache static assets safely; avoid caching authenticated API responses unless deliberately encrypted/scoped. |
| Updates | Service worker should update predictably and not trap users on old UI. |

## 10. Accessibility and Performance Interaction

- Avoid layout shift from late-loading content.
- Keep focus management fast and predictable.
- Do not hide loading states from screen readers.
- Avoid infinite skeletons; show error states.
- Respect reduced motion to avoid unnecessary animation work and accessibility issues.

## 11. Monitoring Requirements

| Area | Requirement |
| --- | --- |
| Web vitals | Capture Core Web Vitals in production where possible. |
| Errors | Track client and server errors. |
| API latency | Monitor slow endpoints, especially reports and dashboards. |
| Payment failures | Track payment creation, callback, and webhook errors. |
| Form failures | Track validation and submission errors. |
| Database | Monitor slow queries and connection usage. |

## 12. Lighthouse 95+ Checklist

| Category | Requirement |
| --- | --- |
| Performance | Optimized images, minimal JS, cached public pages, no layout shift, fast TTFB. |
| Accessibility | Labels, keyboard support, contrast, headings, focus, alt text. |
| Best Practices | HTTPS, secure cookies, no console errors, safe third-party scripts. |
| SEO | Metadata, canonical, crawlable links, structured data, sitemap, robots. |

## 13. Page-Specific Performance Budgets

| Page | Budget |
| --- | --- |
| Home | Initial JS under practical minimum; one priority image; below-fold sections lazy. |
| Membership Plans | Fast plan list; no payment SDK loaded until checkout action. |
| Gallery | Use paginated/lazy thumbnails; avoid loading full-size images in grid. |
| Blog Detail | Static/cached content; optimized featured image. |
| Member Dashboard | Summary payload only; defer non-critical widgets. |
| Admin Dashboard | Load metric groups independently; avoid full report queries on first load. |
| Reports | Query only after filters selected; paginate detail tables. |

