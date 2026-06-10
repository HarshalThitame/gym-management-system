# 22 - Motion Design System

## 1. Motion Philosophy

Motion should make the product feel smooth, premium, and responsive without becoming decorative. Animations should clarify hierarchy, confirm interactions, and guide attention.

Motion must be:

- Fast.
- Subtle.
- GPU-friendly.
- Accessible.
- Non-blocking.
- Stable, with no layout shifts.

Avoid:

- Bouncy spring effects on serious admin flows.
- Continuous background animation.
- Heavy parallax.
- Auto-rotating carousels.
- Animating layout-affecting properties like height, width, top, left where avoidable.

## 2. Motion Tokens

| Token | Value | Use |
| --- | --- | --- |
| `duration-instant` | 80ms | Micro feedback, icon toggles. |
| `duration-fast` | 120ms | Button hover, menu item hover. |
| `duration-base` | 180ms | Dropdowns, tabs, small cards. |
| `duration-smooth` | 240ms | Drawers, modals, accordions. |
| `duration-page` | 360ms | Page-level content entrance. |
| `ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Default ease-out. |
| `ease-emphasized` | cubic-bezier(0.16, 1, 0.3, 1) | Premium section reveals. |
| `ease-in` | cubic-bezier(0.4, 0, 1, 1) | Closing/exit. |
| `distance-xs` | 4px | Button/icon movement. |
| `distance-sm` | 8px | Small reveal. |
| `distance-md` | 12px | Card/section reveal. |
| `distance-lg` | 20px | Page content reveal. |

## 3. Page Transitions

### Public Website

| Transition | Behavior |
| --- | --- |
| Route entry | Main content fades in and moves up 12px over 300ms. |
| Hero entry | Headline, subheading, CTAs, and proof points stagger by 60ms. |
| Route exit | Optional fade out under 120ms; avoid delaying navigation. |

### Portals and Dashboards

| Transition | Behavior |
| --- | --- |
| Dashboard load | Shell appears immediately; widgets load independently with skeletons. |
| Tab change | Panel cross-fades under 160ms; no horizontal sliding for dense data. |
| Detail page | Header appears first, content follows in compact stagger. |

## 4. Scroll Animations

Use scroll animations only on public marketing pages and only for section entrance.

| Element | Animation |
| --- | --- |
| Section heading | Fade + translateY 12px. |
| Program cards | Fade + translateY 12px with 60ms stagger. |
| Facility images | Fade only or small scale from 0.98 to 1 inside fixed frame. |
| Testimonials | Fade + translateY 8px. |
| FAQ | No entrance animation required. |

Rules:

- Trigger once when 20 percent of section enters viewport.
- Do not animate every paragraph.
- Keep animations below 500ms total perceived delay.

## 5. Card Hover Animations

| Card Type | Hover Behavior |
| --- | --- |
| Public program card | Lift 2px, border shifts stronger, image scales to 1.03 inside fixed frame. |
| Trainer card | Image contrast slightly increases, CTA appears, no layout shift. |
| Plan card | Border emphasis and subtle shadow; recommended card remains stable. |
| Dashboard card | Border color changes; avoid lift for dense dashboards. |
| Table row | Background changes; row action appears if space allows. |

Use transform and opacity, not layout properties.

## 6. Button Interactions

| State | Motion |
| --- | --- |
| Hover | 120ms background/border shift, optional translateY(-1px) on public CTAs. |
| Active | 80ms pressed state with translateY(0) or slight darken. |
| Loading | Spinner or progress icon rotates; label width preserved. |
| Success | Optional check icon appears for submit confirmation. |

Rules:

- Do not animate button size.
- Button groups should not shift when one button enters loading state.

## 7. Navigation Interactions

### Public Desktop Nav

- Active link uses underline or small accent marker.
- Header background can become more solid after scroll.
- Header height must remain stable.

### Mobile Drawer

- Drawer slides from right or bottom over 240ms.
- Backdrop fades over 180ms.
- Focus moves into drawer.
- Close returns focus to menu button.

### Portal Sidebar

- Collapsed state animates width only if layout remains stable; otherwise snap.
- Active nav item uses stable accent strip and background.
- Tooltips appear for collapsed icon-only nav.

## 8. Dashboard Interactions

| Interaction | Motion |
| --- | --- |
| Filter apply | Controls remain stable; table skeleton or subtle opacity transition. |
| Table row action | Menu opens under 180ms. |
| Stat refresh | Value updates without count-up unless requested; show small loading state. |
| Chart hover | Tooltip appears under 120ms. |
| Drawer detail | Side drawer slides in over 240ms. |
| Toast | Slides/fades in under 180ms; auto-dismiss only for non-critical success. |

## 9. Modals and Drawers

| Component | Open | Close |
| --- | --- | --- |
| Modal | Fade + scale 0.98 to 1 over 180ms. | Fade + scale to 0.98 over 120ms. |
| Side drawer | TranslateX from 100% over 240ms. | TranslateX to 100% over 180ms. |
| Bottom drawer | TranslateY from 100% over 240ms. | TranslateY to 100% over 180ms. |

Rules:

- Trap focus.
- Prevent background scroll while open.
- Maintain clear close action.

## 10. Reduced Motion

When user prefers reduced motion:

- Disable scroll entrance animations.
- Replace page transitions with immediate opacity change or no animation.
- Remove parallax and large movement.
- Keep essential state changes visible through color, text, or icon.
- Skeleton shimmer should become static.

## 11. Performance Requirements

- Animate only transform and opacity where possible.
- Avoid large blurred layers.
- Avoid constant animation loops.
- Do not animate huge images across the viewport.
- Use lazy loading for motion-heavy components.
- Keep Framer Motion usage localized to interactive/client components.
- Public static content should not become client-rendered solely for animation.

## 12. Motion QA Checklist

- Animation does not cause layout shift.
- Interaction remains under 200ms perceived response.
- Reduced motion works.
- Keyboard users receive equivalent state feedback.
- Hover-only effects have focus equivalents.
- Mobile touch interactions do not depend on hover.
- Dashboard data remains readable without animation.

