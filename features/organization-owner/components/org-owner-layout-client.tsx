"use client";

import type { ReactNode } from "react";
import { RtlProvider } from "@/features/organization-owner/lib/rtl-provider";
import { NotificationCenter } from "@/features/organization-owner/components/org-owner-notification-center";
import { useKeyboardShortcuts, ShortcutGuide } from "@/features/organization-owner/lib/use-keyboard-shortcuts";
import { LanguageSwitcher } from "@/features/organization-owner/components/language-switcher";
import { ThemeToggleClient } from "@/features/organization-owner/components/theme-toggle-client";
import { RtlToggleClient } from "@/features/organization-owner/components/rtl-toggle-client";

type OrgOwnerLayoutClientProps = {
  organizationId: string;
  children: ReactNode;
};

function LayoutToolbar({ orgId }: { orgId: string }) {
  return (
    <div className="fixed right-4 top-4 z-30 flex items-center gap-2 md:right-6 md:top-6">
      <LanguageSwitcher />
      <ThemeToggleClient />
      <RtlToggleClient />
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
