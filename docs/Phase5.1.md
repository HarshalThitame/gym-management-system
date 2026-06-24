Continue from docs/Phase5.1.md.
Execute Phase 5.1 — Core Motion Foundation for Organization Owner panel.

Short overview:
  framer-motion v12.23.26 is installed but completely unused. CSS reveal-up animations
  exist in globals.css (keyframes reveal-up with stagger via --reveal-delay CSS variable)
  but nothing uses them. Page transitions are hard cuts. KPI cards appear instantly.
  Cards have no hover lift. This phase activates the motion layer globally: page
  transitions via template.tsx + AnimatePresence, staggered KPI entrance animations,
  card hover lift + shadow with spring physics, and wiring up the existing reveal-up
  CSS as framer-motion variants. Zero new dependencies — framer-motion is already in
  package.json. The transformation is primarily wrapping existing components in motion
  wrappers and adding a template.tsx.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

PART A: Foundation — motion utility + template.tsx

Step 1: Create a shared motion utility file.
  File: lib/motion.ts

  This centralizes all framer-motion variants so every component uses the same
  animation language. Import this anywhere motion is needed.

  Content:
    import type { Variants, Transition } from "framer-motion";

    // ─── Spring configs ───
    export const springStiff: Transition = { type: "spring", stiffness: 400, damping: 30 };
    export const springGentle: Transition = { type: "spring", stiffness: 200, damping: 20 };
    export const springBouncy: Transition = { type: "spring", stiffness: 300, damping: 15 };
    export const tweenFast: Transition = { duration: 0.2, ease: "easeOut" };
    export const tweenMedium: Transition = { duration: 0.35, ease: "easeOut" };

    // ─── Page transition variants ───
    export const pageTransition: Variants = {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
      exit:    { opacity: 0, y: -8, transition: { duration: 0.18, ease: "easeIn" } },
    };

    // ─── Stagger children variants (for KPI grids, card lists) ───
    export const staggerContainer: Variants = {
      animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
    };

    export const fadeUpItem: Variants = {
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
    };

    // ─── Card hover ───
    export const cardHover = {
      whileHover: { y: -4, scale: 1.01, boxShadow: "0 16px 48px rgba(17, 18, 20, 0.10)", transition: springGentle },
      whileTap: { scale: 0.985, transition: tweenFast },
    };

    // ─── Button tap ───
    export const buttonTap = {
      whileTap: { scale: 0.96, transition: tweenFast },
    };

    // ─── Scale-in (for modals, drawers) ───
    export const scaleIn: Variants = {
      initial: { opacity: 0, scale: 0.94 },
      animate: { opacity: 1, scale: 1, transition: springStiff },
      exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
    };

    // ─── Slide-in from right (for drawers) ───
    export const slideInRight: Variants = {
      initial: { x: "100%", opacity: 0 },
      animate: { x: 0, opacity: 1, transition: springGentle },
      exit:    { x: "100%", opacity: 0, transition: { duration: 0.2 } },
    };

    // ─── Fade only (for subtle transitions) ───
    export const fadeOnly: Variants = {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.25 } },
      exit:    { opacity: 0, transition: { duration: 0.12 } },
    };

  All variants respect prefers-reduced-motion — framer-motion handles this natively
  when the user has reduced motion enabled.

Step 2: Create template.tsx for page transitions.
  File: app/(organization-owner)/organization/template.tsx

  Next.js template.tsx is the key to page transitions. Unlike layout.tsx (which
  persists), template.tsx remounts on every navigation — enabling exit animations.

  Content:
    "use client";
    import { motion, AnimatePresence } from "framer-motion";
    import { usePathname } from "next/navigation";
    import type { ReactNode } from "react";
    import { pageTransition } from "@/lib/motion";

    export default function OrganizationTemplate({ children }: { children: ReactNode }) {
      const pathname = usePathname();
      return (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      );
    }

  What this does: Every sub-page under /organization/* now fades up on enter and
  fades down on exit. The "mode='wait'" ensures the exiting page finishes before
  the entering page starts — clean transition, no overlap. "initial={false}" skips
  the animation on first page load (avoids flash on initial navigation).

  Also create for other portals:
    app/(super-admin)/super-admin/template.tsx    (same code, different path)
    app/(admin)/admin/template.tsx                  (same code)
    app/(trainer)/trainer/template.tsx              (same code)
    app/(reception)/reception/template.tsx          (same code)
    app/(member)/member/template.tsx                (same code)

  Each template.tsx uses the exact same code — just copy the file.

---

PART B: Dashboard — Staggered KPIs + Card Hover

Step 3: Add staggered entrance to enterprise dashboard KPI grid.
  File: features/organization-owner/components/enterprise-dashboard.tsx

  Import:
    import { motion } from "framer-motion";
    import { staggerContainer, fadeUpItem, cardHover, tweenMedium } from "@/lib/motion";

  Wrap the KPI grid section in a motion wrapper:
    Current: <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    New:     <motion.div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" variants={staggerContainer} initial="initial" animate="animate">

  Wrap each KPI card (<EnhancedKpiWidget>) in a motion item:
    <motion.div key={label} variants={fadeUpItem}>
      <EnhancedKpiWidget {...props} />
    </motion.div>

  Result: KPIs stagger in from the bottom, 0.06s apart, creating a wave entrance.

Step 4: Add card hover lift to StatCard and Card components.
  File: components/ui/stat-card.tsx

  Import motion and cardHover:
    import { motion } from "framer-motion";
    import { cardHover } from "@/lib/motion";

  Wrap the outer div with motion.div:
    <motion.div whileHover={cardHover.whileHover} whileTap={cardHover.whileTap} className="..." transition={cardHover.whileHover.transition}>
      {/* existing content */}
    </motion.div>

  File: components/ui/card.tsx — same treatment for the Card wrapper:
    import { motion } from "framer-motion";
    import { cardHover } from "@/lib/motion";
    <motion.div whileHover={cardHover.whileHover} whileTap={cardHover.whileTap} className={cn(...)} transition={cardHover.whileHover.transition}>
      {/* existing content */}
    </motion.div>

