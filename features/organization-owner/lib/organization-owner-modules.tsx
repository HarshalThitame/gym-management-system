import {
  Apple,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Dumbbell,
  Gauge,
  Globe2,
  LifeBuoy,
  MessageSquare,
  Palette,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tags,
  UserRound,
  UsersRound
} from "lucide-react";
import type { ReactNode } from "react";
import type { PortalNavItem } from "@/components/layout/portal-shell";

import type { FeatureFlagKey } from "@/lib/tenant/feature-flags";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";

export type OrganizationOwnerModule = {
  slug: string;
  href: string;
  label: string;
  title: string;
  description: string;
  icon: ReactNode;
  iconKey: PortalNavItem["iconKey"];
  featureKey?: FeatureFlagKey;
};

export const organizationOwnerModules = [
  {
    slug: "branches",
    href: "/organization/branches",
    label: "Branches",
    title: "Branch and Location Operations",
    description: "View every branch and location inside your organization with status, capacity, staff assignments, and performance metrics.",
    icon: <Building2 className="size-5" />,
    iconKey: "briefcase",
    featureKey: "multiBranchManagement" as FeatureFlagKey,
  },
  {
    slug: "staff",
    href: "/organization/staff",
    label: "Staff",
    title: "Staff and Access",
    description: "Review branch user assignments, roles, access scope, and account status across your organization.",
    icon: <UsersRound className="size-5" />,
    iconKey: "users",
    featureKey: "staffManagement" as FeatureFlagKey,
  },
  {
    slug: "members",
    href: "/organization/members",
    label: "Members",
    title: "Members",
    description: "Monitor member volume, active members, branch distribution, and membership growth for owned gyms.",
    icon: <UsersRound className="size-5" />,
    iconKey: "users",
    featureKey: "memberManagement" as FeatureFlagKey,
  },
  {
    slug: "memberships",
    href: "/organization/memberships",
    label: "Memberships",
    title: "Memberships",
    description: "Review membership plans, status mix, renewals, and plan performance across the organization.",
    icon: <Tags className="size-5" />,
    iconKey: "tags",
    featureKey: "memberManagement" as FeatureFlagKey,
  },
  {
    slug: "revenue",
    href: "/organization/revenue",
    label: "Revenue",
    title: "Revenue Management",
    description: "Track payments, branch revenue, payment status, and financial performance for your organization.",
    icon: <CreditCard className="size-5" />,
    iconKey: "credit-card",
    featureKey: "paymentTracking" as FeatureFlagKey,
  },
  {
    slug: "trainers",
    href: "/organization/trainers",
    label: "Trainers",
    title: "Trainer Management",
    description: "Review trainers, status, branch coverage, and trainer utilization across owned gyms.",
    icon: <Dumbbell className="size-5" />,
    iconKey: "dumbbell",
    featureKey: "trainerManagement" as FeatureFlagKey,
  },
  {
    slug: "attendance",
    href: "/organization/attendance",
    label: "Attendance",
    title: "Attendance",
    description: "Monitor attendance logs, branch usage, peak activity signals, and access-control incidents.",
    icon: <CalendarCheck className="size-5" />,
    iconKey: "calendar-check",
    featureKey: "manualAttendance" as FeatureFlagKey,
  },
  {
    slug: "classes",
    href: "/organization/classes",
    label: "Classes",
    title: "Classes and Scheduling",
    description: "Track class sessions, booking volume, waitlists, cancellations, and class utilization.",
    icon: <CalendarDays className="size-5" />,
    iconKey: "calendar-days",
    featureKey: "classBooking" as FeatureFlagKey,
  },
  {
    slug: "communications",
    href: "/organization/communications",
    label: "Communications",
    title: "Communications",
    description: "Review notifications, campaigns, communication volume, and engagement signals across branches.",
    icon: <MessageSquare className="size-5" />,
    iconKey: "message-square",
    featureKey: "whatsappIntegration" as FeatureFlagKey,
  },
  {
    slug: "analytics",
    href: "/organization/analytics",
    label: "Analytics",
    title: "Organization Analytics",
    description: "View branch performance, tenant usage, revenue trends, and operational KPIs for your organization only.",
    icon: <BarChart3 className="size-5" />,
    iconKey: "bar-chart",
    featureKey: "basicReports" as FeatureFlagKey,
  },
  {
    slug: "branding",
    href: "/organization/branding",
    label: "Branding",
    title: "Branding and White Label",
    description: "Review tenant brand profiles, colors, domains, and white-label readiness for your organization.",
    icon: <Palette className="size-5" />,
    iconKey: "settings",
    featureKey: "customBranding" as FeatureFlagKey,
  },
  {
    slug: "domains",
    href: "/organization/domains",
    label: "Domains",
    title: "Domains",
    description: "Monitor custom domains, routing mode, DNS status, TLS status, and primary domain configuration.",
    icon: <Globe2 className="size-5" />,
    iconKey: "settings",
    featureKey: "customDomainEnabled" as FeatureFlagKey,
  },
  {
    slug: "billing",
    href: "/organization/billing",
    label: "Billing",
    title: "SaaS Billing",
    description: "Review your SaaS plan, usage limits, renewal status, billing state, and subscription capacity.",
    icon: <ReceiptText className="size-5" />,
    iconKey: "receipt",
  },
  {
    slug: "nutrition",
    href: "/organization/nutrition",
    label: "Nutrition",
    title: "Nutrition Management",
    description: "Manage nutrition templates, meal plans, and view compliance reports across your organization.",
    icon: <Apple className="size-5" />,
    iconKey: "settings",
    featureKey: "nutritionPlans" as FeatureFlagKey,
  },
  {
    slug: "support",
    href: "/organization/support",
    label: "Support",
    title: "Support Center",
    description: "Create and track support tickets, escalate issues, and access documentation for your organization.",
    icon: <LifeBuoy className="size-5" />,
    iconKey: "message-square",
  },
  {
    slug: "profile",
    href: "/organization/profile",
    label: "Org Profile",
    title: "Organization Profile",
    description: "Manage your organization's name, branding, contact information, GST details, and business info.",
    icon: <UserRound className="size-5" />,
    iconKey: "users",
  },
  {
    slug: "settings",
    href: "/organization/settings",
    label: "Settings",
    title: "Organization Settings",
    description: "Review branch settings, feature flags, compliance defaults, and governance controls in organization scope.",
    icon: <Settings className="size-5" />,
    iconKey: "settings",
  },
  {
    slug: "security",
    href: "/organization/security",
    label: "Security",
    title: "Security and Audit",
    description: "Review security events, activity logs, compliance requests, and audit records for your organization.",
    icon: <ShieldCheck className="size-5" />,
    iconKey: "bell",
  }
] satisfies OrganizationOwnerModule[];

