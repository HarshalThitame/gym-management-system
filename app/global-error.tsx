"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-white p-6 text-center dark:bg-ink">
          <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/50">
            <svg aria-hidden="true" className="size-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black">Critical Error</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            A critical error occurred. Please refresh the page or try again later.
          </p>
          <button
            onClick={reset}
            className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-bold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90"
          >
            Try Again
          </button>
          <style>{`*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;color:#1a1a2e}`}</style>
        </div>
      </body>
    </html>
  );
}
