import { Skeleton } from "@/components/ui/skeleton";

export default function OrgOwnerModuleLoading() {
  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-surface p-6 md:p-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-10 w-64" />
        <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5 md:p-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-9 w-16" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        ))}
      </section>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto]">
          <Skeleton className="h-11 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-24" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-72" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
