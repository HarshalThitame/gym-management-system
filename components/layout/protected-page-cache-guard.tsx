"use client";

import { useEffect } from "react";

export function ProtectedPageCacheGuard() {
  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!cancelled && response.status === 401) {
          window.location.replace("/login");
        }
      } catch {
        // Keep the current view during transient network failures.
      }
    };

    const handlePageShow = () => {
      void verifySession();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handlePageShow);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handlePageShow);
    };
  }, []);

  return null;
}
