"use client";

import { Button } from "@/components/ui/button";

export default function RolesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-black">Something went wrong</h2>
      <p className="max-w-md text-center text-sm font-semibold text-muted-foreground">
        {error.message ?? "Failed to load roles data."}
      </p>
      <Button onClick={reset} variant="primary">Try Again</Button>
    </div>
  );
}
