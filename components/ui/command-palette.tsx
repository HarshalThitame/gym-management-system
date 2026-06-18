"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { modKey } from "@/features/ux/hooks/use-keyboard-shortcuts";

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  category: string;
  shortcut?: string;
  onSelect: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  items?: CommandItem[];
};

export function CommandPalette({ open, onClose, items = [] }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) { onClose(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase()) ||
    i.description?.toLowerCase().includes(query.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="size-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60"
            aria-label="Search commands"
          />
          <kbd className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {query.length === 0 && (
            <div className="mb-2 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Quick Actions</div>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => { item.onSelect(); onClose(); }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/10"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{item.label}</span>
                {item.description && <span className="text-xs text-muted-foreground">{item.description}</span>}
              </div>
              {item.shortcut && <kbd className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">{item.shortcut}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && query.length > 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No commands found</div>
          )}
          <div className="mt-2 border-t border-border px-3 pt-2 text-xs text-muted-foreground">
            Tip: Press {modKey}+K to open command palette, {modKey}+/ for shortcuts
          </div>
        </div>
      </div>
    </div>
  );
}
