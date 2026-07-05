"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MemberRow } from "@/types/membership";

type SearchResult = Pick<MemberRow, "id" | "full_name" | "member_code" | "phone" | "email" | "photo_url" | "gender" | "last_attendance_date" | "is_currently_in_gym">;

type AttendanceSearchProps = {
  onSelect: (member: SearchResult) => void;
  gymId: string | null;
  placeholder?: string;
  autoFocus?: boolean;
};

export function AttendanceSearch({ onSelect, gymId, placeholder = "Search members by name, phone, email, or ID...", autoFocus = false }: AttendanceSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: "20" });
      if (gymId) params.set("gym_id", gymId);
      const res = await fetch(`/api/members/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.members ?? data ?? []);
      setOpen(true);
      setSelectedIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const selectMember = useCallback((member: SearchResult) => {
    onSelect(member);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  }, [onSelect]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      selectMember(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          className="pl-9 pr-9"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          value={query}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        {!loading && query && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setQuery(""); setResults([]); setOpen(false); }} type="button">
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-xl"
          ref={listRef}
          role="listbox"
        >
          {results.map((member, i) => (
            <button
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-muted ${i === selectedIndex ? "bg-surface-muted" : ""}`}
              key={member.id}
              onClick={() => selectMember(member)}
              onMouseEnter={() => setSelectedIndex(i)}
              role="option"
              aria-selected={i === selectedIndex}
              type="button"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                {member.photo_url ? (
                  <img alt="" className="size-10 rounded-full object-cover" src={member.photo_url} />
                ) : (
                  <User className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold">{member.full_name}</p>
                  {member.is_currently_in_gym && (
                    <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                      Inside
                    </span>
                  )}
                </div>
                <p className="truncate text-xs font-semibold text-muted-foreground">
                  {member.member_code} · {member.phone}
                  {member.last_attendance_date ? ` · Last: ${new Date(member.last_attendance_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface p-4 text-center text-sm font-semibold text-muted-foreground shadow-xl">
          No members found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
