import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SuperAdminUserDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="space-y-3">
          <div className="h-4 w-48 animate-pulse rounded bg-border/60" />
          <div className="h-10 w-64 animate-pulse rounded bg-border/60" />
          <div className="h-4 w-80 animate-pulse rounded bg-border/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-32 animate-pulse rounded-md bg-border/60" />
          <div className="h-11 w-32 animate-pulse rounded-md bg-border/60" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="size-5 animate-pulse rounded bg-border/60" />
              <div className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-border/60" />
                <div className="h-4 w-24 animate-pulse rounded bg-border/60" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="h-6 w-36 animate-pulse rounded bg-border/60" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-border/60" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 w-36 animate-pulse rounded bg-border/60" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-border/60" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
