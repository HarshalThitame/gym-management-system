# 18 - Component Library Specification

## 1. Design System Foundations

The component system should be built on Shadcn UI primitives customized with the Apex visual language. Components are owned source code in the future application, not a black-box dependency.

Global component rules:

- Radius: 8px for cards and panels, 6px for inputs and buttons, full radius only for avatars, small pills, and toggles.
- Border: 1px default, stronger border for selected states.
- Focus: 2px visible ring with 2px offset.
- Motion: 120ms to 220ms for interaction feedback.
- Touch target: minimum 44px height for primary mobile controls.
- Disabled states: visibly muted and non-interactive, never hidden.
- Loading states: preserve layout dimensions to avoid CLS.
- Icons: use lucide icons where an icon exists; icon-only controls require labels/tooltips.

## 2. Buttons

### Variants

| Variant | Usage | Visual |
| --- | --- | --- |
| Primary | Main action: Book Trial, Join Now, Renew. | Solid primary or volt depending theme/context. |
| Secondary | Secondary but important action. | Surface fill with strong border. |
| Outline | Low-emphasis action on public/admin pages. | Transparent with border. |
| Ghost | Navigation, table row actions. | Transparent, hover surface. |
| Destructive | Delete, cancel, refund. | Error background or outlined error. |
| Link | Inline text action. | Text with underline on hover. |
| Icon | Toolbar and compact actions. | Square, icon-centered. |

### Sizes

| Size | Height | Padding | Use |
| --- | --- | --- | --- |
| Large | 52px | 20px horizontal | Public hero CTAs. |
| Medium | 44px | 16px horizontal | Default forms and dashboards. |
| Small | 36px | 12px horizontal | Tables and compact controls. |
| Icon | 40px square | Centered | Toolbar/icon actions. |

### States

| State | Behavior |
| --- | --- |
| Default | Clear contrast and stable size. |
| Hover | Slight background shift and 1px visual lift using transform; no layout shift. |
| Active | Pressed state moves down 1px or darkens surface. |
| Focus | Visible ring and offset. |
| Disabled | Muted text/background, no pointer events. |
| Loading | Show spinner or progress icon; preserve label width; block duplicate submit. |

## 3. Cards

### Variants

| Variant | Usage |
| --- | --- |
| Public Feature Card | Programs, trainers, facilities, testimonials. |
| Plan Card | Membership pricing and benefit comparison. |
| Stat Card | Dashboard metric. |
| Data Card | Member status, workout plan, payment summary. |
| Action Card | Empty states and guided actions. |

### States

| State | Behavior |
| --- | --- |
| Default | Surface background, border, 8px radius. |
| Hover | Public cards can lift 2px and reveal media/action. Dashboard cards should use subtle border shift only. |
| Active/Selected | Strong border and accent marker. |
| Loading | Skeleton preserves card dimensions. |
| Disabled | Muted content and disabled action. |

Rules:

- Do not nest cards inside cards.
- Use cards for repeated items, tools, modals, and dashboard widgets only.
- Page sections should be full-width bands or unframed layouts, not floating section cards.

## 4. Forms

### Structure

| Element | Requirement |
| --- | --- |
| Label | Always visible and associated with input. |
| Required marker | Use text or accessible marker; explain required fields. |
| Helper text | Below field, concise. |
| Error text | Below field, specific and screen-reader accessible. |
| Submit area | Sticky on long mobile admin forms where useful. |

### States

| State | Behavior |
| --- | --- |
| Default | Clear label, field, helper. |
| Focus | Ring and border emphasis. |
| Invalid | Error border, error text, no color-only communication. |
| Disabled | Muted and non-editable. |
| Loading | Disable submit and show progress. |
| Success | Show confirmation, not just color. |

## 5. Inputs

| Variant | Usage |
| --- | --- |
| Text | Names, titles, search. |
| Email | Auth, leads, member profile. |
| Phone | Leads, members, emergency contact. |
| Currency | Plan price, payments. |
| Date/Time | Trials, memberships, classes. |
| Search | Members, leads, payments, classes. |

States: default, hover, focus, invalid, disabled, read-only, loading.

Rules:

- Minimum height 44px on mobile.
- Input text 16px minimum.
- Prefix/suffix areas for currency, search, calendar icons.
- Search inputs should debounce and keep clear button accessible.

