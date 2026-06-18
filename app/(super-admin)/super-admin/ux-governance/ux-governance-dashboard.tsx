"use client";

import { Accessibility, Activity, CheckCircle2, Globe, Grid3x3, Keyboard, Layout, Palette, Settings, ShieldCheck, Sliders, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import type { AuthContext } from "@/types/auth";

type Props = { context: AuthContext };

const sections = [
  {
    id: "tokens", icon: <Palette className="size-5" />, title: "Design Tokens",
    description: "Colors, typography, spacing, border radius, shadows, animations, z-index layers, breakpoints",
    items: ["18 semantic color tokens (background, foreground, surface, border, primary, accent, secondary, destructive, success, warning)", "4 named colors (obsidian, ink, porcelain, steel)", "2 font families (Geist Sans, Geist Mono) with fallbacks", "3 border radii (sm: 4px, md: 6px, lg: 8px)", "Premium shadow token", "Light + Dark theme support via CSS custom properties", "Tenant branding via runtime CSS variable injection", "White-label theme editor with color pickers and contrast checking"]
  },
  {
    id: "components", icon: <Grid3x3 className="size-5" />, title: "Component Library",
    description: "All shared UI components",
    items: ["Button (7 variants: primary, accent, secondary, outline, ghost, destructive, link) + 4 sizes", "Input + Textarea with focus ring, disabled, placeholder states", "Card with CardHeader + CardContent", "Badge (6 variants: neutral, success, warning, error, info, premium)", "Toast (3 variants: success, error, info) with auto-dismiss + imperative API", "StatCard with status dot indicators (good/watch/risk)", "SectionHeading with eyebrow, title, description", "Skeleton (5 variants: text, circle, card, chart, table) + PageSkeleton + TableSkeleton", "EmptyState (4 types: no_data, no_results, no_permissions, initial_setup) + compact mode", "Pagination with page numbers, ellipsis, page size selector, total count", "Breadcrumbs with home icon, separators, current page indicator", "ConfirmDialog with 4 risk levels (low/medium/high/critical), reason input, confirmation text", "SearchInput with debounce, clear, autoFocus", "CommandPalette with keyboard navigation, category grouping, shortcut display", "FitnessLoader (full-page + inline), ChartSkeleton, FeatureLocked, PlanStatusBanner"]
  },
  {
    id: "accessibility", icon: <Accessibility className="size-5" />, title: "Accessibility (WCAG 2.2 AA)",
    description: "Accessibility features and compliance",
    items: ["Skip-to-content links in root layout + public layout", "ARIA attributes: aria-label, aria-current, aria-expanded, aria-modal, aria-disabled, aria-live, aria-hidden", "Role attributes: role=dialog, role=alert, role=status, role=navigation", "Focus-visible indicators with 2px offset ring on all interactive elements", "Touch targets: .touch-target class (44x44px minimum)", "Checkbox/radio inputs: 20x20px minimum, labels: 44px min-height", "Reduced motion: prefers-reduced-motion disables all animations", "Keyboard navigation: Escape closes modals/sidebar, Enter submits forms", "Color contrast checking in white-label theme editor via AccessibilityBadge", "Screen reader support: hidden labels, descriptive aria-labels on icon buttons", "High contrast mode support via CSS custom properties"]
  },
  {
    id: "layouts", icon: <Layout className="size-5" />, title: "Page Layout Standards",
    description: "Consistent layout patterns across all portals",
    items: ["Root layout: skip-to-content, PWA provider, tenant theme style injection", "Public layout: sticky header, dark footer, skip-to-content", "Portal shell: sidebar (w-72) + sticky header + mobile bottom nav + plan status banner", "Admin layout: 14 nav items with plan indicator", "Super Admin layout: 18 nav items (dashboard + 16 modules + approvals)", "Member layout: 11 nav items, suspended-only plan banner", "Trainer layout: 9 nav items", "Reception layout: 7 nav items", "Organization Owner layout: dynamic nav items", "Responsive: mobile sidebar (lg:hidden), desktop sidebar (lg:block), container-page utility"]
  },
  {
    id: "forms", icon: <Sliders className="size-5" />, title: "Form Experience",
    description: "Form patterns and validation",
    items: ["Pattern A: Server actions with useActionState (all auth, admin, enterprise forms)", "Pattern B: react-hook-form with Zod resolvers (public lead form)", "AuthSubmitButton: loading spinner via useFormStatus", "FormMessage: success/error banner with border color coding", "FieldError: per-field validation messages", "Zod schemas for all data validation", "Real-time validation via react-hook-form", "AutoComplete, required, aria-label on all form fields", "24 feature-specific form components across all modules"]
  },
  {
    id: "loading", icon: <Activity className="size-5" />, title: "Loading & Error States",
    description: "16 loading files + 16 error files across all roles",
    items: ["16 loading.tsx files (root, public, admin, member, trainer, reception, org-owner, super-admin, auth + 8 module-specific)", "16 error.tsx files (root, global, not-found, unauthorized, offline + 12 role/module-specific)", "FitnessLoader: full-page + inline animated spinner", "Skeleton: 5 variants for progressive loading", "ChartSkeleton: chart placeholder", "Error recovery: Try Again buttons on all error pages", "Global error boundary with inline styles (no CSS dependencies)", "Offline page for PWA disconnected state"]
  },
  {
    id: "shortcuts", icon: <Keyboard className="size-5" />, title: "Keyboard Productivity",
    description: "Global keyboard shortcuts and productivity features",
    items: ["Ctrl+K: Open command palette (global search)", "Ctrl+/: Show shortcut guide", "Ctrl+S: Save current form", "Escape: Close dialog / cancel", "Ctrl+1-3: Navigate to Dashboard/Members/Analytics", "Mac support: Cmd key detection, Mac-specific display (\u2318)", "CommandPalette: searchable, categorized, keyboard-navigable", "Portal sidebar: Escape key to close", "PWA shortcuts: Check In, Book a Class, Log Workout"]
  },
  {
    id: "responsive", icon: <Globe className="size-5" />, title: "Responsive Architecture",
    description: "Mobile, tablet, desktop, and large display support",
    items: ["Mobile sidebar drawer with overlay + body scroll lock", "MobileBottomNav: 4 primary items + More overflow menu", "Responsive grids: md:grid-cols-2/3/4 for all layout grids", "container-page: responsive width with 32px/48px padding", "Safe area insets: env(safe-area-inset-bottom)", "PWA support: manifest, service worker, install prompt, offline", "Device preview toggle in white-label theme editor", "Min-height touch targets on all interactive elements", "PWA screenshots: mobile (390x844) + desktop (1440x1024)"]
  },
  {
    id: "preferences", icon: <Settings className="size-5" />, title: "User Preference Center",
    description: "Persistent user preferences across sessions",
    items: ["Theme: light, dark, system (stored in zustand persist)", "Layout: full_width, split, dashboard, workspace", "Density: comfortable, compact", "Sidebar collapsed state", "Table page size: 10/25/50/100", "Animation toggle", "Keyboard shortcuts toggle", "Recently visited pages (last 10)", "Cross-device sync via localStorage persistence", "Settings pages: admin/settings, member/settings, member/profile"]
  },
  {
    id: "governance", icon: <ShieldCheck className="size-5" />, title: "UX Governance",
    description: "Quality enforcement and standards",
    items: ["Design token architecture via CSS custom properties + @theme directive", "Component governance: all UI in components/ui/, no bypass allowed", "Tailwind CSS v4 for consistent styling", "Class merging via cn() utility (clsx + tailwind-merge)", "Framer Motion available for animations", "Zustand for state management", "Zod for validation schemas", "TanStack Table for data tables", "Recharts for charting", "Lucide icons for consistent iconography", "Radix UI primitives (Dialog, Select, Accordion, Slot)", "next-themes for theme management", "All icons use aria-hidden=true with descriptive labels"]
  }
];

export function UxGovernanceDashboard({ context: _ctx }: Props) {
  void _ctx;
  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-surface via-surface to-primary/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-indigo-200 bg-indigo-50 text-indigo-800"><Palette className="mr-1 size-3" />UX Governance Reference</Badge>
                <Badge variant="info">Architecture Documentation</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
                UX Quality, Design System &<br />
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Experience Reference</span>
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                This page documents the design system architecture, component library, and UX standards used across the platform.
                Automated UX governance monitoring is not yet configured.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/super-admin/white-label" variant="secondary" className="gap-2"><Palette className="size-4" /> Theme Editor</ButtonLink>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-bold">Automated UX Governance Not Configured</p>
                <p className="mt-1 text-amber-700">Automated UX quality scoring, accessibility auditing, and design system compliance monitoring are not yet active.
                The information below is a static reference of the current architecture. To enable live UX governance, configure:
                automated Lighthouse CI audits, accessibility regression testing, design system violation tracking, and user feedback collection.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.id} className="hover:border-primary/20 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">{section.icon}</div>
                <div>
                  <h3 className="text-lg font-black">{section.title}</h3>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
