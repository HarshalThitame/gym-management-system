"use client";
export default function BillingError({ error, reset }: { error: Error; reset: () => void }) {
  void error;
  return <div className="flex flex-col items-center justify-center gap-4 p-12 text-center"><div className="rounded-full bg-red-50 p-4"><svg className="size-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg></div><h2 className="text-2xl font-black">Billing Dashboard Error</h2><p className="max-w-md text-sm text-muted-foreground">Failed to load billing data. Please try again.</p><button onClick={reset} className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">Try Again</button></div>;
}
