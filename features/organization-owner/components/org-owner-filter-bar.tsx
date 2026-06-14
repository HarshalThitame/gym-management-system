"use client";

import { Search, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

export type FilterOption<T extends string = string> = {
  value: T;
  label: string;
};

export type FilterGroup = {
  key: string;
  label: string;
  options: FilterOption[];
  defaultValue?: string;
};

export type FilterBarProps = {
  searchPlaceholder?: string;
  filterGroups?: FilterGroup[];
  sortOptions?: FilterOption[];
  pageSizeOptions?: number[];
  onApply: (filters: Record<string, string>) => void;
  onReset?: () => void;
  activeFilters?: Record<string, string>;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function FilterBar({ searchPlaceholder = "Search...", filterGroups = [], sortOptions = [], pageSizeOptions = [12, 24, 50], onApply, onReset, activeFilters = {} }: FilterBarProps) {
  const [query, setQuery] = useState(activeFilters.q ?? "");
  const [filters, setFilters] = useState<Record<string, string>>(activeFilters);

  const handleApply = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onApply({ ...filters, q: query });
  }, [filters, onApply, query]);

  const handleReset = useCallback(() => {
    setQuery("");
    setFilters({});
    onReset?.();
  }, [onReset]);

  const activeCount = Object.entries({ ...filters, q: query }).filter(([, v]) => v && v !== "all").length;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 md:p-5" role="search" aria-label="Filter and search">
      <form className="flex flex-col gap-3 md:flex-row xl:grid xl:grid-cols-[1fr_auto]" onSubmit={handleApply}>
        <div className="relative flex-1">
          <label htmlFor="org-filter-search" className="sr-only">Search</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="org-filter-search"
            className="h-12 w-full rounded-lg border border-border bg-background pl-10 pr-10 text-base font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:h-11 md:text-sm"
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            type="text"
            value={query}
          />
          {query ? (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={() => setQuery("")}
              type="button"
              aria-label="Clear search"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {filterGroups.map((group) => (
            <select
              key={group.key}
              aria-label={`Filter by ${group.label}`}
              className="h-12 w-full min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:h-11 md:w-auto md:min-w-[140px] md:flex-none"
              onChange={(e) => setFilters((prev) => ({ ...prev, [group.key]: e.target.value }))}
              value={filters[group.key] ?? group.defaultValue ?? "all"}
            >
              <option value="all">All {group.label.toLowerCase()}</option>
              {group.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ))}

          {sortOptions.length > 0 ? (
            <select
              aria-label="Sort by"
              className="h-12 w-full min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:h-11 md:w-auto md:min-w-[140px] md:flex-none"
              onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
              value={filters.sort ?? sortOptions[0]?.value ?? "created_desc"}
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : null}

          {pageSizeOptions.length > 0 ? (
            <select
              aria-label="Rows per page"
              className="h-12 w-full min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:h-11 md:w-auto md:min-w-[100px] md:flex-none"
              onChange={(e) => setFilters((prev) => ({ ...prev, pageSize: e.target.value }))}
              value={filters.pageSize ?? String(pageSizeOptions[0])}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
          ) : null}

          <Button className="h-12 md:h-11" size="sm" type="submit" variant="primary">Apply</Button>
          {activeCount > 0 ? (
            <Button className="h-12 md:h-11" onClick={handleReset} size="sm" type="button" variant="ghost">Reset</Button>
          ) : null}
        </div>
      </form>

      {activeCount > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries({ ...filters, q: query }).filter(([, v]) => v && v !== "all").map(([key, value]) => (
            <EnterpriseStatusBadge key={key} status={`${formatEnterpriseLabel(key)}: ${value}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
