"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, ButtonLink } from "./button";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  baseHref?: string;
  pageParam?: string;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  totalItems?: number;
  onPageChange?: (page: number) => void;
};

export function Pagination({ currentPage, totalPages, baseHref = "#", pageParam = "page", pageSize, onPageSizeChange, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1 && !pageSize) return null;

  const pages: Array<number | "ellipsis"> = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        {onPageChange ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className={currentPage <= 1 ? "opacity-30" : ""}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {pages.map((p, i) =>
              p === "ellipsis" ? (
                <span key={`e-${i}`} className="flex size-10 items-center justify-center text-sm text-muted-foreground">&hellip;</span>
              ) : (
                <Button
                  key={p}
                  size="sm"
                  variant={p === currentPage ? "primary" : "ghost"}
                  onClick={() => onPageChange(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                  aria-label={`Page ${p}`}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className={currentPage >= totalPages ? "opacity-30" : ""}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <ButtonLink
              href={`${baseHref}?${pageParam}=${currentPage - 1}`}
              size="sm"
              variant="ghost"
              aria-disabled={currentPage <= 1}
              className={currentPage <= 1 ? "pointer-events-none opacity-30" : ""}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </ButtonLink>
            {pages.map((p, i) =>
              p === "ellipsis" ? (
                <span key={`e-${i}`} className="flex size-10 items-center justify-center text-sm text-muted-foreground">&hellip;</span>
              ) : (
                <ButtonLink
                  key={p}
                  href={`${baseHref}?${pageParam}=${p}`}
                  size="sm"
                  variant={p === currentPage ? "primary" : "ghost"}
                  aria-current={p === currentPage ? "page" : undefined}
                  aria-label={`Page ${p}`}
                >
                  {p}
                </ButtonLink>
              )
            )}
            <ButtonLink
              href={`${baseHref}?${pageParam}=${currentPage + 1}`}
              size="sm"
              variant="ghost"
              aria-disabled={currentPage >= totalPages}
              className={currentPage >= totalPages ? "pointer-events-none opacity-30" : ""}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </ButtonLink>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {totalItems !== undefined && <span>{totalItems} total</span>}
        {pageSize && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            aria-label="Page size"
          >
            {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s} per page</option>)}
          </select>
        )}
      </div>
    </nav>
  );
}