## 6. Textareas

| Usage | Requirement |
| --- | --- |
| Lead message | Min 4 rows, character limit. |
| Notes | Auto-grow to max height, then scroll. |
| Medical notes | Sensitive data warning in admin/member forms. |
| Workout/diet notes | Structured helper text. |

States: default, focus, invalid, disabled, loading.

## 7. Selects and Comboboxes

| Component | Usage |
| --- | --- |
| Select | Small fixed option sets: status, plan, payment method. |
| Combobox | Searchable lists: members, trainers, classes. |
| Multi-select | Specialties, tags, filters. |

States:

- Default.
- Open.
- Focused.
- Selected.
- Disabled.
- Loading options.
- Empty results.
- Invalid.

Rules:

- Use native-friendly behavior on mobile when appropriate.
- Combobox results must be keyboard navigable.
- Long option text must wrap or truncate with tooltip/title where needed.

## 8. Dropdown Menus

| Usage | Requirement |
| --- | --- |
| Account menu | Profile, settings, logout. |
| Row actions | View, edit, archive, resend receipt. |
| Bulk actions | Future admin tables. |

States:

- Closed.
- Open.
- Focused item.
- Disabled item.
- Destructive item.

Rules:

- Use clear icons for common actions.
- Destructive actions require confirmation, not direct execution.

## 9. Badges

### Variants

| Variant | Use |
| --- | --- |
| Neutral | Draft, unknown, default metadata. |
| Success | Active, paid, attended, converted. |
| Warning | Expiring, pending, trial scheduled. |
| Error | Failed, expired, cancelled, no-show. |
| Info | Booked, scheduled, new lead. |
| Premium | Featured plan, recommended. |

States:

- Static.
- Clickable filter badge.
- Removable filter chip.

Rules:

- Badge text must remain readable at 12px.
- Do not use color alone; include clear text.

## 10. Tables

### Table Types

| Type | Usage |
| --- | --- |
| Data Table | Members, payments, leads, attendance. |
| Compact Table | Dashboard widgets. |
| Comparison Table | Membership plan comparison. |
| Audit Table | Audit logs and payment events. |

### Required Features

- Column headers.
- Sorting where useful.
- Filtering.
- Pagination.
- Empty state.
- Loading skeleton.
- Row action menu.
- Sticky header for long admin tables where useful.
- Responsive transformation to cards or stacked rows on small screens.

States:

- Loading.
- Empty.
- Error.
- Selected rows.
- Hover row.
- Active row.
- Disabled row action.

## 11. Tabs

| Usage | Requirement |
| --- | --- |
| Member detail | Profile, memberships, payments, attendance, plans. |
| Reports | Revenue, members, attendance, leads, classes. |
| Member portal | Upcoming/past bookings. |

States:

- Default.
- Hover.
- Active.
- Focus.
- Disabled.
- Loading tab panel.

Rules:

- Tabs should not wrap awkwardly on mobile; use horizontal scroll or segmented alternatives.
- Tab labels should be short.

## 12. Modals

| Modal Type | Usage |
| --- | --- |
| Confirmation | Archive, cancel, refund, delete draft. |
| Form Modal | Quick lead, quick payment, quick check-in. |
| Detail Modal | Receipt, class booking detail where non-critical. |

States:

- Opening.
- Open.
- Submitting.
- Error.
- Success.
- Closing.

Rules:

- Focus is trapped inside modal.
- Escape closes non-destructive modals.
- Destructive confirmations require explicit action label.
- On mobile, use drawer for complex forms instead of cramped modal.

## 13. Drawers

| Drawer Type | Usage |
| --- | --- |
| Mobile Navigation | Public/member/admin navigation. |
| Detail Drawer | Quick member/payment/lead preview. |
| Form Drawer | Add lead, record payment, check-in. |
| Filter Drawer | Mobile table filters. |

States:

- Closed.
- Open.
- Drag/closing if implemented.
- Submitting.
- Error.

Rules:

- Bottom drawers for mobile task flows.
- Side drawers for desktop previews.
- Provide clear close button and keyboard behavior.

## 14. Tooltips

| Usage | Requirement |
| --- | --- |
| Icon buttons | Explain function. |
| Truncated text | Show full value. |
| Chart points | Show exact metric and date. |

States:

- Hidden.
- Visible on hover/focus.
- Disabled where touch-only behavior is poor.

