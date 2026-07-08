export default function AutoBillingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section>
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="mt-2 h-9 w-72 rounded bg-muted" />
        <div className="mt-2 h-4 w-[500px] rounded bg-muted" />
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-2 h-8 w-16 rounded bg-muted" />
            <div className="mt-1 h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </section>
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-5 md:p-6">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="mt-1 h-4 w-72 rounded bg-muted" />
        </div>
        <div className="p-5 md:p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-border/50 py-3 last:border-0">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
