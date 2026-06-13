import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BillingLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading billing data">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-16 animate-pulse rounded bg-surface-muted" />
          <div className="mt-2 h-8 w-52 animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="h-10 w-24 animate-pulse rounded-md bg-surface-muted" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-6 w-20 animate-pulse rounded bg-surface-muted sm:h-7" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="h-11 w-full animate-pulse rounded-lg bg-surface-muted" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="h-6 w-40 animate-pulse rounded bg-surface-muted" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-surface-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-surface-muted" />
                <div className="h-4 w-36 animate-pulse rounded bg-surface-muted" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-surface-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
