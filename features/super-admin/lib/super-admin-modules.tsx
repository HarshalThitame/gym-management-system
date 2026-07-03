import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  DatabaseBackup,
  FileText,
  Flag,
  Gauge,
  Globe2,
  HeartPulse,
  LifeBuoy,
  LockKeyhole,
  Palette,
  Settings,
  ShieldCheck,
  UsersRound,
  Eye,
  Siren
} from "lucide-react";
import type { ReactNode } from "react";
import type { PortalNavItem } from "@/components/layout/portal-shell";

export type SuperAdminModule = {
  slug: string;
  href: string;
  label: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconKey: PortalNavItem["iconKey"];
  responsibilities: string[];
  safeguards: string[];
};

export const superAdminModules = [
  {
    slug: "organizations",
    href: "/super-admin/organizations",
    label: "Organizations",
    title: "Organization Management",
    description: "Create, review, activate, suspend, and govern tenant organizations across the SaaS platform.",
    icon: <Building2 className="size-5" />,
    iconKey: "briefcase",
    responsibilities: ["Create and maintain organization profiles", "Assign subscription plans and ownership", "Review organization usage and revenue", "Suspend or reactivate organizations"],
    safeguards: ["Every ownership or status change is audited", "Tenant data remains scoped by organization id", "Destructive changes require confirmation"]
  },
  {
    slug: "branches",
    href: "/super-admin/branches",
    label: "Gyms",
    title: "Gym and Location Management",
    description: "Manage gyms, locations, status, assignments, capacity, and tenant-level operational visibility.",
    icon: <Building2 className="size-5" />,
    iconKey: "users",
    responsibilities: ["Create and assign gyms to organizations", "Activate, suspend, or archive gyms", "View gym members, staff, trainers, revenue, and usage", "Track gym codes, cities, timezones, and currencies"],
    safeguards: ["Cross-tenant access is allowed only for Super Admin", "Gym changes are written to activity logs", "Operational edits remain auditable"]
  },
  {
    slug: "domains",
    href: "/super-admin/domains",
    label: "Domains",
    title: "Domain Management",
    description: "Approve and monitor custom domains, DNS verification, SSL status, and tenant routing health.",
    icon: <Globe2 className="size-5" />,
    iconKey: "settings",
    responsibilities: ["Assign custom domains to organizations and branches", "Verify DNS and SSL readiness", "Review domain provider events", "Remove unhealthy or expired domains"],
    safeguards: ["Domain ownership must be verified before activation", "Routing changes are logged", "Primary-domain changes require explicit confirmation"]
  },
  {
    slug: "subscriptions",
    href: "/super-admin/subscriptions",
    label: "Subscriptions",
    title: "Subscription Management",
    description: "Govern SaaS plans, tenant subscriptions, limits, renewals, upgrades, downgrades, and usage controls.",
    icon: <CreditCard className="size-5" />,
    iconKey: "credit-card",
    responsibilities: ["Create and assign Starter, Professional, and Enterprise plans", "Track active and expired subscriptions", "Review branch, member, and storage limits", "Manage upgrades, downgrades, renewals, and suspensions"],
    safeguards: ["Plan mutations require Super Admin approval", "Limit changes are audited", "Billing-impacting updates are recorded"]
  },
  {
    slug: "billing",
    href: "/super-admin/billing",
    label: "Billing",
    title: "Platform Billing",
    description: "Review platform revenue, failed payments, invoices, refunds, MRR, ARR, and subscription analytics.",
    icon: <CreditCard className="size-5" />,
    iconKey: "receipt",
    responsibilities: ["View all SaaS billing records", "Track failed subscription payments", "Review invoices and refund workflows", "Monitor MRR, ARR, and plan-level revenue"],
    safeguards: ["Refund actions require privileged confirmation", "Payment webhooks remain server-verified", "Financial exports are logged"]
  },
  {
    slug: "users",
    href: "/super-admin/users",
    label: "Users",
    title: "Global User Management",
    description: "Manage organization owners, gym admins, reception staff, trainers, and members across all tenants.",
    icon: <UsersRound className="size-5" />,
    iconKey: "users",
    responsibilities: ["Create, deactivate, lock, and unlock users", "Reset passwords and force logout when required", "View login history and role assignments", "Transfer ownership for tenant recovery"],
    safeguards: ["Super Admin changes to roles and accounts are audited", "Member fitness records are not directly modified", "Sensitive changes require confirmation"]
  },
  {
    slug: "roles",
    href: "/super-admin/roles",
    label: "Roles",
    title: "Role and Permission Management",
    description: "Maintain RBAC roles, permission matrices, assignment rules, and tenant-safe access governance.",
    icon: <LockKeyhole className="size-5" />,
    iconKey: "settings",
    responsibilities: ["Create and update roles", "Assign permissions and validate role scope", "Review RBAC matrix coverage", "Control privileged access boundaries"],
    safeguards: ["Role changes create security audit events", "Privilege escalation paths are blocked", "Super Admin role assignment is restricted"]
  },
  {
    slug: "settings",
    href: "/super-admin/settings",
    label: "Settings",
    title: "Platform Settings",
    description: "Control global SaaS branding, feature flags, notification settings, AI settings, storage, and platform configuration.",
    icon: <Settings className="size-5" />,
    iconKey: "settings",
    responsibilities: ["Manage global settings and platform defaults", "Control feature flags and rollout states", "Configure email, notification, AI, and storage defaults", "Review tenant-level overrides"],
    safeguards: ["Global configuration changes are logged", "Sensitive toggles require explicit confirmation", "Tenant overrides do not leak across organizations"]
  },
  {
    slug: "white-label",
    href: "/super-admin/white-label",
    label: "White Label",
    title: "White Label Management",
    description: "Configure logos, colors, themes, custom branding, email branding, and organization-level brand controls.",
    icon: <Palette className="size-5" />,
    iconKey: "tags",
    responsibilities: ["Review organization and gym branding", "Configure white-label theme defaults", "Validate logo, favicon, and email branding", "Monitor custom-domain brand mappings"],
    safeguards: ["Branding assets are tenant-scoped", "Unsafe asset URLs are rejected", "Theme changes preserve accessibility contrast"]
  },
  {
    slug: "support",
    href: "/super-admin/support",
    label: "Support",
    title: "Support Center",
    description: "Manage support tickets, escalations, customer health, documentation, and platform support workflows.",
    icon: <LifeBuoy className="size-5" />,
    iconKey: "message-square",
    responsibilities: ["Review tenant support tickets", "Escalate and resolve operational issues", "Track customer health and risk", "Surface documentation for admins and staff"],
    safeguards: ["Support access is auditable", "Emergency tenant inspection is logged", "Sensitive support actions require reason capture"]
  },
  {
    slug: "security",
    href: "/super-admin/security",
    label: "Security",
    title: "Security Center",
    description: "Review audit logs, security logs, MFA policies, password policies, suspicious activity, and access events.",
    icon: <ShieldCheck className="size-5" />,
    iconKey: "bell",
    responsibilities: ["Monitor security events and login activity", "Review suspicious activity and incident state", "Manage MFA and password policies", "Export security evidence for compliance"],
    safeguards: ["Security exports are logged", "Critical security actions require confirmation", "Audit logs are immutable operational records"]
  },
  {
    slug: "analytics",
    href: "/super-admin/analytics",
    label: "Analytics",
    title: "Enterprise Analytics & Business Intelligence Center",
    description: "Executive BI, revenue intelligence, membership analytics, churn prediction, LTV analytics, branch benchmarking, trainer performance, marketing attribution, predictive forecasting, capacity planning, and behavior intelligence across all tenants.",
    icon: <BarChart3 className="size-5" />,
    iconKey: "bar-chart",
    responsibilities: [
      "View enterprise executive KPIs: Total Revenue, MRR, ARR, Active Members, Churn, Retention, LTV, ARPM, CAC, NRR, Expansion Revenue, Refund Rate, Occupancy, Branch Performance Index",
      "Analyze revenue intelligence: MRR, ARR, deferred, collected, outstanding, refund, expansion, upgrade, downgrade revenue by tenant, branch, region, plan, service, and source",
      "Track membership analytics: active, new, renewals, freezes, expirations, cancellations, and monthly/quarterly/yearly cohorts with retention and LTV",
      "Monitor retention & churn intelligence: day 7/30/90/annual retention, churn trends, churn by branch/plan, AI-powered churn predictions with risk scoring",
      "Analyze customer LTV: current, predicted, average LTV with high-value, medium, at-risk, VIP, champion segmentation",
      "Review branch & franchise performance: scorecards, top/under performers, growth leaders, and cross-tenant benchmarking",
      "Track trainer performance intelligence: sessions, revenue, retention impact, attendance, satisfaction, and upsell performance",
      "Analyze marketing campaigns: leads, conversions, CAC, ROI, attribution models, and channel performance across Google Ads, Meta, Instagram, WhatsApp, referrals, organic",
      "Run predictive forecasting: revenue, membership, and growth projections with best case, expected, worst case, and custom scenario modeling",
      "Monitor capacity & utilization: occupancy rates, peak hours, equipment/studio/trainer utilization, and overcrowding risk detection",
      "Analyze customer behavior: engagement segments (active, highly engaged, casual, at-risk, inactive), journey mapping (lead to referral), and behavioral indicators",
      "Configure automated alerts: revenue drops, churn spikes, attendance declines, payment failures, and branch performance deterioration with email, SMS, Slack, Teams, webhook channels"
    ],
    safeguards: [
      "Analytics access is role-guarded with Super Admin having platform-wide visibility",
      "Tenant data isolation is preserved through row-level security on all analytics tables",
      "Exports are audited for compliance tracking",
      "Aggregates must not leak individual tenant data across organizations",
      "Predictive models and AI insights use anonymized aggregated data only"
    ]
  },
  {
    slug: "monitoring",
    href: "/super-admin/monitoring",
    label: "Monitoring",
    title: "Enterprise Observability & Monitoring Center",
    description: "Global operations command center with real-time platform health, service registry, incident management, queue/cron monitoring, error tracking, on-call scheduling, status pages, capacity planning, escalation policies, tenant health, and SLO/SLA tracking.",
    icon: <HeartPulse className="size-5" />,
    iconKey: "activity",
    responsibilities: [
      "Monitor platform health score, uptime, availability, reliability, and SLA compliance across 12+ critical services",
      "Track service health grid with real-time status for API, database, storage, email, SMS, WhatsApp, payment, AI, auth, workers, cache, and web application",
      "Manage full incident lifecycle: New → Investigating → Identified → Mitigated → Resolved → Closed with SEV-1 to SEV-4 severity classification",
      "Monitor background job queues: email, SMS, WhatsApp, billing, analytics, notification, AI, and sync queues with depth, processing rate, retries, and failures",
      "Track cron job and scheduler health: last run, next run, success rate, average duration, failure count, and overdue detection",
      "Centralized error tracking across frontend, backend, API, database, third-party, AI, payment, and auth errors with frequency, severity, and impact analysis",
      "Manage on-call schedules with rotation types (daily/weekly/biweekly/monthly), primary and backup engineers, and escalation levels",
      "Track capacity planning metrics: database growth, storage growth, traffic volume, API requests, and queue depth with 30/90-day forecasts",
      "Monitor per-tenant health scores, availability, error counts, and revenue risk impact",
      "Configure escalation policies with multi-level chains (Operations → Engineering → Platform → Leadership) and automated timeout-based escalation",
      "Track SLO/SLA compliance: uptime targets, error budgets, P95 latency, and burn rate forecasting"
    ],
    safeguards: [
      "All monitoring views are Super Admin only with role-guarded access",
      "Provider credentials are never exposed in monitoring views",
      "Incident lifecycle actions are immutable and audited",
      "Tenant health data is isolated with RLS policies",
      "On-call schedules and escalation policies require privileged confirmation",
      "Capacity forecasts are advisory only - no automated scaling actions"
    ]
  },
  {
    slug: "backups",
    href: "/super-admin/backups",
    label: "Backups",
    title: "Enterprise Backup, Recovery & Disaster Recovery Center",
    description: "Global backup operations, recovery management, DR readiness, cross-region replication, point-in-time recovery, ransomware protection, backup verification, storage tier management, compliance reporting, and multi-level approval workflows across the entire SaaS platform.",
    icon: <DatabaseBackup className="size-5" />,
    iconKey: "receipt",
    responsibilities: [
      "Monitor executive backup KPIs: total backups, success/failure rates, RPO, RTO, data protected, storage consumed, DR readiness score, active recovery jobs",
      "Manage enterprise backup catalog: full, incremental, differential, snapshot, point-in-time, and continuous backups with type/scope/status/size/encryption/verification tracking",
      "Orchestrate recovery operations: full platform, infrastructure, database, storage, tenant, multi-tenant, branch, and data-level recovery with guided restore workflow",
      "Track cross-region replication: active-passive, active-active, geo-redundant with lag monitoring, sync status, and health checks",
      "Automate backup verification: completeness checks, file integrity validation, database consistency, encryption validity, and full recovery testing",
      "Manage backup storage tiers: hot, warm, cold, archive with capacity tracking, deduplication savings, compression savings, and growth trends",
      "Monitor ransomware protection: mass deletion detection, encryption activity, backup tampering, suspicious access, immutable backup enforcement, and air-gap violation alerts",
      "Configure automated backup schedules: hourly, daily, weekly, monthly, custom cron with smart scheduling based on database load and traffic volume",
      "Manage point-in-time recovery points: exact timestamp, minute, hour, daily, and weekly granularity across databases, storage, configurations, and tenant data",
      "Generate compliance reports: GDPR, SOC 2, ISO 27001, HIPAA-ready, PCI DSS considerations with automated backup and recovery testing documentation",
      "Enforce approval workflows: multi-level (Operations → Platform Admin → Security → Executive) with MFA verification for production restores and destructive actions",
      "Manage destructive action protection: delete backup, purge, tenant restore, full system restore require MFA verification, password confirmation, and dual authorization"
    ],
    safeguards: [
      "Restore workflows require multi-level MFA verification and approval chain before execution",
      "Backup exports and recovery operations are immutable and fully audited",
      "Production restore drills require controlled operations with impact analysis",
      "Tenant data is isolated with RLS ensuring zero cross-tenant contamination during recovery",
      "Immutable backups prevent modification or deletion within retention windows",
      "Destructive actions (backup deletion, purging) require dual authorization with justification",
      "Cross-region replication maintains data sovereignty and compliance boundaries"
    ]
  },
  {
    slug: "audit-logs",
    href: "/super-admin/audit-logs",
    label: "Audit Logs",
    title: "Audit and Activity Logs",
    description: "Search platform activity, role changes, settings updates, security events, and privileged actions.",
    icon: <FileText className="size-5" />,
    iconKey: "receipt",
    responsibilities: ["Review logins, role changes, payments, settings updates, and tenant events", "Export audit reports", "Track emergency override usage", "Support compliance investigations"],
    safeguards: ["Audit records are append-only by policy", "Exports are logged", "Sensitive member records require emergency override workflow"]
  },
  {
    slug: "feature-audit",
    href: "/super-admin/feature-audit",
    label: "Feature Audit",
    title: "Feature Availability Audit",
    description: "Compare what each SaaS plan promises against what is actually implemented in the application. Detect gaps, stale entitlements, and sync organization entitlements.",
    icon: <Activity className="size-5" />,
    iconKey: "activity",
    responsibilities: ["Audit package_features against app implementation", "Detect configured-but-not-implemented gaps", "View implementation rate per plan", "Sync organization entitlements and limits", "Cleanup stale entitlement records"],
    safeguards: ["Read-only audit view — no data mutations from the report", "Sync and cleanup actions require Super Admin confirmation", "All sync operations are idempotent and audited"]
  },
  {
    slug: "feature-flags",
    href: "/super-admin/feature-flags",
    label: "Feature Flags",
    title: "Feature Flag Governance",
    description: "Control global, tenant-level, and branch-level feature rollout for SaaS plans and enterprise deployments.",
    icon: <Flag className="size-5" />,
    iconKey: "tags",
    responsibilities: ["Enable and disable platform features", "Control tenant and branch rollout", "Map features to SaaS plans", "Review active and staged flags"],
    safeguards: ["Flag changes are audited", "Plan-restricted features require validation", "Risky rollouts should use staged enablement"]
  },
  {
    slug: "ux-governance",
    href: "/super-admin/ux-governance",
    label: "UX Governance",
    title: "UX Quality, Design System & Experience Governance",
    description: "Enterprise design system, component library, accessibility compliance, keyboard shortcuts, user preferences, and UX quality scoring governing every screen across all portals.",
    icon: <Eye className="size-5" />,
    iconKey: "settings",
    responsibilities: [
      "Manage enterprise design system: 28 design tokens (colors, typography, spacing, radii, shadows, animations), light/dark/system themes, and tenant branding",
      "Maintain component library: Button (7 variants), Input, Card, Badge (6 variants), Toast (3 variants), Skeleton (5 variants), EmptyState (4 types), Pagination, Breadcrumbs, ConfirmDialog, SearchInput, CommandPalette",
      "Enforce WCAG 2.2 AA accessibility: skip-to-content, ARIA attributes, focus indicators, touch targets, screen reader support, reduced motion, contrast checking",
      "Govern page layout standards across 6 portals (admin, super-admin, member, trainer, reception, org-owner) with consistent header/filter/KPI/content/action/pagination patterns",
      "Standardize form experience: server actions with useActionState, real-time validation, consistent FormMessage/FieldError/AuthSubmitButton patterns across 24+ form components",
      "Manage loading & error states: 16 loading.tsx files, 16 error.tsx files, skeleton progressive loading, FitnessLoader, error recovery with retry actions",
      "Implement keyboard productivity: Ctrl+K command palette, Ctrl+S save, Ctrl+/ shortcuts, Escape close, global shortcut guide, Mac support",
      "Maintain responsive architecture: mobile sidebar drawer, MobileBottomNav, responsive grids, safe area insets, PWA support, device preview",
      "Power user preference center: theme, layout, density, sidebar, page size, animations, keyboard shortcuts, recently visited (persisted via zustand)",
      "Track UX quality: accessibility score, design consistency, component usage compliance, performance UX metrics"
    ],
    safeguards: [
      "All UI must use shared components from components/ui/ - no custom UI that bypasses the design system",
      "Accessibility compliance automatically verified via contrast checking in theme editor",
      "Loading states must use Skeleton or FitnessLoader patterns - no raw animate-pulse bypass",
      "Error boundaries must follow the established error.tsx pattern with retry actions",
      "All icons must use aria-hidden=true with descriptive aria-labels for screen readers"
    ]
  },
  {
    slug: "production-safety",
    href: "/super-admin/production-safety",
    label: "Production Safety",
    title: "Enterprise Production Safety & Operational Governance",
    description: "Operational risk monitoring, destructive action protection, multi-step confirmation workflows, change impact analysis, permission transparency, rate limiting, financial operation protection, emergency override management, and production change windows.",
    icon: <Siren className="size-5" />,
    iconKey: "bell",
    responsibilities: [
      "Monitor operational risk KPIs: high-risk actions today, pending approvals, destructive actions blocked, emergency overrides, permission violations, audit events, security escalations, policy violations",
      "Track operational risk score across 4 dimensions: tenant risk, user risk, system risk, compliance risk with overall composite score",
      "Enforce destructive action protection framework: 15 protected actions (delete tenant, delete branch, delete user, delete membership, delete backups, bulk operations, data purges, restore operations, refunds, subscriptions, transfers, exports, bulk suspend, bulk assign, permission changes)",
      "Manage multi-level confirmation workflow: Level 1 (simple confirm), Level 2 (type-to-confirm), Level 3 (password), Level 4 (MFA), Level 5 (MFA + approval) with progressive risk escalation",
      "Provide change impact analysis: records affected, tenants affected, branches affected, reversibility status, and risk warnings for every destructive operation",
      "Display permission transparency: allowed, restricted, requires approval, and read-only status badges with resource/action context",
      "Monitor rate limiting & abuse prevention: login attempts, API calls, bulk imports, exports, notifications, AI requests with usage percentage and remaining quota",
      "Track financial operation protection: refunds, invoice edits, subscription changes, payment reversals, revenue adjustments with MFA + approval + audit trail requirements",
      "Manage emergency overrides: tenant recovery, admin recovery, security lockout bypass, disaster recovery with reason entry, MFA verification, time-limited access, and full audit logging",
      "Generate compliance reporting for GDPR, SOC 2, ISO 27001: sensitive actions, policy violations, approval compliance, and audit trail exports"
    ],
    safeguards: [
      "No destructive operation can execute without explicit protection - all 15 protected actions require confirmation with the correct keyword",
      "High-risk actions (tenant deletion, data purge, restore) require MFA verification + type-to-confirm + Super Admin approval workflow",
      "Financial operations (refunds, payment reversals, revenue adjustments) require audit preview + MFA + approval + immutable audit trail",
      "Emergency overrides are time-limited (default 60 minutes) with mandatory reason entry and full audit logging",
      "Rate limiting is enforced across all categories with clear user feedback showing remaining requests and retry windows",
      "All permission violations and policy violations are tracked with severity classification and mitigation status"
    ]
  }
] satisfies SuperAdminModule[];

export const superAdminNavItems = [
  { href: "/super-admin", label: "Dashboard", icon: <Gauge className="size-5" />, iconKey: "gauge" },
  { href: "/super-admin/approvals", label: "Approvals", icon: <ShieldCheck className="size-5" />, iconKey: "bell" },
  ...superAdminModules.map((module) => ({
    href: module.href,
    label: module.label,
    icon: module.icon,
    iconKey: module.iconKey
  }))
] satisfies PortalNavItem[];

export function getSuperAdminModule(slug: string) {
  return superAdminModules.find((module) => module.slug === slug) ?? null;
}
