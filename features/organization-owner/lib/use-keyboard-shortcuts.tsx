"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";

type ShortcutMap = Record<string, string>;

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [showGuide, setShowGuide] = useState(false);

  const shortcuts: ShortcutMap = {
    "g+h": "/organization",
    "g+g": "/organization/branches",
    "g+m": "/organization/members",
    "g+s": "/organization/staff",
    "g+p": "/organization/memberships",
    "g+r": "/organization/revenue",
    "g+t": "/organization/trainers",
    "g+a": "/organization/attendance",
    "g+c": "/organization/classes",
    "g+o": "/organization/communications",
    "g+n": "/organization/analytics",
    "g+b": "/organization/branding",
    "g+d": "/organization/domains",
    "g+i": "/organization/billing",
    "g+e": "/organization/settings",
    "g+u": "/organization/security",
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+K -> command palette (placeholder for now)
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setShowGuide((prev) => !prev);
      return;
    }

    // ? -> show shortcut guide
    if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
      e.preventDefault();
      setShowGuide((prev) => !prev);
      return;
    }

    // g+<key> navigation
    if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const handle = (e2: KeyboardEvent) => {
        window.removeEventListener("keydown", handle);
        const combo = `g+${e2.key}`;
        const route = shortcuts[combo];
        if (route) {
          e2.preventDefault();
          router.push(route);
        }
      };
      window.addEventListener("keydown", handle);
    }
  }, [router, shortcuts]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const toggleGuide = useCallback(() => setShowGuide((p) => !p), []);

  return { showGuide, setShowGuide, toggleGuide, shortcuts };
}

export function ShortcutGuide({ open, onClose, shortcuts }: { open: boolean; onClose: () => void; shortcuts: ShortcutMap }) {
  const shortcutList = [
    { keys: "Ctrl+K", action: "Toggle shortcut guide" },
    { keys: "?", action: "Toggle shortcut guide" },
    { keys: "g + d", action: "Dashboard" },
    { keys: "g + g", action: "Branches" },
    { keys: "g + m", action: "Members" },
    { keys: "g + s", action: "Staff" },
    { keys: "g + p", action: "Memberships" },
    { keys: "g + r", action: "Revenue" },
    { keys: "g + t", action: "Trainers" },
    { keys: "g + a", action: "Attendance" },
    { keys: "g + c", action: "Classes" },
    { keys: "g + o", action: "Communications" },
    { keys: "g + n", action: "Analytics" },
    { keys: "g + b", action: "Branding" },
    { keys: "g + i", action: "Billing" },
    { keys: "g + e", action: "Settings" },
    { keys: "g + u", action: "Security" },
    { keys: "Escape", action: "Close drawer / modal" },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black">Keyboard Shortcuts</h2>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close">✕</button>
        </div>
        <div className="space-y-1">
          {shortcutList.map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-surface-muted">
              <span className="text-sm font-semibold text-muted-foreground">{action}</span>
              <kbd className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-bold font-mono">{keys}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Press <kbd className="rounded border border-border bg-background px-1 text-xs font-mono">Ctrl+K</kbd> or <kbd className="rounded border border-border bg-background px-1 text-xs font-mono">?</kbd> anytime to toggle this guide.</p>
      </div>
    </div>
  );
}
