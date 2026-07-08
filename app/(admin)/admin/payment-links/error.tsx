"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentLinksError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Payment links page error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto size-10 text-red-500" />
        <h2 className="mt-4 text-xl font-black">Failed to load payment links</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button onClick={reset} variant="primary" className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
