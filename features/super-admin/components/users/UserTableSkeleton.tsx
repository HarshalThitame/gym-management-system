"use client";

export function UserTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-11 rounded-md bg-surface-muted w-full" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
          >
            <div className="size-4 rounded bg-surface-muted" />
            <div className="h-4 w-32 rounded bg-surface-muted" />
            <div className="h-4 w-24 rounded bg-surface-muted" />
            <div className="h-4 w-20 rounded bg-surface-muted ml-auto" />
            <div className="flex gap-1.5">
              <div className="size-8 rounded bg-surface-muted" />
              <div className="size-8 rounded bg-surface-muted" />
              <div className="size-8 rounded bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-surface-muted" />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded bg-surface-muted" />
          <div className="h-9 w-20 rounded bg-surface-muted" />
        </div>
      </div>
    </div>
  );
}
