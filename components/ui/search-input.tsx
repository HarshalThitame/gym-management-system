"use client";

import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  onClear?: () => void;
  className?: string;
};

export function SearchInput({ value, onChange, placeholder = "Search...", debounceMs = 300, autoFocus = false, onClear, className = "" }: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(localValue), debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [localValue, debounceMs, onChange]);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleClear = useCallback(() => {
    setLocalValue("");
    onChange("");
    if (onClear) onClear();
    inputRef.current?.focus();
  }, [onChange, onClear]);

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-10 text-sm font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label={placeholder}
      />
      {localValue && (
        <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
