import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { isSubscriptionManagementPath, isTenantPortalPath } from "@/lib/auth/post-login-routing";
import { clearTenantHeaders, writeTenantHeaders } from "@/lib/tenant/header-protocol";
import type { Database } from "@/types/database";
import { getRequiredSupabasePublicConfig, hasSupabasePublicEnv } from "./env";

const protectedPrefixes = ["/member", "/trainer", "/reception", "/admin", "/organization", "/super-admin"];
const authPrefixes = ["/login", "/register", "/forgot-password"];

type SubscriptionGateStatus = "suspended" | "cancelled";

type SubscriptionGateQuery = {
  select(columns: string): SubscriptionGateQuery;
  eq(column: "organization_id", value: string): SubscriptionGateQuery;
  in(column: "status", values: SubscriptionGateStatus[]): SubscriptionGateQuery;
  limit(count: number): SubscriptionGateQuery;
  maybeSingle(): Promise<{ data: { status: SubscriptionGateStatus } | null; error: { message: string } | null }>;
};

type SubscriptionGateClient = {
  from(table: "organization_subscriptions"): SubscriptionGateQuery;
};

export async function updateSession(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const pathname = request.nextUrl.pathname;
  const isSensitivePath = isProtectedPath(pathname) || isAuthPath(pathname) || pathname.startsWith("/api/");
  const upgradeInsecureRequests = isHttpsRequest(request);
  const contentSecurityPolicy = isSensitivePath
    ? buildSensitiveContentSecurityPolicy(nonce, upgradeInsecureRequests)
    : buildPublicContentSecurityPolicy(upgradeInsecureRequests);
  const requestHeaders = new Headers(request.headers);
  clearTenantHeaders(requestHeaders);
  if (isSensitivePath) {
    requestHeaders.set("x-nonce", nonce);
  }
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  let response = createMiddlewareResponse(requestHeaders, contentSecurityPolicy, isSensitivePath);
  let resolvedOrganizationId: string | null = null as string | null;

  if (!hasSupabasePublicEnv()) {
    if (isProtectedPath(pathname)) {
      return redirectToLogin(request, contentSecurityPolicy);
    }

    return response;
  }

  const { url, publishableKey } = getRequiredSupabasePublicConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        requestHeaders.set("cookie", request.cookies.toString());

        response = createMiddlewareResponse(requestHeaders, contentSecurityPolicy, isSensitivePath);

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  await applyTenantContextHeaders();

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub && !error);

  if (isProtectedPath(pathname) && !isAuthenticated) {
    return redirectToLogin(request, contentSecurityPolicy);
  }

  if (isAuthPath(pathname) && isAuthenticated && request.nextUrl.searchParams.get("error") !== "inactive") {
    const destination = sanitizeRedirectPath(request.nextUrl.searchParams.get("next"), "/member");
    return createSameOriginRedirect(request, destination, contentSecurityPolicy);
  }

  // Subscription status gate: hard-block tenant portals when organization subscription is
  // suspended or cancelled. Also handles direct SaaS login (non-tenant domains) by resolving
  // org from the authenticated user's profile.
  if (isAuthenticated && shouldApplySubscriptionStatusGate(pathname)) {
    let orgId = resolvedOrganizationId;
    const userId = data?.claims?.sub ?? null;

    // If tenant didn't resolve (direct SaaS login), try to get org from auth user profile claims
    if (!orgId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userId ?? "")
        .maybeSingle();
      orgId = ((profile as { organization_id: string } | null)?.organization_id as string | null) ?? null;
    }

    if (orgId) {
      const blockedStatus = await getHardBlockedSubscriptionStatus(supabase as unknown as SubscriptionGateClient, orgId);
      if (blockedStatus) {
        const isOwner = await isOrganizationOwnerForOrganization(supabase, orgId, userId);
        console.warn(`[subscription-gate] Blocked access for org ${orgId} on path ${pathname} (${blockedStatus})`);
        if (isOwner && blockedStatus === "cancelled") {
          return createSameOriginRedirect(request, "/organization/plan", contentSecurityPolicy);
        }
        return createSameOriginRedirect(request, `/unauthorized?reason=subscription_${blockedStatus}`, contentSecurityPolicy);
      }
    }
  }

  return response;

  async function applyTenantContextHeaders() {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

    if (!host) {
      return;
    }

    const { data: tenants, error: tenantError } = await supabase.rpc("resolve_tenant_by_host", { request_host: host });
    const tenant = tenants?.[0] ?? null;

    if (tenantError || !tenant?.organization_id || !tenant.domain) {
      return;
    }

    resolvedOrganizationId = tenant.organization_id;

    writeTenantHeaders(requestHeaders, {
      resolved: "true",
      organizationId: tenant.organization_id,
      organizationName: tenant.organization_name,
      branchId: tenant.branch_id,
      branchName: tenant.branch_name,
      branchCode: tenant.branch_code,
      gymId: tenant.gym_id,
      gymName: tenant.gym_name,
      tenantConfigId: tenant.tenant_config_id,
      tenantKey: tenant.tenant_key,
      domain: tenant.domain,
      domainType: tenant.domain_type,
      routingMode: tenant.routing_mode,
      planTier: tenant.plan_tier,
      brandName: tenant.brand_name,
      logoUrl: tenant.logo_url,
      faviconUrl: tenant.favicon_url,
      primaryColor: tenant.primary_color,
      secondaryColor: tenant.secondary_color,
      accentColor: tenant.accent_color,
      branchPhone: tenant.branch_phone,
      branchEmail: tenant.branch_email,
      branchAddress: tenant.branch_address,
      branchCity: tenant.branch_city,
      branchState: tenant.branch_state,
      branchCountry: tenant.branch_country,
      branchPostalCode: tenant.branch_postal_code,
      branchTimezone: tenant.branch_timezone,
      branchCurrency: tenant.branch_currency
    });

    response = createMiddlewareResponse(requestHeaders, contentSecurityPolicy, isSensitivePath);
  }
}

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPath(pathname: string) {
  return authPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function shouldApplySubscriptionStatusGate(pathname: string) {
  if (!isTenantPortalPath(pathname)) {
    return false;
  }

  return !isSubscriptionManagementPath(pathname);
}

async function getHardBlockedSubscriptionStatus(supabase: SubscriptionGateClient, organizationId: string): Promise<SubscriptionGateStatus | null> {
  try {
    const { data, error } = await supabase
      .from("organization_subscriptions")
      .select("status")
      .eq("organization_id", organizationId)
      .in("status", ["suspended", "cancelled"])
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Subscription status gate failed.", error);
      return null;
    }

    return data?.status === "suspended" || data?.status === "cancelled" ? data.status : null;
  } catch (error) {
    console.error("Subscription status gate failed.", error);
    return null;
  }
}

