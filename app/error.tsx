"use client";

import { Button } from "@/components/ui/button";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/50">
        <svg aria-hidden="true" className="size-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-3xl font-black">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. Please try again."}
        {error.digest && <span className="mt-2 block font-mono text-xs opacity-60">Error ID: {error.digest}</span>}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="primary">Try Again</Button>
        <Button onClick={() => { if (typeof window !== "undefined") window.location.href = "/"; }} variant="secondary">Go Home</Button>
      </div>
    </div>
  );
}