export const organizationOwnerNavItems = [
  { href: "/organization", label: "Dashboard", icon: <Gauge className="size-5" />, iconKey: "gauge" },
  { href: "/organization/plan", label: "Plan", icon: <ReceiptText className="size-5" />, iconKey: "receipt" },
  ...organizationOwnerModules.map((module) => ({
    href: module.href,
    label: module.label,
    icon: module.icon,
    iconKey: module.iconKey
  }))
] satisfies PortalNavItem[];

export function buildEntitlementFilteredNavItems(planContext: OrgPlanContext): PortalNavItem[] {
  const features = planContext.features;
  const dashItem = { href: "/organization", label: "Dashboard", icon: <Gauge className="size-5" />, iconKey: "gauge" } as PortalNavItem;
  const planItem = { href: "/organization/plan", label: "Plan", icon: <ReceiptText className="size-5" />, iconKey: "receipt" } as PortalNavItem;

  const moduleItems = organizationOwnerModules.map((mod) => {
    if (!mod.featureKey) {
      return { href: mod.href, label: mod.label, icon: mod.icon, iconKey: mod.iconKey } as PortalNavItem;
    }
    const hasFeature = (features as Record<string, unknown>)[mod.featureKey] === true;
    if (hasFeature) {
      return { href: mod.href, label: mod.label, icon: mod.icon, iconKey: mod.iconKey } as PortalNavItem;
    }
    return {
      href: mod.href,
      label: mod.label,
      icon: mod.icon,
      iconKey: mod.iconKey,
      locked: true,
      lockedReason: `Not included in your ${planContext.packageName || "current"} plan.`,
    } as PortalNavItem;
  });

  return [dashItem, planItem, ...moduleItems];
}

export function getOrganizationOwnerModule(slug: string) {
  if (slug === "gyms") slug = "branches";
  return organizationOwnerModules.find((module) => module.slug === slug) ?? null;
}
