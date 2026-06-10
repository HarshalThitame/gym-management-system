# 25 - Accessibility and Performance-First Design

## 1. Accessibility Standard

Target WCAG 2.2 AA across public website, member portal, trainer dashboard, and admin panel.

Accessibility must be designed into:

- Color.
- Typography.
- Components.
- Navigation.
- Forms.
- Motion.
- Dashboards.
- Content.

## 2. Contrast Requirements

| Element | Requirement |
| --- | --- |
| Body text | Minimum 4.5:1 contrast. |
| Large text | Minimum 3:1 contrast. |
| Icons conveying meaning | Minimum 3:1 contrast. |
| Form borders/states | Must be distinguishable from background. |
| Focus rings | Must be highly visible in light and dark themes. |
| Disabled controls | Can be lower contrast but must remain recognizable as disabled. |

Rules:

- Volt green on white should not be used for small text.
- Coral should be reserved for warning/error and paired with text.
- Do not rely on color alone for status badges.

## 3. Keyboard Navigation

Requirements:

- All interactive elements reachable by keyboard.
- Focus order matches visual order.
- Skip link available on public and portal layouts.
- Menus, dialogs, drawers, selects, tabs, and accordions follow expected keyboard behavior.
- Row action menus can be opened by keyboard.
- Modals and drawers trap focus and restore focus on close.
- Destructive actions require confirmable keyboard-accessible controls.

## 4. Focus States

Focus treatment:

- 2px ring.
- 2px offset.
- Use `ring` token.
- Visible on all themes.

Required for:

- Links.
- Buttons.
- Inputs.
- Selects.
- Textareas.
- Menu items.
- Table row actions.
- Tabs.
- Accordions.
- Cards that are clickable.

## 5. Screen Reader Support

| Element | Requirement |
| --- | --- |
| Images | Descriptive alt text for content images; empty alt for decorative images. |
| Forms | Labels, descriptions, errors, and required states announced. |
| Alerts | Important alerts announced with appropriate live region behavior. |
| Tables | Headers associated with cells. |
| Charts | Provide text summary and accessible data alternative. |
| Icon buttons | Accessible name required. |
| Loading states | Use appropriate busy/loading announcements where needed. |
| Navigation | Landmarks for header, nav, main, footer. |

## 6. Reduced Motion

When reduced motion is enabled:

- Disable scroll reveal animations.
- Disable parallax.
- Disable shimmer skeletons.
- Keep drawer/modal transitions simple or instant.
- Preserve state changes with text/icon/color.

## 7. Accessible Content Rules

- Use clear headings and hierarchy.
- Avoid vague link text like "Click here".
- Use specific CTAs.
- Keep paragraphs short.
- Explain payment and membership states clearly.
- Error messages should tell users what to fix.
- Avoid shame-based fitness content.

## 8. Performance-First Design Requirements

The design must support Lighthouse Performance above 95.

| Area | Requirement |
| --- | --- |
| CLS | Reserve space for images, cards, nav, dashboard widgets, tables, and skeletons. |
| Images | Use responsive sizes, compression, lazy loading, and priority only for hero/LCP image. |
| Fonts | Use optimized self-hosted loading through Next.js font strategy. |
| JavaScript | Keep public pages mostly server-rendered; client JS only for necessary interactivity. |
| Motion | Animate transform/opacity only; avoid continuous animations. |
| Charts | Lazy load or render lightweight charts; do not block dashboard shell. |
| Forms | Avoid heavy client validation bundles where server validation can handle logic. |
| Media | Avoid large autoplay video on mobile. |

## 9. Image Performance Rules

| Image Type | Rule |
| --- | --- |
| Hero | One priority image/video, responsive, compressed, with reserved dimensions. |
| Program cards | Lazy-loaded below fold, fixed aspect ratio. |
| Trainer photos | Consistent aspect ratio, optimized size. |
| Gallery | Thumbnail grid, full image only on demand. |
| Blog images | Optimized featured image and alt text. |
| Dashboard avatars | Small optimized images or initials fallback. |

## 10. Font Performance Rules

- Use at most two primary font families plus mono.
- Preload only critical font weights.
- Use variable fonts where possible.
- Use fallback metrics to avoid layout shift.
- Avoid loading display font on admin routes if not needed.

## 11. JavaScript Budget Rules

Public pages:

- Avoid loading admin/member code.
- Do not load payment SDK until checkout.
- Do not load chart libraries.
- Keep animation client components isolated.

Dashboards:

- Load charts after primary stats where possible.
- Paginate server-side.
- Avoid shipping large data arrays to the browser.
- Use server-rendered shell and client components for interactive controls only.

## 12. Layout Stability Rules

- Header height stable before/after scroll.
- Hero media dimensions reserved.
- Cards do not resize on hover.
- Buttons preserve width during loading.
- Skeletons match final content.
- Toasts do not shift layout.
- Bottom nav does not cover page actions.

## 13. Accessibility QA Checklist

- Public pages pass heading hierarchy review.
- All form inputs have labels.
- All images have appropriate alt text.
- Keyboard-only user can complete trial form, login, renew membership, book class, and admin check-in.
- Modal/drawer focus management works.
- Charts have text summaries.
- Status badges include text.
- Reduced motion works.
- Contrast passes AA in light and dark themes.

## 14. Performance QA Checklist

- Lighthouse 95+ public pages.
- LCP under 2.5s.
- CLS under 0.1.
- INP under 200ms.
- No oversized images.
- No unnecessary client bundles on public pages.
- No console errors.
- Dashboard widgets have stable skeletons.
- Payment flow does not load Razorpay before checkout action.

