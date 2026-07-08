export default function PaymentFailuresLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section>
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="mt-2 h-9 w-96 rounded bg-muted" />
        <div className="mt-2 h-4 w-[600px] rounded bg-muted" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="mt-2 h-8 w-20 rounded bg-muted" />
            <div className="mt-1 h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="mt-2 h-8 w-28 rounded bg-muted" />
          <div className="mt-1 h-3 w-40 rounded bg-muted" />
        </div>
      </section>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-5 md:p-6">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="mt-1 h-4 w-72 rounded bg-muted" />
        </div>
        <div className="space-y-3 p-5 md:p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-32 rounded bg-muted" />
                    <div className="h-5 w-24 rounded bg-muted" />
                  </div>
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-3 w-64 rounded bg-muted" />
                  <div className="h-3 w-48 rounded bg-muted" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="h-6 w-20 rounded bg-muted" />
                  <div className="flex gap-2">
                    <div className="h-8 w-16 rounded bg-muted" />
                    <div className="h-8 w-24 rounded bg-muted" />
                    <div className="h-8 w-16 rounded bg-muted" />
                    <div className="h-8 w-20 rounded bg-muted" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
