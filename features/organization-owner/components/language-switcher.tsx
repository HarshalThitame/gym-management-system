"use client";

import { useCallback, useState } from "react";
import { Languages } from "lucide-react";
import { locales, localeNames, type Locale } from "@/features/organization-owner/lib/i18n/translations";

export function LanguageSwitcher() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    return (localStorage.getItem("org-owner-locale") as Locale) || "en";
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("org-owner-locale", l);
    window.location.reload();
  }, []);

  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={() => setOpen(!open)}
        type="button"
        aria-label="Switch language"
      >
        <Languages className="size-5" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-lg border border-border bg-surface p-2 shadow-premium">
          {locales.map((l) => (
            <button
              key={l}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${locale === l ? "bg-primary/10 text-primary" : "text-foreground hover:bg-surface-muted"}`}
              onClick={() => { setLocale(l); setOpen(false); }}
              type="button"
            >
              {localeNames[l]}
              {locale === l ? <span className="ml-auto text-xs">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
