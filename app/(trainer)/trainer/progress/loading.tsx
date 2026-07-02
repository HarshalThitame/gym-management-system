export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-surface-muted" />
        <div className="h-8 w-64 rounded bg-surface-muted" />
        <div className="h-4 w-96 rounded bg-surface-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-surface shadow-premium" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <div className="h-64 rounded-2xl border border-border bg-surface shadow-premium" />
        <div className="h-64 rounded-2xl border border-border bg-surface shadow-premium" />
      </div>
    </div>
  );
}
