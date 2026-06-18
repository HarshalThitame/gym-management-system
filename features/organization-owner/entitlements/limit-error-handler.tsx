"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEntitlements } from "./entitlement-provider";

type LimitErrorState = {
  open: boolean;
  message: string;
  limitKey: string;
  currentUsage: number;
  limitValue: number;
};

export function useLimitErrorHandler() {
  const [error, setError] = useState<LimitErrorState | null>(null);
  const { plan } = useEntitlements();

  const handleLimitError = useCallback((err: unknown) => {
    // Check for structured limit error from entitlementActionCatch
    if (err && typeof err === "object" && "error" in err && (err as any).error === "LIMIT_REACHED") {
      setError({
        open: true,
        message: (err as any).message ?? "Resource limit reached.",
        limitKey: (err as any).limitKey ?? "unknown",
        currentUsage: (err as any).currentUsage ?? 0,
        limitValue: (err as any).limitValue ?? 0,
      });
      return true;
    }
    // Check for plain Error with limit-reached message
    if (err instanceof Error && (err.message.includes("limit") || err.message.includes("upgrade"))) {
      setError({
        open: true,
        message: err.message,
        limitKey: "unknown",
        currentUsage: 0,
        limitValue: 0,
      });
      return true;
    }
    return false;
  }, []);

  const closeError = useCallback(() => setError(null), []);

  const LimitErrorModal = error ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="rounded-full bg-red-100 p-3">
            <AlertTriangle className="size-6 text-red-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black">Plan Limit Reached</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
            {error.limitValue > 0 && (
              <p className="text-xs text-muted-foreground">
                Usage: {error.currentUsage} / {error.limitValue}
              </p>
            )}
          </div>
          {plan && (
            <p className="text-xs text-muted-foreground">
              Current plan: <span className="font-semibold">{plan.name}</span>
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={closeError} type="button">Dismiss</Button>
            <Button variant="primary" onClick={() => { closeError(); window.location.assign("/organization/plan"); }} type="button">
              Upgrade Plan <ArrowUpRight className="size-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  ) : null;

  return { handleLimitError, LimitErrorModal, limitError: error };
}
