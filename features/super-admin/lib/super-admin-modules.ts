import {
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
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PortalNavItem } from "@/components/layout/portal-shell";

export type SuperAdminModule = {
  slug: string;
  href: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
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
    icon: Building2,
    iconKey: "briefcase",
    responsibilities: ["Create and maintain organization profiles", "Assign subscription plans and ownership", "Review organization usage and revenue", "Suspend or reactivate organizations"],
    safeguards: ["Every ownership or status change is audited", "Tenant data remains scoped by organization id", "Destructive changes require confirmation"]
  },
  {
    slug: "gyms",
    href: "/super-admin/gyms",
    label: "Gyms",
    title: "Gym and Branch Management",
    description: "Manage gyms, branches, status, assignment, branch capacity, and tenant-level operational visibility.",
    icon: Building2,
    iconKey: "users",
    responsibilities: ["Create and assign gyms to organizations", "Activate, suspend, or delete gyms", "View branch members, staff, trainers, revenue, and usage", "Track gym codes, cities, timezones, and currencies"],
    safeguards: ["Cross-tenant access is allowed only for Super Admin", "Branch changes are written to activity logs", "Operational edits remain auditable"]
  },
  {
    slug: "domains",
    href: "/super-admin/domains",
    label: "Domains",
    title: "Domain Management",
    description: "Approve and monitor custom domains, DNS verification, SSL status, and tenant routing health.",
    icon: Globe2,
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
    icon: CreditCard,
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
    icon: CreditCard,
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
    icon: UsersRound,
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
    icon: LockKeyhole,
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
    icon: Settings,
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
    icon: Palette,
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
    icon: LifeBuoy,
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
    icon: ShieldCheck,
    iconKey: "bell",
    responsibilities: ["Monitor security events and login activity", "Review suspicious activity and incident state", "Manage MFA and password policies", "Export security evidence for compliance"],
    safeguards: ["Security exports are logged", "Critical security actions require confirmation", "Audit logs are immutable operational records"]
  },
  {
    slug: "analytics",
    href: "/super-admin/analytics",
    label: "Analytics",
    title: "Platform Analytics",
    description: "Track SaaS revenue, organization growth, gym growth, trainer growth, member growth, churn, and subscriptions.",
    icon: BarChart3,
    iconKey: "bar-chart",
    responsibilities: ["View platform growth and subscription analytics", "Compare organizations and branch performance", "Monitor churn and expansion signals", "Review executive BI snapshots"],
    safeguards: ["Analytics access is role-guarded", "Exports are audited", "Aggregates must preserve tenant isolation"]
  },
  {
    slug: "monitoring",
    href: "/super-admin/monitoring",
    label: "Monitoring",
    title: "System Monitoring",
    description: "Monitor API, database, storage, queue, email, AI, and platform health across production services.",
    icon: HeartPulse,
    iconKey: "activity",
    responsibilities: ["Review component health checks", "Track degraded services and failures", "Monitor background jobs and external providers", "Surface operational alerts"],
    safeguards: ["Production incident actions are logged", "Provider credentials are never exposed", "Monitoring views are Super Admin only"]
  },
  {
    slug: "backups",
    href: "/super-admin/backups",
    label: "Backups",
    title: "Backup and Recovery",
    description: "Review backup jobs, recovery logs, export history, restore readiness, and disaster recovery procedures.",
    icon: DatabaseBackup,
    iconKey: "receipt",
    responsibilities: ["Review database, file, and configuration backup status", "Track failed backup jobs", "Document restore readiness", "Manage recovery evidence and exports"],
    safeguards: ["Restore workflows require confirmation and audit reason", "Backup exports are logged", "Production restore drills are controlled operations"]
  },
  {
    slug: "audit-logs",
    href: "/super-admin/audit-logs",
    label: "Audit Logs",
    title: "Audit and Activity Logs",
    description: "Search platform activity, role changes, settings updates, security events, and privileged actions.",
    icon: FileText,
    iconKey: "receipt",
    responsibilities: ["Review logins, role changes, payments, settings updates, and tenant events", "Export audit reports", "Track emergency override usage", "Support compliance investigations"],
    safeguards: ["Audit records are append-only by policy", "Exports are logged", "Sensitive member records require emergency override workflow"]
  },
  {
    slug: "feature-flags",
    href: "/super-admin/feature-flags",
    label: "Feature Flags",
    title: "Feature Flag Governance",
    description: "Control global, tenant-level, and branch-level feature rollout for SaaS plans and enterprise deployments.",
    icon: Flag,
    iconKey: "tags",
    responsibilities: ["Enable and disable platform features", "Control tenant and branch rollout", "Map features to SaaS plans", "Review active and staged flags"],
    safeguards: ["Flag changes are audited", "Plan-restricted features require validation", "Risky rollouts should use staged enablement"]
  }
] satisfies SuperAdminModule[];

export const superAdminNavItems = [
  { href: "/super-admin", label: "Dashboard", icon: Gauge, iconKey: "gauge" },
  { href: "/super-admin/approvals", label: "Approvals", icon: ShieldCheck, iconKey: "bell" },
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
