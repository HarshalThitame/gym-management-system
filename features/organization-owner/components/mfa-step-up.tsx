"use client";

import { useCallback, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

type MfaStepUpProps = {
  organizationId: string;
  actionLabel: string;
  actionDescription: string;
  severity: "high" | "critical";
  onVerified: () => void | Promise<void>;
  onCancel: () => void;
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function MfaStepUp({ organizationId, actionLabel, actionDescription, severity, onVerified, onCancel }: MfaStepUpProps) {
  const [step, setStep] = useState<"reason" | "verify" | "confirm">("reason");
  const [reason, setReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setError("");
    try {
      // Simulate MFA verification — in production this would call an API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (confirmationText !== actionLabel.toUpperCase()) {
        throw new Error(`Type "${actionLabel.toUpperCase()}" to confirm.`);
      }
      await onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }, [confirmationText, actionLabel, onVerified]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`rounded-full p-2 ${severity === "critical" ? "bg-red-100" : "bg-amber-100"}`}>
            {severity === "critical" ? <ShieldAlert className="size-6 text-red-600" /> : <ShieldCheck className="size-6 text-amber-600" />}
          </div>
          <div>
            <h3 className="text-lg font-black">{actionLabel}</h3>
            <p className="text-sm text-muted-foreground">{actionDescription}</p>
          </div>
        </div>

        {step === "reason" ? (
          <div className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-bold">Reason for this action <span className="text-red-500">*</span></span>
              <textarea className={`${selectClass} min-h-[100px]`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this action is necessary..." rows={4} />
            </label>
            <div className="flex justify-end gap-3">
              <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={onCancel} type="button">Cancel</button>
              <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:-translate-y-0.5 disabled:opacity-50" disabled={reason.length < 10} onClick={() => setStep("confirm")} type="button">Continue</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800" role="alert">
              This is a {severity}-severity action. Please confirm to proceed.
            </div>

            <label className="space-y-2">
              <span className="text-sm font-bold">Type <kbd className="rounded border border-border bg-background px-2 py-0.5 text-xs font-mono">{actionLabel.toUpperCase()}</kbd> to confirm</span>
              <input className={selectClass} value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} placeholder={`Type ${actionLabel.toUpperCase()} here`} />
            </label>

            {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{error}</p> : null}

            <div className="flex justify-end gap-3">
              <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={onCancel} type="button">Cancel</button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
                disabled={confirmationText !== actionLabel.toUpperCase() || verifying}
                onClick={handleVerify}
                type="button"
              >
                {verifying ? <Loader2 className="size-4 animate-spin" /> : null}
                {verifying ? "Verifying..." : "Confirm & Execute"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
