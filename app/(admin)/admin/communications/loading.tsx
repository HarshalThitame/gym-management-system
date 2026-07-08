export default function CommunicationsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-3 w-36 rounded bg-muted" />
        <div className="mt-2 h-9 w-[600px] rounded bg-muted" />
        <div className="mt-2 h-4 w-[700px] rounded bg-muted" />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-2 h-8 w-16 rounded bg-muted" />
            <div className="mt-1 h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border p-5 md:p-6">
              <div className="h-6 w-44 rounded bg-muted" />
              <div className="mt-1 h-4 w-56 rounded bg-muted" />
            </div>
            <div className="p-5 md:p-6">
              <div className="h-48 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`section-${i}`} className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border p-5 md:p-6">
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="mt-1 h-4 w-64 rounded bg-muted" />
          </div>
          <div className="space-y-4 p-5 md:p-6">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-12 rounded-md bg-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
