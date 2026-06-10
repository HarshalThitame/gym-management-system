# 36 - UI Foundation and Design System Implementation

## 1. UI Foundation Goal

The UI foundation translates Phase 2 design decisions into implementation rules for Tailwind CSS v4, Shadcn UI, dark mode, typography, spacing, and component variants.

This phase does not implement UI components yet. It defines how they must be implemented.

## 2. Theme Provider

Required provider behavior:

- Supports light, dark, and system theme.
- Persists user preference.
- Avoids flash of incorrect theme.
- Exposes theme state to client components where required.
- Works with server-rendered layout.

Recommended theme modes:

| Mode | Use |
| --- | --- |
| Light | Public pages, member portal option, admin option. |
| Dark | Premium public hero/sections, dashboards option. |
| System | Default for authenticated users if desired. |

## 3. Dark Mode System

Dark mode must use semantic tokens, not one-off colors.

Rules:

- Components use semantic tokens such as `background`, `foreground`, `surface`, `border`, `primary`.
- Raw hex colors should live only in token definitions.
- Chart colors use chart tokens.
- Focus ring remains visible in both themes.
- Status colors have light and dark variants.

## 4. Typography Tokens

Implementation must include:

- Display styles for public marketing pages.
- Heading scale H1-H6.
- Body sizes.
- Label/caption styles.
- Dashboard stat styles.
- Tabular number utility for dashboards.

Rules:

- Use optimized font loading with Next.js.
- Do not use viewport-based font sizes.
- Display type is not used inside dashboards.
- Inputs use at least 16px text on mobile.

## 5. Spacing Tokens

Recommended spacing system:

| Token | Value | Use |
| --- | --- | --- |
| `space-1` | 4px | Tight icon/text gaps. |
| `space-2` | 8px | Compact control gaps. |
| `space-3` | 12px | Form helper spacing. |
| `space-4` | 16px | Mobile page padding baseline. |
| `space-5` | 20px | Card padding compact. |
| `space-6` | 24px | Section/card padding. |
| `space-8` | 32px | Layout groups. |
| `space-10` | 40px | Section spacing compact. |
| `space-12` | 48px | Desktop group spacing. |
| `space-16` | 64px | Public section spacing mobile/tablet. |
| `space-24` | 96px | Public section spacing desktop. |

Rules:

- Admin dashboards use smaller spacing than marketing pages.
- Mobile page padding starts at 16px.
- Do not create arbitrary spacing values unless design requires it.

## 6. Radius and Elevation Tokens

| Token | Value | Use |
| --- | --- | --- |
| `radius-sm` | 4px | Badges, tiny controls. |
| `radius-md` | 6px | Inputs, buttons. |
| `radius-lg` | 8px | Cards, panels, modals. |
| `radius-full` | 999px | Avatars, pills, toggles only. |

Elevation:

- Prefer borders over heavy shadows.
- Use subtle shadow only for dropdowns, modals, drawers, and public premium cards.
- Dark theme elevation uses border and surface shift more than shadow.

## 7. Component Variant Foundation

### Button Variants

| Variant | Use |
| --- | --- |
| Primary | Main CTA and primary form submit. |
| Secondary | Secondary action. |
| Outline | Lower emphasis action. |
| Ghost | Navigation/table actions. |
| Destructive | Cancel, archive, refund. |
| Link | Inline navigation. |
| Icon | Toolbar actions with accessible labels. |

### Card Variants

| Variant | Use |
| --- | --- |
| Default | General panels. |
| Elevated | Dropdown-like panels or premium public cards. |
| Stat | Dashboard metrics. |
| Plan | Membership plan cards. |
| Interactive | Clickable cards with hover/focus state. |
| Empty | Empty-state prompt. |

### Input Variants

| Variant | Use |
| --- | --- |
| Default | Standard forms. |
| Search | Search and filters. |
| Compact | Admin table filters. |
| Error | Invalid field state. |
| Readonly | Display immutable values in form layout. |

### Badge Variants

| Variant | Use |
| --- | --- |
| Neutral | Draft/default. |
| Success | Active/paid/converted. |
| Warning | Pending/expiring. |
| Error | Failed/expired/cancelled. |
| Info | New/booked/scheduled. |
| Premium | Recommended plan. |

## 8. Shadcn UI Strategy

Use Shadcn UI as owned source primitives.

Rules:

- Initialize non-interactively during implementation.
- Use Radix-compatible primitives unless project explicitly chooses otherwise.
- Customize theme tokens and variants to match Phase 2.
- Do not leave default theme untouched.
- Component files can be edited to fit the design system.
- Keep components accessible and tested.

Initial component set:

- Button
- Card
- Input
- Textarea
- Select
- Dialog
- Drawer/Sheet
- Dropdown Menu
- Tabs
- Accordion
- Alert
- Badge
- Tooltip
- Table
- Skeleton
- Pagination
- Calendar/Date Picker
- Form

## 9. Icon System

Use Lucide Icons.

Rules:

- Icon-only controls require accessible labels.
- Use consistent icon sizes: 16px compact, 18px default, 20px large.
- Do not manually draw SVG icons when Lucide has a suitable icon.
- Icons support text labels; do not rely on icons alone in complex workflows.

## 10. Motion Foundation

Use Framer Motion only where it adds value:

- Public section reveals.
- Drawers/modals.
- Small interactive transitions.
- Toasts.

Rules:

- Keep Server Components server-rendered; do not convert pages to client components just for animation.
- Animate transform/opacity.
- Respect reduced motion.
- Keep dashboard motion minimal.

## 11. Accessibility Foundation

Every component variant must define:

- Keyboard behavior.
- Focus state.
- Disabled state.
- Loading state where applicable.
- Screen reader label or semantics.
- Error state.
- Reduced motion behavior where animated.

## 12. UI Foundation QA

- Theme switches without visual flash.
- Light/dark tokens are complete.
- Shared components do not contain domain logic.
- Button/card/input variants match Phase 2.
- Text does not overflow at 320px.
- Focus state visible.
- Loading states preserve dimensions.
- Components pass accessibility tests.

