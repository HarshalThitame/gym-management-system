export default function MemberBillingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="h-4 w-96 rounded bg-white/5" />

      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="size-5 rounded bg-white/10" />
            <div>
              <div className="h-6 w-36 rounded bg-white/10" />
              <div className="mt-1 h-4 w-48 rounded bg-white/10" />
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="h-20 rounded-lg bg-white/5" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="size-5 rounded bg-white/10" />
                <div>
                  <div className="h-6 w-32 rounded bg-white/10" />
                  <div className="mt-1 h-4 w-40 rounded bg-white/10" />
                </div>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="h-16 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
