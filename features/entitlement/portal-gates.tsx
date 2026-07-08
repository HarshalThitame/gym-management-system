import "server-only";

import { createElement } from "react";
import { Activity, AlertTriangle, BarChart3, Bell, Bot, Brain, BriefcaseBusiness, CalendarCheck, CalendarDays, Clock, CreditCard, Dumbbell, Gauge, Gift, Link2, ListChecks, MessageSquare, ReceiptText, RefreshCcw, Scale, Settings, Shield, Target, TrendingUp, UserRound, UserRoundPlus, UsersRound, Wrench, Zap } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import type { PortalNavItem } from "@/components/layout/portal-shell";
import type { FeatureKey } from "./feature-registry";
import { isFeatureKey } from "./feature-registry";
import { type EntitlementDeniedReason, EntitlementError, isEntitlementError } from "./entitlement-errors";
import { requireOrganizationFeatureAccess } from "./action-guards";

export type PortalKey = "organization-owner" | "gym-admin" | "reception" | "trainer" | "member";
export type PortalVisibilityMode = "visible_locked" | "hidden_if_locked" | "always_on";

type PortalGateDefinition = {
  href: string;
  label: string;
  icon: PortalNavItem["icon"];
  iconKey: PortalNavItem["iconKey"];
  featureKey?: FeatureKey;
  visibilityMode: PortalVisibilityMode;
  match?: "exact" | "prefix";
};

type PortalRouteGate = Pick<PortalGateDefinition, "href" | "featureKey" | "visibilityMode" | "match">;

function defineGate(definition: PortalGateDefinition): PortalGateDefinition {
  return definition;
}

function portalIcon(iconKey: PortalNavItem["iconKey"]) {
  switch (iconKey) {
    case "activity": return createElement(Activity, { className: "size-5" });
    case "alert-triangle": return createElement(AlertTriangle, { className: "size-5" });
    case "bar-chart": return createElement(BarChart3, { className: "size-5" });
    case "bell": return createElement(Bell, { className: "size-5" });
    case "bot": return createElement(Bot, { className: "size-5" });
    case "brain": return createElement(Brain, { className: "size-5" });
    case "briefcase": return createElement(BriefcaseBusiness, { className: "size-5" });
    case "calendar-check": return createElement(CalendarCheck, { className: "size-5" });
    case "calendar-days": return createElement(CalendarDays, { className: "size-5" });
    case "clock": return createElement(Clock, { className: "size-5" });
    case "credit-card": return createElement(CreditCard, { className: "size-5" });
    case "dumbbell": return createElement(Dumbbell, { className: "size-5" });
    case "flag": return createElement(ListChecks, { className: "size-5" });
    case "gauge": return createElement(Gauge, { className: "size-5" });
    case "gift": return createElement(Gift, { className: "size-5" });
    case "link": return createElement(Link2, { className: "size-5" });
    case "message-square": return createElement(MessageSquare, { className: "size-5" });
    case "receipt": return createElement(ReceiptText, { className: "size-5" });
    case "refresh-ccw": return createElement(RefreshCcw, { className: "size-5" });
    case "scale": return createElement(Scale, { className: "size-5" });
    case "settings": return createElement(Settings, { className: "size-5" });
    case "shield": return createElement(Shield, { className: "size-5" });
    case "shield-check": return createElement(Shield, { className: "size-5" });
    case "tags": return createElement(Target, { className: "size-5" });
    case "target": return createElement(Target, { className: "size-5" });
    case "trending-up": return createElement(TrendingUp, { className: "size-5" });
    case "user": return createElement(UserRound, { className: "size-5" });
    case "user-plus": return createElement(UserRoundPlus, { className: "size-5" });
    case "users": return createElement(UsersRound, { className: "size-5" });
    case "wrench": return createElement(Wrench, { className: "size-5" });
    case "zap": return createElement(Zap, { className: "size-5" });
    default: return createElement(Activity, { className: "size-5" });
  }
}

