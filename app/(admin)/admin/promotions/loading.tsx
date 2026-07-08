export default function PromotionsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <section>
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="mt-2 h-9 w-56 rounded bg-muted" />
        <div className="mt-2 h-4 w-[500px] rounded bg-muted" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="mt-2 h-8 w-12 rounded bg-muted" />
            <div className="mt-1 h-3 w-28 rounded bg-muted" />
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border p-5 md:p-6">
            <div className="h-6 w-36 rounded bg-muted" />
            <div className="mt-1 h-4 w-56 rounded bg-muted" />
          </div>
          <div className="space-y-3 p-5 md:p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface-muted p-4">
                <div className="h-5 w-40 rounded bg-muted" />
                <div className="mt-1 h-4 w-32 rounded bg-muted" />
                <div className="mt-1 h-4 w-48 rounded bg-muted" />
                <div className="mt-2 h-3 w-36 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border p-5 md:p-6">
            <div className="h-6 w-32 rounded bg-muted" />
          </div>
          <div className="space-y-4 p-5 md:p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="mt-1 h-11 w-full rounded-md bg-muted" />
              </div>
            ))}
            <div className="h-11 w-full rounded-md bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
