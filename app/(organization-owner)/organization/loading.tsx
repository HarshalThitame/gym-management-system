import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationOwnerLoading() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <section className="rounded-lg border border-border bg-surface p-6 md:p-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-10 w-72" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </section>

      {/* KPI grid skeleton */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5 md:p-6">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-9 w-20" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        ))}
      </section>

      {/* Two column skeleton */}
      <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-8 w-48" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="h-8 w-48" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