Rules:

- Do not put essential information only in tooltips.
- Tooltips should be concise.

## 15. Alerts

### Variants

| Variant | Use |
| --- | --- |
| Info | Helpful system context. |
| Success | Completed action. |
| Warning | Expiring membership, pending payment. |
| Error | Failed form/payment/action. |
| Neutral | Maintenance or general notice. |

States:

- Static.
- Dismissible.
- Actionable.
- Loading/retrying.

Rules:

- Include icon and text.
- Use action buttons for next step when relevant.
- Error alerts should not expose internal stack details.

## 16. Accordions

| Usage | Requirement |
| --- | --- |
| FAQ | Public FAQ content. |
| Plan details | Benefit groups on mobile. |
| Settings | Grouped configuration sections. |

States:

- Collapsed.
- Expanded.
- Focus.
- Disabled.

Rules:

- Keep animation under 220ms.
- Preserve keyboard navigation.

## 17. Pagination

| Type | Usage |
| --- | --- |
| Numbered pagination | Admin tables, blog listing. |
| Load more | Gallery and testimonials. |
| Cursor pagination | Large reports/search in future. |

States:

- First page.
- Middle page.
- Last page.
- Loading.
- Disabled controls.

Rules:

- Always show current page and result count.
- Mobile pagination can collapse to Previous/Next plus count.

## 18. Skeleton Loaders

| Usage | Requirement |
| --- | --- |
| Dashboard widgets | Preserve card height and chart area. |
| Tables | Show row skeletons with stable columns. |
| Public cards | Preserve image/card ratios. |
| Forms | Rare; prefer disabled loading state after submit. |

Rules:

- Skeleton must match final layout dimensions.
- Avoid animated shimmer if reduced motion is enabled.
- Do not show skeletons for actions that complete instantly.

## 19. Charts

### Chart Types

| Type | Usage |
| --- | --- |
| Line chart | Revenue, attendance trends. |
| Bar chart | Revenue by plan, class occupancy. |
| Donut chart | Lead source mix, payment method mix. |
| Funnel | Lead conversion. |
| Heatmap | Attendance peak times in later phase. |

States:

- Loading.
- Empty.
- Error.
- Hover point.
- Selected series.

Rules:

- Provide text summary with chart.
- Do not rely on color alone.
- Keep chart labels readable.
- Avoid heavy animated chart libraries if simpler SVG/canvas works.
- Dashboard charts should defer below main metrics if needed for performance.

## 20. Stat Cards

| Variant | Usage |
| --- | --- |
| Revenue Stat | Amount, trend, comparison. |
| Count Stat | Active members, leads, classes. |
| Risk Stat | Expiring memberships, failed payments. |
| Progress Stat | Attendance streak, plan completion future. |

States:

- Default.
- Positive trend.
- Negative trend.
- Warning.
- Loading.
- Empty.

Required fields:

- Label.
- Value.
- Timeframe.
- Trend or context.
- Link/action where useful.

## 21. Navigation Components

| Component | Usage |
| --- | --- |
| Public Header | Marketing nav, CTAs, login. |
| Mobile Public Drawer | Full-screen or side drawer with CTA. |
| Portal Sidebar | Admin/trainer/member desktop navigation. |
| Portal Header | Search, notifications, account menu. |
| Bottom Nav | Member mobile primary routes. |

States:

- Default.
- Active route.
- Hover.
- Focus.
- Collapsed.
- Loading user state.

## 22. Empty States

| Context | Empty State CTA |
| --- | --- |
| No leads | "Create Lead" or "Review Website Forms". |
| No members | "Add First Member". |
| No payments | "Record Payment". |
| No classes | "Create Class". |
| No attendance | "Check In Member". |
| No workout plan | "Create Workout Plan". |
| Member no membership | "Choose a Plan". |

Rules:

- Explain the state in one sentence.
- Provide one primary action.
- Avoid decorative illustration-heavy empty states in dashboards.

## 23. Component Quality Checklist

- Accessible name exists.
- Keyboard interaction works.
- Focus state visible.
- Disabled state clear.
- Loading state preserves dimensions.
- Error state uses text, not only color.
- Mobile tap area is at least 44px.
- Text does not overflow at 320px width.
- Motion respects reduced motion.
- Component uses semantic HTML where possible.

