"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "@/features/organization-owner/lib/use-theme";

export function ThemeToggleClient() {
  const { toggle, isDark } = useTheme();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;
    btn.removeAttribute("disabled");
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
    const span = btn.querySelector("span");
    if (span) {
      const isDarkVal = isDark;
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", "lucide size-5");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("viewBox", "0 0 24 24");
      if (isDarkVal) {
        svg.setAttribute("fill", "currentColor");
        svg.innerHTML =
          '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      } else {
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.innerHTML =
          '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
      }
      span.replaceWith(svg);
    }
  }, [isDark]);

  const handleClick = useCallback(() => { toggle(); }, [toggle]);

  return (
    <button
      ref={ref}
      className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={handleClick}
      type="button"
      aria-label="Toggle theme"
      disabled
    >
      <span className="size-5" aria-hidden="true" />
    </button>
  );
}
