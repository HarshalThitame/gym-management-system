# 17 - Typography System

## 1. Typography Direction

The type system should feel precise, modern, and premium. It should support two different contexts:

- Public website: editorial, confident, conversion-focused.
- Dashboards: compact, scannable, high-density SaaS interface.

Do not scale typography using viewport-width units. Use breakpoint-specific sizes and stable line heights to avoid layout shifts.

## 2. Font Families

| Role | Font | Fallback | Usage |
| --- | --- | --- | --- |
| Primary UI | Geist Sans | Inter, system-ui, sans-serif | Dashboards, forms, navigation, body text. |
| Display | Satoshi or General Sans | Geist Sans, Inter, system-ui | Public hero, section headlines, premium marketing moments. |
| Mono | Geist Mono | ui-monospace, SFMono-Regular, Menlo, monospace | IDs, payment refs, technical metadata, optional stat labels. |

Implementation note: prefer `next/font` for self-hosted, optimized font loading and zero layout shift.

## 3. Typographic Principles

- Use strong size contrast on public pages.
- Use compact type on dashboards.
- Keep letter spacing at `0` unless using uppercase micro-labels.
- Avoid negative letter spacing.
- Keep line lengths between 55 and 75 characters for body copy.
- Use numeric tabular figures for dashboard stats, tables, money, and dates.
- Avoid all-caps long text. Use uppercase only for small labels under 16 characters.

## 4. Base Scale

| Token | Desktop Size | Mobile Size | Line Height | Weight | Usage |
| --- | --- | --- | --- | --- | --- |
| `text-xs` | 12px | 12px | 16px | 400/500 | Captions, table metadata. |
| `text-sm` | 14px | 14px | 20px | 400/500 | Labels, secondary body, table cells. |
| `text-md` | 16px | 16px | 24px | 400/500 | Body text, forms. |
| `text-lg` | 18px | 17px | 28px | 400/500 | Lead text, card descriptions. |
| `text-xl` | 20px | 19px | 28px | 500/600 | Small headings, stat labels. |
| `text-2xl` | 24px | 22px | 32px | 600 | H4/H5, card headings. |
| `text-3xl` | 30px | 26px | 38px | 650 | H3, section subheads. |
| `text-4xl` | 36px | 30px | 44px | 700 | H2 mobile/desktop compact. |
| `text-5xl` | 48px | 36px | 56px | 700 | H1 compact, section hero. |
| `text-6xl` | 60px | 42px | 68px | 750 | Display heading. |
| `text-7xl` | 72px | 48px | 80px | 750 | Large public hero desktop only. |

## 5. Heading Styles

| Style | Desktop | Tablet | Mobile | Line Height | Weight | Use |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | 64px | 56px | 40px | 1.08 | 750 | Public page primary headline. |
| H2 | 48px | 42px | 34px | 1.12 | 700 | Major sections. |
| H3 | 36px | 32px | 28px | 1.18 | 700 | Section subheads, page groups. |
| H4 | 28px | 26px | 24px | 1.25 | 650 | Card groups, portal page titles. |
| H5 | 22px | 21px | 20px | 1.3 | 650 | Card titles, dashboard widgets. |
| H6 | 18px | 18px | 17px | 1.35 | 600 | Small group headings. |

## 6. Display Text

| Style | Desktop | Tablet | Mobile | Line Height | Weight | Usage |
| --- | --- | --- | --- | --- | --- | --- |
| Display XL | 76px | 64px | 46px | 1.02 | 780 | Homepage hero only. |
| Display L | 64px | 54px | 40px | 1.06 | 750 | Landing page hero variants. |
| Display M | 52px | 44px | 36px | 1.1 | 730 | Premium section openers. |

Rules:

- Use one Display XL per page maximum.
- Do not use display styles inside dashboards, cards, modals, or compact panels.
- Keep hero headlines under 12 words where possible.

## 7. Body Text

| Style | Size | Line Height | Weight | Usage |
| --- | --- | --- | --- | --- |
| Body XL | 20px | 32px | 400 | Public hero supporting copy. |
| Body L | 18px | 30px | 400 | Section intro, plan descriptions. |
| Body M | 16px | 26px | 400 | Default paragraph. |
| Body S | 14px | 22px | 400 | Helper copy, table secondary text. |
| Body XS | 12px | 18px | 400 | Captions and metadata. |

## 8. Labels, Captions, and Microcopy

| Style | Size | Line Height | Weight | Letter Spacing | Usage |
| --- | --- | --- | --- | --- | --- |
| Label L | 14px | 20px | 600 | 0 | Form labels, filter labels. |
| Label M | 13px | 18px | 600 | 0 | Compact dashboard labels. |
| Label S | 12px | 16px | 600 | 0.02em only if uppercase | Badges, table labels. |
| Caption | 12px | 18px | 400 | 0 | Image captions, helper text. |
| Overline | 11px | 16px | 700 | 0.08em | Short uppercase category labels only. |

## 9. Button Text

| Button Size | Text Size | Line Height | Weight |
| --- | --- | --- | --- |
| Large | 16px | 24px | 650 |
| Medium | 14px | 20px | 650 |
| Small | 13px | 18px | 650 |
| Icon-only | No visible text required; tooltip/aria-label required. |

Rules:

- Button labels should be action verbs: "Book a Trial", "View Plans", "Renew Now".
- Avoid multi-line button text unless mobile layout absolutely requires it.
- Icon buttons require accessible labels and tooltips where helpful.

## 10. Form Text

| Element | Size | Line Height | Weight | Notes |
| --- | --- | --- | --- | --- |
| Field label | 14px | 20px | 600 | Always visible, never replaced by hint text alone. |
| Input text | 16px | 24px | 400 | 16px prevents mobile zoom issues. |
| Placeholder | 16px | 24px | 400 | Muted color, never a substitute for label. |
| Helper text | 13px | 18px | 400 | Below field. |
| Error text | 13px | 18px | 500 | Error color and text description. |

## 11. Dashboard Text

| Element | Desktop | Mobile | Weight | Usage |
| --- | --- | --- | --- | --- |
| Dashboard page title | 28px | 24px | 700 | Admin/member/trainer page heading. |
| Widget title | 16px | 16px | 650 | Card/widget heading. |
| Stat number | 36px | 30px | 750 | Revenue, counts, KPIs. |
| Stat compact | 24px | 22px | 700 | Small dashboard cards. |
| Table header | 12px | 12px | 700 | Uppercase optional, short labels. |
| Table cell | 14px | 14px | 400/500 | Dense data. |
| Filter text | 14px | 14px | 500 | Inputs/selects. |

## 12. Responsive Sizing Strategy

Breakpoints:

| Viewport | Strategy |
| --- | --- |
| 320px | Use mobile sizes, shorter headings, stacked layouts, full-width CTAs. |
| 375px | Mobile baseline. |
| 390px | Mobile baseline with slightly more spacing only where safe. |
| 414px | Mobile baseline; allow two-column small stat grids where content fits. |
| 768px | Tablet sizes; introduce wider grids and persistent portal header. |
| 1024px+ | Desktop sizes; full nav/sidebar; larger display type. |

Rules:

- Keep text within containers at all breakpoints.
- Prefer line breaks in content strategy over shrinking text below accessible sizes.
- Use dashboard compact styles on dense screens, not marketing display styles.