Step 5: Add motion to dashboard hero section.
  File: features/organization-owner/components/enterprise-dashboard.tsx

  Wrap the hero section in a motion div with fade-up:
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={tweenMedium} className="rounded-lg border border-border bg-surface p-5 md:p-7">

  This makes the dashboard title + stats slide in on every visit.

Step 6: Animate the charts section.
  File: features/organization-owner/components/enterprise-dashboard.tsx

  Wrap the 2-column chart grid:
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }} className="grid gap-5 xl:grid-cols-2">
      {/* Revenue Trend chart, Member Growth chart */}
    </motion.div>

  Wrap the branch performance + activity grid:
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.45, ease: "easeOut" }} className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      {/* Branch performance table, Recent activity */}
    </motion.div>

---

PART C: Portal Shell — Sidebar + Header Motion

Step 7: Add motion to sidebar navigation.
  File: components/layout/portal-shell.tsx

  Import:
    import { motion, AnimatePresence } from "framer-motion";
    import { springGentle, fadeOnly } from "@/lib/motion";

  Wrap the active page indicator with AnimatePresence and motion:
    Currently, active nav items just get a CSS class "bg-primary/10". Replace with:
    <AnimatePresence>
      {isActive && (
        <motion.div
          layoutId="active-nav-indicator"
          className="absolute inset-0 rounded-md bg-primary/10"
          transition={springGentle}
        />
      )}
    </AnimatePresence>

  This creates a smooth sliding indicator that follows the active nav item — one of
  the most visually impactful small changes. framer-motion handles the position
  interpolation automatically via layoutId.

  Import { usePathname } from "next/navigation" and compute isActive per nav item.

Step 8: Add motion to mobile sidebar.
  File: components/layout/portal-shell.tsx

  Replace the CSS transition classes with framer-motion:
    <motion.aside
      initial={{ x: "-100%" }}
      animate={{ x: sidebarOpen ? 0 : "-100%" }}
      transition={springGentle}
      className="..."
    >
      {/* sidebar content */}
    </motion.aside>

  For the overlay:
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: sidebarOpen ? 1 : 0 }}
      exit={{ opacity: 0 }}
      onClick={closeSidebar}
      className="fixed inset-0 z-40 bg-obsidian/60 lg:hidden"
    />

---

PART D: Drawers & Modals — Spring Open

Step 9: Animate the OrgOwnerDrawer component.
  File: features/organization-owner/components/org-owner-drawer.tsx

  Import:
    import { motion, AnimatePresence } from "framer-motion";
    import { slideInRight, fadeOnly, springGentle } from "@/lib/motion";

  Wrap the drawer content:
    <AnimatePresence>
      {open && (
        <>
          <motion.div variants={fadeOnly} initial="initial" animate="animate" exit="exit" className="fixed inset-0 z-50 bg-obsidian/50" onClick={onClose} />
          <motion.div variants={slideInRight} initial="initial" animate="animate" exit="exit" className="fixed right-0 top-0 z-50 h-full w-full max-w-lg ...">
            {/* drawer content */}
          </motion.div>
        </>
      )}
    </AnimatePresence>

  Result: Drawers slide in from the right with spring, overlay fades. Smooth and professional.

Step 10: Animate the confirm dialog.
  File: components/ui/confirm-dialog.tsx

  Import motion and scaleIn variants:
    import { motion, AnimatePresence } from "framer-motion";
    import { scaleIn, fadeOnly } from "@/lib/motion";

  Wrap in AnimatePresence with overlay fade + dialog scale-in from center.

---

PART E: Wire Up Existing reveal-up CSS

