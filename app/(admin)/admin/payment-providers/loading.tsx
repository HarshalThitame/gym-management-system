export default function PaymentProvidersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section>
        <div className="h-3 w-36 rounded bg-muted" />
        <div className="mt-2 h-9 w-72 rounded bg-muted" />
        <div className="mt-2 h-4 w-[600px] rounded bg-muted" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border p-5 md:p-6">
              <div className="size-10 rounded-lg bg-muted" />
              <div className="space-y-1">
                <div className="h-6 w-28 rounded bg-muted" />
                <div className="h-4 w-24 rounded bg-muted" />
              </div>
            </div>
            <div className="space-y-4 p-5 md:p-6">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j}>
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="mt-1 h-11 w-full rounded-md bg-muted" />
                </div>
              ))}
              <div className="flex gap-4">
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
              <div className="h-10 w-44 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
