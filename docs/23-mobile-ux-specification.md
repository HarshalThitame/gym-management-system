# 23 - Mobile UX Specification

## 1. Mobile Experience Goals

The mobile experience must feel intentionally designed, not compressed from desktop. Public pages should convert quickly. Member pages should prioritize status and actions. Admin screens should remain usable for urgent tasks, even if deeper reporting is desktop-preferred.

Supported widths:

- 320px
- 375px
- 390px
- 414px
- 768px

## 2. Mobile Layout Rules

| Area | Requirement |
| --- | --- |
| Content width | Use full width with 16px padding at 320-390px, 20px at 414px, 24px+ at tablet. |
| Buttons | Primary CTAs full-width on narrow screens where paired buttons would crowd. |
| Typography | Use mobile type scale from typography system; do not use viewport font units. |
| Cards | Stack cards; two columns only for small stat cards where text remains readable. |
| Images | Use fixed aspect ratios and lazy loading. |
| Tables | Convert to stacked cards or horizontal scroll depending data density. |
| Forms | Single-column, labels always visible, sticky submit for long admin forms where useful. |

## 3. Public Mobile Navigation

### Header

- Left: logo/brand mark.
- Right: "Trial" compact CTA and menu icon.
- Header height: stable 64px.
- Header should become solid after scroll if hero uses media.

### Drawer

Sections:

| Group | Links |
| --- | --- |
| Explore | Home, About, Programs, Trainers, Gallery, Blog |
| Join | Membership Plans, Free Trial |
| Support | FAQ, Contact, WhatsApp, Login |

Drawer footer:

- Phone.
- WhatsApp.
- Opening hours.
- Location/directions link.

Behavior:

- Opens from right or full-screen on 320px.
- Focus trapped while open.
- Close button at top-right.
- Primary CTA fixed near bottom.

## 4. Member Mobile Navigation

Use bottom navigation for the most common member routes:

1. Dashboard
2. Membership
3. Classes
4. Payments
5. Profile

Secondary routes accessible from profile/menu:

- Attendance
- Workout Plans
- Diet Plans
- Notifications
- Settings

Rules:

- Bottom nav labels should be visible.
- Icons from lucide should support recognition.
- Active state uses text + icon color + top marker, not color alone.
- Keep bottom nav height stable.

## 5. Admin Mobile Navigation

Admin mobile should support urgent operations:

- Search member.
- Add lead.
- Record payment.
- Check in member.
- View dashboard summary.

Use:

- Top header with menu, search, notifications/account.
- Drawer navigation for full admin modules.
- Floating or sticky quick action only if it does not cover table content.

Avoid:

- Complex multi-column reports on 320px.
- Hidden critical actions.
- Tiny row action targets.

## 6. Trainer Mobile Navigation

Trainer mobile priority:

1. Dashboard
2. Members
3. Classes
4. Plans
5. Profile

Trainer screens should support:

- Opening assigned member detail quickly.
- Viewing upcoming classes.
- Marking class attendance.
- Creating/editing plan drafts in a mobile-friendly stepper or sections.

## 7. Mobile Forms

Rules:

- Inputs at least 44px tall.
- Text size at least 16px.
- Labels always visible.
- One field per row.
- Use correct keyboard types: phone, email, numeric, date/time.
- Show validation as soon as field loses focus or on submit.
- Preserve user input after errors.
- Sticky submit bar for long forms such as member creation, plan editor, class editor.

Important forms:

| Form | Mobile Behavior |
| --- | --- |
| Free Trial | Short, single-column, date/time fields easy to use. |
| Contact | Name, phone, email, message, consent. |
| Login/Register | Simple, centered, no distracting media on 320px. |
| Member Profile | Group into personal, emergency, fitness sections. |
| Admin Add Member | Step or grouped sections; sticky save. |
| Offline Payment | Member search first, then amount/method/reference. |
| Class Booking | Class detail first, action sticky at bottom. |

## 8. Mobile Dashboards

### Member Dashboard

Order:

1. Membership status card.
2. Primary action: Renew, Book Class, or View Plan depending state.
3. Upcoming classes.
4. Attendance summary.
5. Payment status.
6. Notifications.

### Admin Dashboard

Order:

1. Today summary: revenue, check-ins, new leads.
2. Quick actions.
3. Expiring memberships.
4. Payment exceptions.
5. Lead follow-ups.
6. Attendance trend compact chart.

### Trainer Dashboard

Order:

1. Today's classes.
2. Assigned members needing attention.
3. Upcoming sessions/classes.
4. Missing plan tasks.

## 9. Touch Interactions

| Interaction | Requirement |
| --- | --- |
| Tap targets | Minimum 44px. |
| Swipe | Optional for drawers only; never required for core actions. |
| Hover replacements | Use visible actions or tap-to-reveal menus. |
| Long press | Avoid for important features. |
| Sticky actions | Use for booking, renewing, saving long forms. |
| Toasts | Do not cover bottom nav or sticky action. |

## 10. Responsive Behavior by Width

### 320px

- Single-column everything.
- Use shorter CTA labels where needed: "Book Trial", "Join Now".
- Avoid side-by-side CTA buttons unless they fit.
- Admin tables become cards.

### 375px

- Baseline mobile layout.
- Two small stat cards can fit if labels are short.
- CTAs can be paired only if labels fit.

### 390px

- Slightly more breathing room.
- Member dashboard can use two-column compact stats.

### 414px

- Larger mobile.
- Drawer can use more generous spacing.
- Class cards can show trainer and capacity in one row.

### 768px

- Tablet layout.
- Public pages can introduce two-column sections.
- Member dashboard can use two-column card grids.
- Admin can show simplified tables with horizontal scroll.

## 11. Mobile Performance Requirements

- Avoid loading desktop-only media on mobile.
- Use responsive image sizes.
- Keep hero video optional and lightweight.
- Defer below-fold gallery.
- Avoid heavy chart rendering on first mobile dashboard load.
- Keep motion minimal on mobile to preserve battery and responsiveness.

## 12. Mobile Accessibility Checklist

- Text does not overflow at 320px.
- Buttons and inputs meet touch target size.
- Focus order follows visual order.
- Drawer focus is trapped and restored on close.
- Bottom nav has accessible labels.
- Form errors are announced and visible.
- Color contrast passes WCAG AA.
- Reduced motion is respected.

