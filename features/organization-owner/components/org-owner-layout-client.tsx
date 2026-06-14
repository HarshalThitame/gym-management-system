"use client";

import type { ReactNode } from "react";
import { RtlProvider, useRtl } from "@/features/organization-owner/lib/rtl-provider";
import { NotificationCenter } from "@/features/organization-owner/components/org-owner-notification-center";
import { useKeyboardShortcuts, ShortcutGuide } from "@/features/organization-owner/lib/use-keyboard-shortcuts";
import { LanguageSwitcher } from "@/features/organization-owner/components/language-switcher";
import { useTheme } from "@/features/organization-owner/lib/use-theme";
import { Sun, Moon, TextSelect } from "lucide-react";

type OrgOwnerLayoutClientProps = {
  organizationId: string;
  children: ReactNode;
};

function LayoutToolbar({ orgId }: { orgId: string }) {
  const { toggle, isDark } = useTheme();
  const { toggleDir, dir } = useRtl();

  return (
    <div className="fixed right-4 top-4 z-30 flex items-center gap-2 md:right-6 md:top-6">
      <LanguageSwitcher />
      <button
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={toggle}
        type="button"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </button>
      <button
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={toggleDir}
        type="button"
        aria-label={dir === "ltr" ? "Switch to RTL" : "Switch to LTR"}
      >
        <TextSelect className="size-5" />
      </button>
      <NotificationCenter organizationId={orgId} />
    </div>
  );
}

export function OrgOwnerLayoutClient({ organizationId, children }: OrgOwnerLayoutClientProps) {
  const { showGuide, setShowGuide, shortcuts } = useKeyboardShortcuts();

  return (
    <RtlProvider>
      <LayoutToolbar orgId={organizationId} />
      <ShortcutGuide open={showGuide} onClose={() => setShowGuide(false)} shortcuts={shortcuts} />
      {children}
    </RtlProvider>
  );
}
