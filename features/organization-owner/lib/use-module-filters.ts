"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export function useModuleFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => ({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    role: searchParams.get("role") ?? undefined,
    gymId: searchParams.get("gymId") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
    pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : 12,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  }), [searchParams]);

  const navigate = useCallback((updates: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...updates };

    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== "all") {
        params.set(key, String(value));
      }
    });

    // Reset to page 1 when filters change (unless page is explicitly set)
    if (!("page" in updates)) {
      params.set("page", "1");
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, filters]);

  return { filters, navigate, currentPage: filters.page };
}
