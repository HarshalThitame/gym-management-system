"use client";

import { useCallback } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/features/organization-owner/lib/use-theme";

export function ThemeToggleClient() {
  const { toggle, isDark, mounted } = useTheme();

  const handleClick = useCallback(() => { toggle(); }, [toggle]);

  if (!mounted) {
    return (
      <button
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        type="button"
        aria-label="Toggle theme"
        disabled
      >
        <span className="size-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={handleClick}
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
    </button>
  );
}
