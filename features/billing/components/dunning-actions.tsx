"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle, Clock, Copy, ExternalLink, Link2, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type DunningActionsProps = {
  invoiceId: string;
  dunningStatus: string;
};

type ApiResponse = { ok: true; message: string; url?: string } | { ok: false; error: string };

const TERMINAL_STATES = ["resolved", "waived"];
const NO_RETRY_STATES = ["retry_scheduled", "resolved", "waived"];

export function DunningActions({ invoiceId, dunningStatus }: DunningActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [showWaive, setShowWaive] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [retryUrl, setRetryUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [graceEndDate, setGraceEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const isTerminal = TERMINAL_STATES.includes(dunningStatus);
  const canRetry = !NO_RETRY_STATES.includes(dunningStatus);

  async function executeAction(action: string, body: Record<string, unknown> = {}) {
    setLoading(action);
    setRetryUrl(null);
    try {
      const res = await fetch("/api/billing/dunning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, action, ...body }),
      });
      const data: ApiResponse = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.ok === false ? data.error : "Action failed", "error");
        return;
      }
      if (action === "retry" && "url" in data && data.url) {
        setRetryUrl(data.url);
      }
      showToast(data.message, "success");
      router.refresh();
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(null);
    }
  }

  async function handleCopyRetryUrl() {
    if (!retryUrl) return;
    try {
      await navigator.clipboard.writeText(retryUrl);
      setCopied(true);
      showToast("Checkout URL copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed to copy", "error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {retryUrl ? (
        <div className="flex w-full items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <Link2 className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{retryUrl}</span>
          <button
            onClick={handleCopyRetryUrl}
            className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-emerald-100 transition-colors"
            title="Copy checkout URL"
            type="button"
          >
            {copied ? <CheckCircle className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
          <a
            href={retryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-emerald-100 transition-colors"
            title="Open checkout"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : null}

      {!retryUrl && !isTerminal ? (
        <>
          <Button size="sm" variant="primary" disabled={loading !== null || !canRetry} onClick={() => setShowRetry(true)} title={!canRetry ? "Retry not available in current state" : ""}>
            {loading === "retry" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Retry
          </Button>
          <Button size="sm" variant="secondary" disabled={loading !== null} onClick={() => setShowExtend(true)}>
            {loading === "extend_grace" ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
            Extend Grace
          </Button>
          <Button size="sm" variant="secondary" disabled={loading !== null} onClick={() => setShowWaive(true)}>
            {loading === "waive" ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
            Waive
          </Button>
          <Button size="sm" variant="accent" disabled={loading !== null} onClick={() => setShowResolve(true)}>
            {loading === "resolve" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
            Resolve
          </Button>
        </>
      ) : null}

      {isTerminal && !retryUrl ? (
        <span className="text-xs font-semibold text-muted-foreground">No actions available — {dunningStatus.replace(/_/g, " ")}</span>
      ) : null}

      <ConfirmDialog
        open={showRetry}
        onClose={() => setShowRetry(false)}
        title="Retry Payment"
        description="Create a new Razorpay order. A checkout URL will be shown after creation so you can share it with the member."
        riskLevel="medium"
        confirmAction={{ label: "Create Retry Order", onClick: () => executeAction("retry") }}
      />

      <ConfirmDialog
        open={showExtend}
        onClose={() => setShowExtend(false)}
        title="Extend Grace Period"
        description="Move this invoice to grace_period status with a new deadline."
        riskLevel="low"
        confirmAction={{ label: "Extend Grace", onClick: () => executeAction("extend_grace", { newGraceEnd: new Date(graceEndDate).toISOString() }) }}
      >
        <div>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="grace-end">New grace period end date</label>
          <input
            id="grace-end"
            type="date"
            value={graceEndDate}
            onChange={(e) => setGraceEndDate(e.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={showWaive}
        onClose={() => setShowWaive(false)}
        title="Waive Dunning"
        description="Cancel all further retry attempts for this invoice. This action cannot be undone."
        riskLevel="high"
        requireConfirmationText="WAIVE"
        confirmAction={{ label: "Waive Dunning", variant: "destructive", onClick: () => executeAction("waive") }}
      />

      <ConfirmDialog
        open={showResolve}
        onClose={() => setShowResolve(false)}
        title="Mark as Resolved"
        description="Mark this invoice's dunning as resolved (e.g., payment was collected outside the system or manually reconciled)."
        riskLevel="low"
        confirmAction={{ label: "Mark Resolved", onClick: () => executeAction("resolve") }}
      />
    </div>
  );
}
