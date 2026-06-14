"use client";

import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import type { DataCardProps } from "./org-owner-data-card";
import { DataCard } from "./org-owner-data-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export type BulkAction = {
  label: string;
  onClick: (selectedIds: string[]) => void;
  variant?: "primary" | "secondary" | "destructive";
  icon?: ReactNode;
  requiresReason?: boolean;
};

export type DataListProps = {
  items: DataCardProps[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  bulkActions?: BulkAction[];
  selectable?: boolean;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  headerTitle?: string;
  headerAction?: ReactNode;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  exportFileName?: string;
};

export function DataList({
  items, loading = false, emptyTitle, emptyDescription, emptyAction,
  bulkActions = [], selectable = false,
  currentPage = 1, totalPages = 1, totalItems = 0,
  onPageChange, pageSize = 12, onPageSizeChange,
  headerTitle, headerAction, onExportCSV, onExportPDF, exportFileName = "export"
}: DataListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
      setSelectAll(true);
    }
  }, [items, selectAll]);

  const handleBulkAction = useCallback((action: BulkAction) => {
    action.onClick(Array.from(selectedIds));
  }, []);

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-live="polite" aria-label="Loading data">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading data, please wait...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8" role="status" aria-live="polite">
        <EmptyState
          {...{
            action: emptyAction ? { label: emptyAction.label, onClick: emptyAction.onClick } : undefined,
            description: emptyDescription,
            title: emptyTitle,
            type: "no_data" as const
          } as Record<string, unknown>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(headerTitle || headerAction || selectedIds.size > 0 || bulkActions.length > 0 || onExportCSV || onExportPDF) ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {selectable && items.length > 0 ? (
              <input
                aria-label="Select all items"
                checked={selectAll}
                className="size-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                onChange={handleSelectAll}
                type="checkbox"
              />
            ) : null}

            {selectedIds.size > 0 ? (
              <p className="text-sm font-bold text-foreground" aria-live="polite" aria-atomic="true">
                {selectedIds.size} selected
              </p>
            ) : headerTitle ? (
              <p className="text-sm font-black uppercase tracking-[0.12em] text-muted-foreground" role="status" aria-live="polite">
                {headerTitle}
                {totalItems > 0 ? <span className="ml-2 font-normal normal-case">({from}&ndash;{to} of {totalItems})</span> : null}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.size > 0 ? (
              bulkActions.map((action) => (
                <button
                  key={action.label}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    action.variant === "destructive"
                      ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : action.variant === "primary"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-muted"
                  }`}
                  onClick={() => handleBulkAction(action)}
                  type="button"
                >
                  {action.icon ? <span className="size-3.5">{action.icon}</span> : null}
                  {action.label}
                </button>
              ))
            ) : null}

            {onExportCSV ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-border-strong hover:bg-surface-muted"
                onClick={onExportCSV}
                type="button"
              >
                <Download className="size-3.5" /> CSV
              </button>
            ) : null}
            {onExportPDF ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-border-strong hover:bg-surface-muted"
                onClick={onExportPDF}
                type="button"
              >
                <Download className="size-3.5" /> PDF
              </button>
            ) : null}

            {headerAction}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((item) => {
          const cardActions = item.actions ? item.actions.map((a) => ({
            label: a.label,
            onClick: a.onClick,
            icon: a.icon,
            variant: a.variant ?? ("secondary" as const),
            disabled: a.disabled ?? false
          })) : undefined;
          const cardSections = item.sections ? item.sections.map((s) => ({
            label: s.label,
            value: s.value,
            icon: s.icon
          })) : undefined;
          return (
            <DataCard
              key={item.id}
              id={item.id}
              title={item.title}
              subtitle={item.subtitle ?? undefined}
              meta={item.meta ?? undefined}
              badge={item.badge ?? undefined}
              badgeVariant={item.badgeVariant as "success" | "warning" | "error" | "neutral" | "info" | "premium" | undefined}
              status={item.status ?? undefined}
              selected={selectedIds.has(item.id)}
              onSelect={selectable ? handleSelect : undefined}
              actions={cardActions}
              sections={cardSections}
              avatar={(item as Record<string, unknown>).avatar as ReactNode | undefined}
            >
              {(item as Record<string, unknown>).children as ReactNode | undefined}
            </DataCard>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-center text-xs font-semibold text-muted-foreground md:text-sm md:text-left">
            Page {currentPage} of {totalPages}
            {totalItems > 0 ? <span className="ml-1">({totalItems} total)</span> : null}
          </p>

          <div className="flex items-center justify-center gap-2 md:justify-end">
            {onPageSizeChange ? (
              <select
                aria-label="Rows per page"
                className="h-10 rounded-md border border-border bg-background px-2 text-sm md:h-9"
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                value={pageSize}
              >
                {[12, 24, 50].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
            ) : null}

            <div className="flex gap-1">
              <button
                className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-all hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-30 md:min-h-0 md:px-3 md:py-1.5"
                disabled={currentPage <= 1}
                onClick={() => onPageChange?.(currentPage - 1)}
                type="button"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> <span className="md:inline">Previous</span>
              </button>
              <button
                className="inline-flex min-h-10 items-center gap-1 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-all hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-30 md:min-h-0 md:px-3 md:py-1.5"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange?.(currentPage + 1)}
                type="button"
                aria-label="Next page"
              >
                <span className="md:inline">Next</span> <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
