export default function TaxSettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section><div className="h-3 w-24 rounded bg-muted" /><div className="mt-2 h-9 w-44 rounded bg-muted" /><div className="mt-2 h-4 w-[500px] rounded bg-muted" /></section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4"><div className="h-3 w-20 rounded bg-muted" /><div className="mt-2 h-8 w-32 rounded bg-muted" /><div className="mt-1 h-3 w-36 rounded bg-muted" /></div>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border p-5 md:p-6"><div className="h-6 w-32 rounded bg-muted" /></div>
            <div className="space-y-3 p-5 md:p-6">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-3">
                  <div className="h-4 w-32 rounded bg-muted" /><div className="h-4 w-36 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
