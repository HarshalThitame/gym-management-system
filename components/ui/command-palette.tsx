"use client";

import { Search, Users, CalendarCheck, CalendarDays, CreditCard, Dumbbell, Target, MessageSquare, Settings, Zap, FileText, TrendingUp, LifeBuoy, Gift } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { modKey } from "@/features/ux/hooks/use-keyboard-shortcuts";
import { motion, AnimatePresence } from "framer-motion";

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon?: React.ReactNode;
  shortcut?: string;
  href?: string;
  onSelect: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  items?: CommandItem[];
};

const categoryIcons: Record<string, React.ReactNode> = {
  Navigation: <Zap className="size-4" />,
  Members: <Users className="size-4" />,
  Attendance: <CalendarCheck className="size-4" />,
  Classes: <CalendarDays className="size-4" />,
  Payments: <CreditCard className="size-4" />,
  Trainers: <Dumbbell className="size-4" />,
  Fitness: <Target className="size-4" />,
  Communications: <MessageSquare className="size-4" />,
  Reports: <TrendingUp className="size-4" />,
  Settings: <Settings className="size-4" />,
  CRM: <Users className="size-4" />,
  Equipment: <Dumbbell className="size-4" />,
  Support: <LifeBuoy className="size-4" />,
  Promotions: <Gift className="size-4" />,
  Actions: <FileText className="size-4" />,
};

const categoryColors: Record<string, string> = {
  Navigation: "from-accent to-purple-600",
  Members: "from-blue-500 to-cyan-500",
  Attendance: "from-green-500 to-emerald-500",
  Classes: "from-orange-500 to-amber-500",
  Payments: "from-green-600 to-teal-600",
  Trainers: "from-purple-500 to-pink-500",
  Fitness: "from-red-500 to-rose-500",
  Communications: "from-cyan-500 to-blue-500",
  Reports: "from-indigo-500 to-violet-500",
  Settings: "from-gray-500 to-slate-500",
  CRM: "from-blue-600 to-indigo-600",
  Equipment: "from-amber-600 to-orange-600",
  Support: "from-teal-500 to-cyan-500",
  Promotions: "from-pink-500 to-rose-500",
  Actions: "from-violet-500 to-purple-500",
};

export function CommandPalette({ open, onClose, items = [] }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].onSelect();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, selectedIndex, query]);

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase()) ||
    i.description?.toLowerCase().includes(query.toLowerCase()) ||
    i.category.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-2xl rounded-2xl glass border border-accent/20 shadow-premium-lg overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border/50 px-5 py-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-purple-600 shadow-glow-sm">
                <Search className="size-5 text-white" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                placeholder="Search members, trainers, classes, payments, actions..."
                className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground/60"
                aria-label="Search commands"
              />
              <kbd className="rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">Esc</kbd>
            </div>
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-3 space-y-3">
              {Object.entries(grouped).map(([category, categoryItems]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className={`p-1 rounded-md bg-gradient-to-br ${categoryColors[category] ?? "from-gray-500 to-slate-500"}`}>
                      {categoryIcons[category] ?? <Zap className="size-3 text-white" />}
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{category}</span>
                    <span className="text-xs text-muted-foreground/60">({categoryItems.length})</span>
                  </div>
                  {categoryItems.map((item) => {
                    const globalIndex = filtered.indexOf(item);
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { item.onSelect(); onClose(); }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                          isSelected
                            ? "bg-gradient-to-r from-accent/10 to-purple-600/10 shadow-glow-sm scale-[1.01]"
                            : "hover:bg-surface-muted/80"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.icon ? (
                            <div className={`p-1.5 rounded-lg ${isSelected ? "bg-accent/20" : "bg-surface-muted"}`}>
                              {item.icon}
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            <span className="font-bold text-sm block truncate">{item.label}</span>
                            {item.description && (
                              <span className="text-xs text-muted-foreground block truncate">{item.description}</span>
                            )}
                          </div>
                        </div>
                        {item.shortcut && (
                          <kbd className="shrink-0 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-bold text-muted-foreground">{item.shortcut}</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              {filtered.length === 0 && query.length > 0 && (
                <div className="px-3 py-8 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-sm font-bold text-muted-foreground">No results for &quot;{query}&quot;</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try searching for members, trainers, or actions</p>
                </div>
              )}
              {filtered.length === 0 && query.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Start typing to search across your entire gym management system
                </div>
              )}
            </div>
            <div className="border-t border-border/50 px-5 py-3 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold">↑↓</kbd> Navigate</span>
                <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold">↵</kbd> Select</span>
                <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold">Esc</kbd> Close</span>
              </div>
              <span>{modKey}+K to toggle</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
