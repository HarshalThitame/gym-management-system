export default function PaymentMethodsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-white/5" />
      <div className="h-4 w-96 rounded bg-white/5" />
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 p-5">
          <div className="h-6 w-36 rounded bg-white/10" />
          <div className="mt-1 h-4 w-64 rounded bg-white/10" />
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="size-5 rounded bg-white/10" />
                <div>
                  <div className="h-4 w-48 rounded bg-white/10" />
                  <div className="mt-1 h-3 w-36 rounded bg-white/10" />
                </div>
              </div>
              <div className="h-8 w-8 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