Step 11: Create a RevealOnScroll component.
  File: components/motion/reveal-on-scroll.tsx
  A reusable wrapper for the existing reveal-up CSS animation (globals.css lines 177-187).

  Content:
    "use client";
    import { motion, useInView } from "framer-motion";
    import { useRef } from "react";
    import type { ReactNode } from "react";

    type Props = { children: ReactNode; delay?: number; className?: string };
    export function RevealOnScroll({ children, delay = 0, className }: Props) {
      const ref = useRef(null);
      const inView = useInView(ref, { once: true, margin: "-40px" });
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={className}
        >
          {children}
        </motion.div>
      );
    }

  Use this anywhere you want scroll-triggered reveals:
    <RevealOnScroll delay={0.1}>
      <StatCard ... />
    </RevealOnScroll>

  Apply to: module data lists, report components, settings page sections.

---

PART F: Toast & Notification Motion

Step 12: Animate toast notifications.
  File: components/ui/toast.tsx

  Import:
    import { motion, AnimatePresence } from "framer-motion";
    import { springBouncy } from "@/lib/motion";

  Wrap the toast container:
    <AnimatePresence>
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ x: 80, opacity: 0, scale: 0.95 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: 80, opacity: 0, scale: 0.9 }}
          transition={springBouncy}
          className="..."
        >
          {/* toast content */}
        </motion.div>
      ))}
    </AnimatePresence>

  Result: Toasts slide in from the right with a bouncy overshoot — feels alive.

Step 13: Add pulse animation to notification badge.
  File: features/organization-owner/components/org-owner-notification-center.tsx
  If this component exists, add a subtle pulse when unread count changes:
    <motion.span
      key={unreadCount}
      initial={{ scale: 1.3 }}
      animate={{ scale: 1 }}
      transition={springBouncy}
      className="..."
    >
      {unreadCount}
    </motion.span>

---

PART G: Data Table Row Stagger

Step 14: Animate DataList rows.
  File: features/organization-owner/components/org-owner-data-list.tsx

  Import motion and stagger container:
    import { motion } from "framer-motion";
    import { staggerContainer, fadeUpItem } from "@/lib/motion";

  Wrap the tbody or row container:
    <motion.tbody variants={staggerContainer} initial="initial" animate="animate">
      {rows.map((row, i) => (
        <motion.tr key={row.id} variants={fadeUpItem} custom={i}>
          {/* row cells */}
        </motion.tr>
      ))}
    </motion.tbody>

  Result: Table rows stagger in on page load. Only triggers on initial render
  (variants only animate when entering "animate" state). Pagination/filter
  changes cause re-render which re-triggers the animation.

---

Step 15: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Manual testing:
  - Navigate between /organization/members → /organization/staff → dashboard.
    Each page should fade up on enter and fade down on exit.
  - Refresh the dashboard. KPIs should stagger in one by one.
  - Hover over any card. It should lift 4px with smooth spring.
  - Hover over a StatCard. Same lift effect.
  - Click a button. It should scale down slightly on press.
  - Open a member drawer. It should slide in from the right with spring.
  - Close a drawer. It should slide out with fade.
  - The active sidebar nav item should have a sliding indicator that moves.
  - Open the mobile sidebar. It should slide in from the left with spring.
  - Trigger a toast. It should bounce in from the right.
  - Visit a module with a data table. Rows should stagger in.

  Performance check:
  - framer-motion bundle size: ~31 KB gzipped (already in bundle since it's in package.json)
  - The <AnimatePresence> and <motion.div> wrappers add ~10 DOM nodes per page — negligible.
  - spring animations run on the GPU (compositor-only properties: transform + opacity).
  - No layout thrashing — all animations use transform/opacity, not width/height/top/left.

  Accessibility:
  - framer-motion natively respects prefers-reduced-motion. All animations become
    instant when the user has reduced motion enabled in their OS.
  - Verify: enable reduced motion in OS settings, refresh. Animations should be instant.

---

Files to Create:
  lib/motion.ts
  app/(organization-owner)/organization/template.tsx
  app/(super-admin)/super-admin/template.tsx (copy)
  app/(admin)/admin/template.tsx (copy)
  app/(trainer)/trainer/template.tsx (copy)
  app/(reception)/reception/template.tsx (copy)
  app/(member)/member/template.tsx (copy)
  components/motion/reveal-on-scroll.tsx

Files to Modify:
  features/organization-owner/components/enterprise-dashboard.tsx (staggered KPIs, hero, charts)
  components/ui/stat-card.tsx (card hover lift)
  components/ui/card.tsx (card hover lift)
  components/layout/portal-shell.tsx (sidebar indicator, mobile drawer)
  features/organization-owner/components/org-owner-drawer.tsx (drawer animation)
  components/ui/confirm-dialog.tsx (modal animation)
  components/ui/toast.tsx (toast animation)
  features/organization-owner/components/org-owner-data-list.tsx (row stagger)
