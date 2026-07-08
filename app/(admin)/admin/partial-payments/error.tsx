"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function PartialPaymentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Partial payments page error:", error); }, [error]);
  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-100"><AlertTriangle className="size-7 text-red-600" /></div>
        <h2 className="mt-5 text-xl font-black">Failed to load partial payments data</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
        <Button onClick={reset} variant="primary" className="mt-6">Try again</Button>
      </div>
    </div>
  );
}
