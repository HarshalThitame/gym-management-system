import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getRequiredSupabasePublicConfig, hasSupabasePublicEnv } from "./env";

const protectedPrefixes = ["/member", "/trainer", "/admin"];
const authPrefixes = ["/login", "/register", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const pathname = request.nextUrl.pathname;
  const isSensitivePath = isProtectedPath(pathname) || isAuthPath(pathname) || pathname.startsWith("/api/");
  const contentSecurityPolicy = isSensitivePath ? buildSensitiveContentSecurityPolicy(nonce) : buildPublicContentSecurityPolicy();
  const requestHeaders = new Headers(request.headers);
  if (isSensitivePath) {
    requestHeaders.set("x-nonce", nonce);
  }
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  let response = createMiddlewareResponse(requestHeaders, contentSecurityPolicy);

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

        response = createMiddlewareResponse(requestHeaders, contentSecurityPolicy);

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub && !error);

  if (isProtectedPath(pathname) && !isAuthenticated) {
    return redirectToLogin(request, contentSecurityPolicy);
  }

  if (isAuthPath(pathname) && isAuthenticated) {
    const redirectResponse = NextResponse.redirect(new URL("/member", request.url));
    redirectResponse.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return redirectResponse;
  }

  return response;
}

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPath(pathname: string) {
  return authPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToLogin(request: NextRequest, contentSecurityPolicy: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(url);
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

function createMiddlewareResponse(requestHeaders: Headers, contentSecurityPolicy: string) {
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

function baseContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://checkout.razorpay.com https://api.resend.com",
    "frame-src https://api.razorpay.com https://checkout.razorpay.com",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests"
  ];
}

function buildSensitiveContentSecurityPolicy(nonce: string) {
  return [
    ...baseContentSecurityPolicy(),
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'"
  ].join("; ");
}

function buildPublicContentSecurityPolicy() {
  return [
    ...baseContentSecurityPolicy(),
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'"
  ].join("; ");
}
