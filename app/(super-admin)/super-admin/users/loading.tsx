import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SuperAdminUsersLoading() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="h-3 w-32 animate-pulse rounded bg-border/60" />
          <div className="h-10 w-72 animate-pulse rounded bg-border/60" />
          <div className="h-5 w-96 animate-pulse rounded bg-border/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-32 animate-pulse rounded-md bg-border/60" />
          <div className="h-11 w-36 animate-pulse rounded-md bg-border/60" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-5">
              <div className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-border/60" />
                <div className="h-8 w-16 animate-pulse rounded bg-border/60" />
              </div>
              <div className="size-5 animate-pulse rounded bg-border/60" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_200px_140px_auto]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-md bg-border/60" />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-border/60" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
