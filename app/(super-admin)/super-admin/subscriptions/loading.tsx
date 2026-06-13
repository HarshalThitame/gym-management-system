import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SubscriptionsLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading subscription data">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
          <div className="mt-2 h-8 w-64 animate-pulse rounded bg-surface-muted" />
          <div className="mt-2 h-4 w-96 animate-pulse rounded bg-surface-muted max-sm:w-48" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-surface-muted" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2 sm:pb-3">
              <div className="h-3 w-28 animate-pulse rounded bg-surface-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-24 animate-pulse rounded bg-surface-muted sm:h-9" />
              <div className="mt-2 h-3 w-36 animate-pulse rounded bg-surface-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary cards skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
                <div className="size-5 animate-pulse rounded bg-surface-muted" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-9 w-20 animate-pulse rounded bg-surface-muted" />
              <div className="mt-2 h-3 w-44 animate-pulse rounded bg-surface-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="h-7 w-40 animate-pulse rounded bg-surface-muted" />
            <div className="flex gap-3">
              <div className="hidden h-10 w-56 animate-pulse rounded-md bg-surface-muted sm:block" />
              <div className="h-10 w-32 animate-pulse rounded-md bg-surface-muted" />
              <div className="h-10 w-20 animate-pulse rounded-md bg-surface-muted" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-48 animate-pulse rounded bg-surface-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-surface-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
