export function ChartSkeleton({ className = "h-72" }: { className?: string }) {
  return (
    <div className={`${className} w-full rounded-md border border-border bg-surface-muted p-4`}>
      <div className="h-full w-full animate-pulse rounded bg-border/60" />
    </div>
  );
}
