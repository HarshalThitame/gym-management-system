# 37 - Performance SEO and UI Foundation

## 1. Performance Target

The platform must target Lighthouse 95+ for public pages and maintain fast authenticated dashboard interactions.

Core targets:

| Metric | Target |
| --- | --- |
| LCP | Under 2.5 seconds. |
| INP | Under 200ms. |
| CLS | Under 0.1. |
| Public Lighthouse Performance | 95+. |
| Public Lighthouse SEO | 95+. |
| Public Lighthouse Accessibility | 95+. |

## 2. Server Components by Default

Rules:

- Pages are Server Components by default.
- Layouts are Server Components by default.
- Data fetching for initial render happens server-side.
- Client Components are used only for forms, interactive controls, local state, charts, motion, modals, drawers, and browser APIs.
- Do not mark a full page as client component unless impossible to avoid.

## 3. Client Component Rules

Client components are allowed for:

- React Hook Form forms.
- Zustand-consuming UI.
- Framer Motion wrappers.
- Theme toggles.
- Dropdowns, dialogs, drawers where needed.
- Charts.
- TanStack Table interactive table controls.
- Razorpay checkout trigger.

Client components are not allowed for:

- Static marketing content.
- Server-rendered dashboard shells.
- SEO metadata generation.
- Raw data access.
- Authorization decisions.

## 4. Dynamic Imports

Use dynamic imports for:

- Recharts.
- Rich text editor if added.
- Gallery lightbox.
- Heavy date picker if needed.
- Razorpay checkout SDK trigger path.
- Advanced report exports.

Rules:

- Do not dynamically import critical above-fold content.
- Use stable skeletons for dynamically loaded widgets.
- Avoid shifting layout after dynamic component loads.

## 5. Image Optimization

Rules:

- Use optimized responsive images.
- Reserve dimensions/aspect ratio for every image.
- Use one priority image for LCP.
- Lazy-load below-fold images.
- Use thumbnails for gallery.
- Use real gym/trainer/facility imagery.
- Avoid loading desktop hero media on mobile.
- Provide alt text for content images.

## 6. Font Optimization

Rules:

- Use Next.js font optimization.
- Use at most two primary families plus mono.
- Load only required weights.
- Avoid external font CSS.
- Configure fallback metrics where possible.
- Do not load display font on admin routes if not needed.

## 7. Route Prefetching

Rules:

- Use default Next.js link prefetch behavior where beneficial.
- Avoid aggressive prefetching of heavy admin/report pages.
- Prefetch high-value public conversion routes such as membership and free trial.
- Use route-level loading skeletons.

## 8. Edge Rendering Strategy

Use edge/runtime placement selectively.

Good candidates:

- Lightweight public redirects.
- Geo-independent public content if compatible.
- Simple public form rate-limit checks only if supporting infrastructure fits.

Prefer Node.js runtime for:

- Supabase server operations where Node compatibility is needed.
- Razorpay webhooks.
- Resend emails.
- Report exports.
- Complex server actions.

Rule: default to Node.js runtime unless there is a measured benefit and compatibility is confirmed.

## 9. Caching Strategy

| Data/Page | Strategy |
| --- | --- |
| Home | Static/cached; revalidate on content changes. |
| About/FAQ | Static/cached. |
| Plans | Cached public plans; revalidate on plan publish/update. |
| Trainers | Cached public profiles; revalidate on profile changes. |
| Blog | Static/cached by slug and listing. |
| Gallery | Cached metadata, lazy images. |
| Member portal | Dynamic, private. |
| Admin portal | Dynamic, private. |
| Reports | Dynamic; future aggregate cache. |
| Payments | Never publicly cached. |

## 10. Database Performance Rules

- Paginate all lists.
- Use indexed date/status filters.
- Avoid unbounded reports.
- Use summary views for dashboards where needed.
- Avoid selecting large JSONB fields for summary cards.
- Use transaction-aware operations for booking/payment flows.
- Monitor slow queries before launch.

## 11. SEO Architecture

All public pages must support:

- Static or generated metadata.
- Canonical URL.
- Open Graph metadata.
- Twitter card metadata.
- Structured data where applicable.
- Human-readable slugs.
- Sitemap inclusion.
- Robots rules.

## 12. Metadata Strategy

Page metadata ownership:

| Page Type | Metadata Source |
| --- | --- |
| Static public pages | Static metadata config. |
| Blog detail | Blog record SEO fields. |
| Trainer detail | Trainer profile fields. |
| Plan detail | Plan record fields. |
| Program detail | Program content record/static config. |
| Auth/portal/admin | Noindex or restricted metadata. |

Rules:

- Public pages must have unique title and description.
- Admin/member/trainer portals should not be indexed.
- Metadata generation must not perform heavy queries.

## 13. Open Graph Strategy

Required:

- Default OG image.
- Home OG image.
- Blog featured OG image.
- Trainer profile OG image where suitable.
- Plan/program OG image or branded fallback.

Rules:

- OG images should use real gym/facility/trainer visuals where possible.
- Avoid dark unreadable crops.
- Use production canonical URLs.

## 14. Schema Strategy

Use JSON-LD for:

- LocalBusiness/ExerciseGym.
- OfferCatalog for membership plans.
- Person for trainers.
- BlogPosting for blog posts.
- FAQPage for FAQ sections.
- BreadcrumbList for detail pages.
- Review/Testimonial only with real consented content.

Rules:

- Schema must match visible content.
- Do not create fake ratings.
- Validate structured data before launch.

## 15. Robots and Sitemap Strategy

Robots:

- Allow public pages.
- Disallow admin/member/trainer portal routes.
- Disallow internal API routes.

Sitemap:

- Include public pages.
- Include published blog posts.
- Include published trainer pages.
- Include published plan pages.
- Exclude drafts, archived records, portal pages, and API routes.

## 16. Performance Review Checklist

- Server Components by default.
- No payment SDK on initial public page load.
- No chart library on marketing pages.
- Images optimized and dimensioned.
- Fonts optimized.
- Public pages cached/static.
- Private pages not publicly cached.
- Tables paginated.
- Skeletons preserve layout.
- Lighthouse 95+ validated before launch.

