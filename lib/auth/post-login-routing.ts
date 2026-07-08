export const tenantPortalPrefixes = ["/member", "/trainer", "/reception", "/admin", "/organization"] as const;

export function isTenantPortalPath(pathname: string) {
  return tenantPortalPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isSubscriptionManagementPath(pathname: string) {
  return (
    pathname === "/member/plan" ||
    pathname.startsWith("/member/plan/") ||
    pathname === "/organization/plan" ||
    pathname.startsWith("/organization/plan/")
  );
}

export function resolvePostLoginPath(
  requestedNext: string | null | undefined,
  fallbackPath: string,
  options: {
    isOrganizationOwner: boolean;
    subscriptionStatus: "active" | "trial" | "expired" | "suspended" | "cancelled" | "none" | null;
  },
) {
  const nextPath = typeof requestedNext === "string" && requestedNext.length > 0 ? requestedNext : null;
  const isOwner = options.isOrganizationOwner;
  const status = options.subscriptionStatus;

  if (nextPath) {
    if (isTenantPortalPath(nextPath) && !isSubscriptionManagementPath(nextPath)) {
      if (isOwner && status === "cancelled") {
        return "/organization/plan";
      }
      if (isOwner && status === "suspended") {
        return "/unauthorized?reason=subscription_suspended";
      }
    }

    return nextPath;
  }

  if (isOwner) {
    if (status === "cancelled") {
      return "/organization/plan";
    }

    if (status === "suspended") {
      return "/unauthorized?reason=subscription_suspended";
    }
  }

  return fallbackPath;
}
