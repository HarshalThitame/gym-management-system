export default function PaymentTrackingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section>
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="mt-2 h-9 w-52 rounded bg-muted" />
        <div className="mt-2 h-4 w-[450px] rounded bg-muted" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-2 h-8 w-24 rounded bg-muted" />
            <div className="mt-1 h-3 w-36 rounded bg-muted" />
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border p-5 md:p-6">
              <div className="h-6 w-40 rounded bg-muted" />
              <div className="mt-1 h-4 w-56 rounded bg-muted" />
            </div>
            <div className="space-y-4 p-5 md:p-6">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-5 rounded bg-muted" />
                    <div>
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="mt-1 h-3 w-36 rounded bg-muted" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 w-20 rounded bg-muted" />
                    <div className="mt-1 h-3 w-16 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-5 md:p-6">
          <div className="h-6 w-44 rounded bg-muted" />
          <div className="mt-1 h-4 w-48 rounded bg-muted" />
        </div>
        <div className="space-y-2 p-5 md:p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="flex items-center gap-3">
                <div className="h-2 w-24 rounded-full bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
