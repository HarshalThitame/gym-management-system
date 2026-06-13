"use client";

import { useCallback, useEffect, useState } from "react";

type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
  category: "navigation" | "actions" | "search" | "editing";
};

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const modMatch = shortcut.ctrl || shortcut.meta;
        const ctrlOrMeta = modMatch ? (isMac ? e.metaKey : e.ctrlKey) : true;
        if (
          ctrlOrMeta &&
          (!shortcut.shift || e.shiftKey) &&
          (!shortcut.alt || e.altKey) &&
          e.key.toLowerCase() === shortcut.key.toLowerCase()
        ) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.handler();
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return { open, setOpen, query, setQuery, toggle };
}

export { modKey };
export type { Shortcut };

export const GLOBAL_SHORTCUTS: Array<{ key: string; ctrl: boolean; description: string; category: string }> = [
  { key: "k", ctrl: true, description: "Open command palette", category: "search" },
  { key: "/", ctrl: true, description: "Show shortcut guide", category: "search" },
  { key: "s", ctrl: true, description: "Save current form", category: "actions" },
  { key: "Escape", ctrl: false, description: "Close dialog / cancel", category: "navigation" },
  { key: "1", ctrl: true, description: "Go to Dashboard", category: "navigation" },
  { key: "2", ctrl: true, description: "Go to Members", category: "navigation" },
  { key: "3", ctrl: true, description: "Go to Analytics", category: "navigation" },
];
