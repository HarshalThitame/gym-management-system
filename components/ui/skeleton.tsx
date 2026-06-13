import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
  variant?: "text" | "circle" | "card" | "chart" | "table";
};

export function Skeleton({ className, variant = "text" }: SkeletonProps) {
  const base = "animate-pulse rounded-md bg-border/60";

  const variants: Record<string, string> = {
    text: "h-4 w-full",
    circle: "size-10 rounded-full",
    card: "h-32 w-full rounded-xl",
    chart: "h-72 w-full rounded-xl",
    table: "h-8 w-full"
  };

  return <div className={cn(base, variants[variant], className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96" /></div>
        <Skeleton className="h-11 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-4"><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /><Skeleton variant="card" /></div>
      <Skeleton variant="chart" />
      <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} variant="table" />)}</div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">{[...Array(columns)].map((_, i) => <Skeleton key={i} className="h-8 flex-1" />)}</div>
      {[...Array(rows)].map((_, r) => (
        <div key={r} className="flex gap-4">{[...Array(columns)].map((_, c) => <Skeleton key={c} className="h-6 flex-1" />)}</div>
      ))}
    </div>
  );
}
