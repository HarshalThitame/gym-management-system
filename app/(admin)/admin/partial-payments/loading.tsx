export default function PartialPaymentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section><div className="h-3 w-28 rounded bg-muted" /><div className="mt-2 h-9 w-56 rounded bg-muted" /><div className="mt-2 h-4 w-[500px] rounded bg-muted" /></section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4"><div className="h-3 w-20 rounded bg-muted" /><div className="mt-2 h-8 w-24 rounded bg-muted" /><div className="mt-1 h-3 w-36 rounded bg-muted" /></div>
        ))}
      </section>
      <div className="h-11 w-full rounded-md border border-border bg-surface" />
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-5 md:p-6"><div className="h-6 w-44 rounded bg-muted" /></div>
        <div className="space-y-3 p-5 md:p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border bg-surface-muted p-4">
              <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><div className="h-5 w-36 rounded bg-muted" /><div className="h-5 w-20 rounded bg-muted" /></div>
                  <div className="h-4 w-32 rounded bg-muted" /><div className="h-3 w-48 rounded bg-muted" />
                </div>
                <div className="flex flex-col items-end gap-1"><div className="h-6 w-24 rounded bg-muted" /><div className="h-3 w-20 rounded bg-muted" /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
