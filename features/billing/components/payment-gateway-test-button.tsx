"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import type { PaymentProviderName, PaymentProviderHealth } from "@/features/billing/providers/provider-types";

type TestResult = {
  ok: boolean;
  provider: PaymentProviderName;
  runtimeSource: "platform table" | "env fallback" | "not configured";
  message: string;
  health: PaymentProviderHealth | null;
  keyIdMasked?: string;
  missingFields?: string[];
};

type PaymentGatewayTestButtonProps = {
  provider: PaymentProviderName;
  label?: string;
  endpoint?: string;
  helperText?: string;
};

export function PaymentGatewayTestButton({
  provider,
  label = "Test integration",
  endpoint = "/api/super-admin/payment-gateway-config/test",
  helperText = "Validates the saved platform config using the same runtime path used by org-plan billing.",
}: PaymentGatewayTestButtonProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function handleTest() {
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      const data = await response.json() as TestResult & { error?: string };

      if (!response.ok) {
        const message = data.error || data.message || "Integration test failed";
        setResult({
          ok: false,
          provider,
          runtimeSource: data.runtimeSource ?? "not configured",
          message,
          health: data.health ?? null,
          missingFields: data.missingFields ?? [],
          keyIdMasked: data.keyIdMasked,
        });
        showToast(message, "error");
        return;
      }

      setResult(data);
      showToast(data.message, "success");
    } catch {
      const message = "Network error while testing gateway integration";
      setResult({
        ok: false,
        provider,
        runtimeSource: "not configured",
        message,
        health: null,
        missingFields: [],
      });
      showToast(message, "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="gap-1.5">
              <WandSparkles className="size-3.5" />
              Integration check
            </Badge>
            <Badge variant={result?.ok ? "success" : "neutral"} className="gap-1.5">
              {result?.ok ? <CheckCircle2 className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {result?.ok ? "Healthy" : "Ready to test"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{helperText}</p>
        </div>

        <Button
          type="button"
          onClick={handleTest}
          disabled={running}
          variant="secondary"
          className="gap-2 rounded-xl"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
          {running ? "Testing..." : label}
        </Button>
      </div>

      {result && (
        <div
          className={`rounded-2xl border p-4 ${
            result.ok
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-rose-500/20 bg-rose-500/5"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.ok ? "success" : "warning"} className="gap-1.5">
              {result.ok ? "Pass" : "Needs attention"}
            </Badge>
            <Badge variant="neutral">{result.runtimeSource}</Badge>
            {result.health?.environment && <Badge variant="neutral">{result.health.environment}</Badge>}
            {result.keyIdMasked && <Badge variant="neutral">{result.keyIdMasked}</Badge>}
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">{result.message}</p>
          {result.missingFields && result.missingFields.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Missing fields: {result.missingFields.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