async function isOrganizationOwnerForOrganization(
  supabase: any,
  organizationId: string,
  userId: string | null,
) {
  if (!userId) return false;

  const [{ data: organization }, { data: branchUser }] = await Promise.all([
    supabase
      .from("organizations")
      .select("owner_user_id")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("branch_users")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("role_name", "organization_owner")
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  const ownerUserId = (organization as { owner_user_id?: string | null } | null)?.owner_user_id ?? null;
  const branchOwnerOrganizationId = (branchUser as { organization_id?: string | null } | null)?.organization_id ?? null;
  return ownerUserId === userId || branchOwnerOrganizationId === organizationId;
}

function redirectToLogin(request: NextRequest, contentSecurityPolicy: string) {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return createSameOriginRedirect(request, `/login?next=${encodeURIComponent(nextPath)}`, contentSecurityPolicy);
}

function createSameOriginRedirect(request: NextRequest, destination: string, contentSecurityPolicy: string) {
  const response = NextResponse.redirect(new URL(destination, getRedirectBaseUrl(request)));
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  applyNoStoreHeaders(response);
  return response;
}

function getRedirectBaseUrl(request: NextRequest) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;

  for (const candidate of [origin, referer]) {
    if (!candidate) {
      continue;
    }

    try {
      const candidateUrl = new URL(candidate);
      const isSameHost = candidateUrl.host === host;
      const isDevelopmentLoopback = process.env.NODE_ENV === "development"
        && isLoopbackHost(candidateUrl.hostname)
        && isLoopbackHost(host.split(":")[0] ?? "")
        && candidateUrl.port === (host.split(":")[1] ?? "");

      if (isSameHost || isDevelopmentLoopback) {
        return candidateUrl.origin;
      }
    } catch {
      // Fall back to the request host below.
    }
  }

  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isHttpsRequest(request: NextRequest) {
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return protocol === "https";
}

function createMiddlewareResponse(requestHeaders: Headers, contentSecurityPolicy: string, noStore = false) {
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  if (noStore) {
    applyNoStoreHeaders(response);
  }
  return response;
}

function applyNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
}

function baseContentSecurityPolicy(upgradeInsecureRequests: boolean) {
  const connectSource = process.env.NODE_ENV === "development"
    ? "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* ws: wss: https://*.supabase.co wss://*.supabase.co https://*.razorpay.com https://api.resend.com"
    : "connect-src 'self' ws: wss: https://*.supabase.co wss://*.supabase.co https://*.razorpay.com https://api.resend.com";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self' https://test.payu.in https://secure.payu.in",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
    "font-src 'self' data: https://fonts.gstatic.com",
    connectSource,
    "frame-src https://*.razorpay.com",
    "worker-src 'self' blob:"
  ];

  if (process.env.NODE_ENV === "production" && upgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }

  return directives;
}

function buildSensitiveContentSecurityPolicy(nonce: string, upgradeInsecureRequests: boolean) {
  const scriptSource = process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.razorpay.com"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.razorpay.com`;
  const styleSource = `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`;

  return [
    ...baseContentSecurityPolicy(upgradeInsecureRequests),
    scriptSource,
    styleSource,
    "style-src-attr 'unsafe-inline'"
  ].join("; ");
}

function buildPublicContentSecurityPolicy(upgradeInsecureRequests: boolean) {
  return [
    ...baseContentSecurityPolicy(upgradeInsecureRequests),
    "script-src 'self' 'unsafe-inline' https://*.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'"
  ].join("; ");
}