const adminPortalGates = [
  defineGate({ href: "/admin", label: "Dashboard", icon: portalIcon("gauge"), iconKey: "gauge", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/admin/members", label: "Members", icon: portalIcon("users"), iconKey: "users", featureKey: "member_management", visibilityMode: "hidden_if_locked", match: "prefix" }),
  defineGate({ href: "/admin/crm", label: "CRM & Leads", icon: portalIcon("target"), iconKey: "target", featureKey: "lead_management", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/attendance", label: "Attendance", icon: portalIcon("calendar-check"), iconKey: "calendar-check", featureKey: "attendance_reports", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/classes", label: "Classes", icon: portalIcon("calendar-days"), iconKey: "calendar-days", featureKey: "class_booking", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/fitness", label: "Fitness", icon: portalIcon("activity"), iconKey: "activity", featureKey: "goal_tracking", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/trainers", label: "Trainers", icon: portalIcon("dumbbell"), iconKey: "dumbbell", featureKey: "trainer_management", visibilityMode: "hidden_if_locked", match: "prefix" }),
  defineGate({ href: "/admin/equipment", label: "Equipment", icon: portalIcon("wrench"), iconKey: "wrench", featureKey: "equipment_inventory_maintenance", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/support", label: "Support", icon: portalIcon("shield"), iconKey: "shield", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/admin/promotions", label: "Promotions", icon: portalIcon("gift"), iconKey: "gift", featureKey: "discount_promo_codes", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/membership-plans", label: "Plans", icon: portalIcon("tags"), iconKey: "tags", featureKey: "member_management", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/renewals", label: "Renewals", icon: portalIcon("refresh-ccw"), iconKey: "refresh-ccw", featureKey: "membership_renewals", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/payments", label: "Payments", icon: portalIcon("credit-card"), iconKey: "credit-card", featureKey: "billing_invoices", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/payment-links", label: "Payment Links", icon: portalIcon("link"), iconKey: "link", featureKey: "online_payment_links", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/payment-failures", label: "Payment Failures", icon: portalIcon("alert-triangle"), iconKey: "alert-triangle", featureKey: "payment_failure_handling", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/payment-tracking", label: "Payment Tracking", icon: portalIcon("bar-chart"), iconKey: "bar-chart", featureKey: "payment_tracking", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/auto-billing", label: "Auto-Billing", icon: portalIcon("refresh-ccw"), iconKey: "refresh-ccw", featureKey: "auto_billing", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/payment-providers", label: "Payment Gateways", icon: portalIcon("shield"), iconKey: "shield", featureKey: "razorpay_payu_integration", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/corporate-accounts", label: "Corporate", icon: portalIcon("briefcase"), iconKey: "briefcase", featureKey: "corporate_bulk_memberships", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/partial-payments", label: "Partial Payments", icon: portalIcon("clock"), iconKey: "clock", featureKey: "partial_payment_dues", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/revenue-split", label: "Revenue Split", icon: portalIcon("trending-up"), iconKey: "trending-up", featureKey: "branch_revenue_split", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/tax-settings", label: "Tax Settings", icon: portalIcon("scale"), iconKey: "scale", featureKey: "multi_gstin_support", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/communications", label: "Communications", icon: portalIcon("message-square"), iconKey: "message-square", featureKey: "whatsapp_integration", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/sms", label: "SMS", icon: portalIcon("message-square"), iconKey: "message-square", featureKey: "sms_integration", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/integrations", label: "Integrations", icon: portalIcon("link"), iconKey: "link", featureKey: "rest_api_access", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/analytics", label: "Analytics", icon: portalIcon("bar-chart"), iconKey: "bar-chart", featureKey: "advanced_reports", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/automation/workflows", label: "Workflows", icon: portalIcon("wrench"), iconKey: "wrench", featureKey: "advanced_rbac", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/automation/triggers", label: "Automation", icon: portalIcon("zap"), iconKey: "zap", featureKey: "advanced_rbac", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/ai", label: "AI Intelligence", icon: portalIcon("brain"), iconKey: "brain", featureKey: "ai_recommendations", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/reports", label: "Reports", icon: portalIcon("bar-chart"), iconKey: "bar-chart", featureKey: "advanced_reports", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/audit", label: "Audit Trail", icon: portalIcon("shield"), iconKey: "shield", featureKey: "audit_logs", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/gdpr", label: "GDPR", icon: portalIcon("scale"), iconKey: "scale", featureKey: "audit_logs", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/security", label: "Security", icon: portalIcon("shield-check"), iconKey: "shield-check", featureKey: "audit_logs", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/feature-flags", label: "Feature Flags", icon: portalIcon("flag"), iconKey: "flag", featureKey: "advanced_rbac", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/staff", label: "Staff", icon: portalIcon("briefcase"), iconKey: "briefcase", featureKey: "staff_management", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/admin/settings", label: "Settings", icon: portalIcon("settings"), iconKey: "settings", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/admin/bulk-operations", label: "Bulk Operations", icon: portalIcon("users"), iconKey: "users", featureKey: "member_data_import_export", visibilityMode: "hidden_if_locked", match: "exact" }),
] as const;

const receptionPortalGates = [
  defineGate({ href: "/reception", label: "Dashboard", icon: portalIcon("gauge"), iconKey: "gauge", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/reception/members", label: "Members", icon: portalIcon("users"), iconKey: "users", featureKey: "member_management", visibilityMode: "hidden_if_locked", match: "prefix" }),
  defineGate({ href: "/reception/memberships", label: "Memberships", icon: portalIcon("activity"), iconKey: "activity", featureKey: "member_management", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/reception/register", label: "Register", icon: portalIcon("user-plus"), iconKey: "user-plus", featureKey: "member_management", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/reception/attendance", label: "Attendance", icon: portalIcon("calendar-check"), iconKey: "calendar-check", featureKey: "manual_attendance", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/reception/appointments", label: "Appointments", icon: portalIcon("clock"), iconKey: "clock", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/reception/leads", label: "Leads", icon: portalIcon("target"), iconKey: "target", featureKey: "lead_management", visibilityMode: "hidden_if_locked", match: "prefix" }),
  defineGate({ href: "/reception/tasks", label: "Tasks", icon: portalIcon("flag"), iconKey: "flag", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/reception/documents", label: "Documents", icon: portalIcon("briefcase"), iconKey: "briefcase", featureKey: "custom_member_fields", visibilityMode: "hidden_if_locked", match: "prefix" }),
  defineGate({ href: "/reception/payments", label: "Payments", icon: portalIcon("credit-card"), iconKey: "credit-card", featureKey: "billing_invoices", visibilityMode: "hidden_if_locked", match: "prefix" }),
  defineGate({ href: "/reception/classes", label: "Classes", icon: portalIcon("calendar-days"), iconKey: "calendar-days", featureKey: "class_booking", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/reception/messages", label: "Messages", icon: portalIcon("message-square"), iconKey: "message-square", featureKey: "whatsapp_integration", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/reception/reports", label: "Reports", icon: portalIcon("bar-chart"), iconKey: "bar-chart", featureKey: "basic_reports", visibilityMode: "hidden_if_locked", match: "prefix" }),
  defineGate({ href: "/reception/quick-actions", label: "Quick Actions", icon: portalIcon("zap"), iconKey: "zap", visibilityMode: "always_on", match: "exact" }),
] as const;

const trainerPortalGates = [
  defineGate({ href: "/trainer", label: "Dashboard", icon: portalIcon("gauge"), iconKey: "gauge", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/trainer/members", label: "Assigned Members", icon: portalIcon("users"), iconKey: "users", featureKey: "trainer_management", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/trainer/attendance", label: "Attendance", icon: portalIcon("calendar-check"), iconKey: "calendar-check", featureKey: "trainer_attendance", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/trainer/classes", label: "Classes", icon: portalIcon("calendar-days"), iconKey: "calendar-days", featureKey: "class_booking", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/trainer/sessions", label: "Sessions", icon: portalIcon("calendar-check"), iconKey: "calendar-check", featureKey: "pt_sessions", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/trainer/programs", label: "Programs", icon: portalIcon("dumbbell"), iconKey: "dumbbell", featureKey: "workout_assignment", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/trainer/progress", label: "Progress", icon: portalIcon("activity"), iconKey: "activity", featureKey: "goal_tracking", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/trainer/ai", label: "AI Assistant", icon: portalIcon("brain"), iconKey: "brain", featureKey: "ai_recommendations", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/trainer/availability", label: "Availability", icon: portalIcon("clock"), iconKey: "clock", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/trainer/performance", label: "Performance", icon: portalIcon("trending-up"), iconKey: "trending-up", featureKey: "trainer_performance_report", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/trainer/communications", label: "Communications", icon: portalIcon("message-square"), iconKey: "message-square", featureKey: "whatsapp_integration", visibilityMode: "hidden_if_locked", match: "exact" }),
] as const;

const memberPortalGates = [
  defineGate({ href: "/member", label: "Dashboard", icon: portalIcon("gauge"), iconKey: "gauge", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/member/membership", label: "Membership", icon: portalIcon("credit-card"), iconKey: "credit-card", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/member/payments", label: "Payments", icon: portalIcon("receipt"), iconKey: "receipt", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/member/billing", label: "Billing", icon: portalIcon("refresh-ccw"), iconKey: "refresh-ccw", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/member/payment-methods", label: "Payment Methods", icon: portalIcon("credit-card"), iconKey: "credit-card", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/member/attendance", label: "Attendance", icon: portalIcon("calendar-check"), iconKey: "calendar-check", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/member/classes", label: "Classes", icon: portalIcon("calendar-days"), iconKey: "calendar-days", featureKey: "class_booking", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/member/workouts", label: "Workouts", icon: portalIcon("dumbbell"), iconKey: "dumbbell", featureKey: "diet_workout_plans", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/member/fitness", label: "Fitness", icon: portalIcon("activity"), iconKey: "activity", featureKey: "goal_tracking", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/member/ai-coach", label: "AI Coach", icon: portalIcon("bot"), iconKey: "bot", featureKey: "ai_coach", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/member/notifications", label: "Notifications", icon: portalIcon("bell"), iconKey: "bell", featureKey: "in_app_push_notifications", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/member/referral", label: "Referral", icon: portalIcon("gift"), iconKey: "gift", featureKey: "referral_program", visibilityMode: "hidden_if_locked", match: "exact" }),
  defineGate({ href: "/member/profile", label: "Profile", icon: portalIcon("user"), iconKey: "user", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/member/settings", label: "Settings", icon: portalIcon("settings"), iconKey: "settings", visibilityMode: "always_on", match: "exact" }),
  defineGate({ href: "/member/survey", label: "Survey", icon: portalIcon("message-square"), iconKey: "message-square", visibilityMode: "always_on", match: "prefix" }),
] as const;

export const PORTAL_NAV_REGISTRY = {
  "gym-admin": adminPortalGates,
  reception: receptionPortalGates,
  trainer: trainerPortalGates,
  member: memberPortalGates,
} satisfies Record<Exclude<PortalKey, "organization-owner">, readonly PortalGateDefinition[]>;

export const PORTAL_ROUTE_REGISTRY = {
  "gym-admin": adminPortalGates,
  reception: receptionPortalGates,
  trainer: trainerPortalGates,
  member: memberPortalGates,
} satisfies Record<Exclude<PortalKey, "organization-owner">, readonly PortalRouteGate[]>;

function matchesRoute(pathname: string, gate: PortalRouteGate) {
  if (gate.match === "prefix") {
    return pathname === gate.href || pathname.startsWith(`${gate.href}/`);
  }
  return pathname === gate.href;
}

export function getPortalRouteGate(portal: Exclude<PortalKey, "organization-owner">, pathname: string) {
  const matches = PORTAL_ROUTE_REGISTRY[portal].filter((gate) => matchesRoute(pathname, gate));
  return matches.sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}

export function canAccessPortalHref(
  portal: Exclude<PortalKey, "organization-owner">,
  href: string,
  activeFeatureKeys: readonly FeatureKey[],
) {
  const gate = getPortalRouteGate(portal, href);
  if (!gate || gate.visibilityMode === "always_on" || !gate.featureKey) {
    return true;
  }
  return activeFeatureKeys.includes(gate.featureKey);
}

export function buildPortalNavFromEntitlements(
  portal: Exclude<PortalKey, "organization-owner">,
  activeFeatureKeys: readonly FeatureKey[],
): PortalNavItem[] {
  return PORTAL_NAV_REGISTRY[portal].flatMap((item) => {
    if (item.visibilityMode === "always_on" || !item.featureKey) {
      return [{ href: item.href, label: item.label, icon: item.icon, iconKey: item.iconKey }];
    }

    if (activeFeatureKeys.includes(item.featureKey)) {
      return [{ href: item.href, label: item.label, icon: item.icon, iconKey: item.iconKey }];
    }

    return [];
  });
}

export function denyHiddenFeatureRoute(mode: "redirect" | "not_found" = "redirect"): never {
  if (mode === "not_found") {
    notFound();
  }
  redirect("/unauthorized?reason=feature_unavailable");
}

export async function requirePortalFeatureAccess(input: {
  portal: PortalKey;
  organizationId: string;
  pathname: string;
  actionName: string;
}): Promise<void> {
  if (input.portal === "organization-owner") {
    return;
  }

  const routeGate = getPortalRouteGate(input.portal, input.pathname);
  if (!routeGate || routeGate.visibilityMode === "always_on" || !routeGate.featureKey) {
    return;
  }

  try {
    await requireOrganizationFeatureAccess({
      organizationId: input.organizationId,
      featureKey: routeGate.featureKey,
      actionName: input.actionName,
    });
  } catch (error) {
    if (isEntitlementError(error)) {
      if (routeGate.visibilityMode === "visible_locked") {
        const params = new URLSearchParams();
        if (error.featureKey) params.set("feature", error.featureKey);
        if (error.reason) params.set("reason", error.reason);
        redirect(`/organization/locked-feature?${params.toString()}`);
      }
      denyHiddenFeatureRoute();
    }
    throw error;
  }
}

export function getPortalRegistryFeatureKeys() {
  return Object.values(PORTAL_ROUTE_REGISTRY)
    .flat()
    .map((entry) => entry.featureKey)
    .filter((entry): entry is FeatureKey => Boolean(entry));
}

export function validatePortalRegistryFeatureKeys() {
  return getPortalRegistryFeatureKeys().every((featureKey) => isFeatureKey(featureKey));
}

export function mapHiddenFeatureApiDenial(reason: EntitlementDeniedReason, featureKey: FeatureKey | null) {
  return {
    status: reason === "ORGANIZATION_NOT_FOUND" ? 404 : 403,
    body: {
      error: "FEATURE_UNAVAILABLE",
      reason,
      featureKey,
      message: "The requested resource is not available for this role.",
    },
  };
}

export function isEntitlementDenialForHiddenMode(error: unknown): error is EntitlementError {
  return error instanceof EntitlementError;
}
