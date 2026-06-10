import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getRequiredSupabasePublicConfig, hasSupabasePublicEnv } from "./env";

const protectedPrefixes = ["/member", "/trainer", "/admin"];
const authPrefixes = ["/login", "/register", "/forgot-password"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (!hasSupabasePublicEnv()) {
    if (isProtectedPath(pathname)) {
      return redirectToLogin(request);
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

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub && !error);

  if (isProtectedPath(pathname) && !isAuthenticated) {
    return redirectToLogin(request);
  }

  if (isAuthPath(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/member", request.url));
  }

  return response;
}

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPath(pathname: string) {
  return authPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}
