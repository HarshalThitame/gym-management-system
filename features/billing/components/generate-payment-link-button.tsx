"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Link2, Mail, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";

type ApiResponse =
  | { ok: true; url?: string; linkId?: string; message?: string; invoiceNumber?: string; memberEmail?: string; memberName?: string }
  | { ok: false; error: string };

type GeneratePaymentLinkButtonProps = {
  invoiceId: string;
  invoiceNumber?: string;
  existingUrl?: string | null;
  disabled?: boolean;
};

export function GeneratePaymentLinkButton({ invoiceId, invoiceNumber = "", existingUrl = null, disabled = false }: GeneratePaymentLinkButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(existingUrl ? "success" : "idle");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(existingUrl);
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [revoking, setRevoking] = useState(false);

  if (generatedUrl) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 max-w-[180px] items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <Link2 className="size-3.5 shrink-0" />
          <span className="truncate">{generatedUrl}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex size-7 items-center justify-center rounded-md border border-border hover:bg-accent/10 transition-colors"
            title="Copy link"
            type="button"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </button>
          <button
            onClick={handleOpen}
            className="flex size-7 items-center justify-center rounded-md border border-border hover:bg-accent/10 transition-colors"
            title="Open link in new tab"
            type="button"
          >
            <ExternalLink className="size-3.5" />
          </button>
          <button
            onClick={handleEmail}
            disabled={sendingEmail}
            className="flex size-7 items-center justify-center rounded-md border border-border hover:bg-accent/10 transition-colors disabled:opacity-50"
            title="Send link via email"
            type="button"
          >
            {sendingEmail ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={revoking}
            className="flex size-7 items-center justify-center rounded-md border border-border hover:bg-amber-50 transition-colors disabled:opacity-50"
            title="Regenerate link (cancels old, creates new)"
            type="button"
          >
            {revoking ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          </button>
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="flex size-7 items-center justify-center rounded-md border border-border hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Revoke/cancel payment link"
            type="button"
          >
            <XCircle className="size-3.5 text-red-500" />
          </button>
        </div>
      </div>
    );
  }

  async function handleGenerate() {
    setStatus("loading");
    try {
      const { url } = await sendGenerateRequest();
      if (url) {
        setGeneratedUrl(url);
        setStatus("success");
        showToast("Payment link created successfully", "success");
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  async function handleRegenerate() {
    setRevoking(true);
    try {
      const { url } = await sendGenerateRequest("regenerate");
      if (url) {
        setGeneratedUrl(url);
        setStatus("success");
        showToast("Payment link regenerated", "success");
      }
    } catch {
      showToast("Failed to regenerate payment link", "error");
    } finally {
      setRevoking(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      const res = await fetch("/api/billing/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, action: "revoke" }),
      });
      const data: ApiResponse = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.ok === false ? data.error : "Failed to revoke link", "error");
        return;
      }
      setGeneratedUrl(null);
      setStatus("idle");
      showToast("Payment link cancelled", "success");
    } catch {
      showToast("Failed to revoke payment link", "error");
    } finally {
      setRevoking(false);
    }
  }

  async function handleEmail() {
    if (!generatedUrl) return;
    setSendingEmail(true);
    try {
      const res = await fetch("/api/billing/payment-links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data: ApiResponse = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.ok === false ? data.error : "Failed to send email", "error");
        return;
      }
      showToast("Payment link sent to member's email", "success");
    } catch {
      showToast("Failed to send email", "error");
    } finally {
      setSendingEmail(false);
    }
  }

  async function sendGenerateRequest(action?: "regenerate") {
    const res = await fetch("/api/billing/payment-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, action }),
    });
    const data: ApiResponse = await res.json();
    if (!res.ok || !data.ok) {
      const msg = data.ok === false ? data.error : "Failed to generate payment link";
      showToast(msg, "error");
      throw new Error(msg);
    }
    return { url: data.url };
  }

  async function handleCopy() {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      showToast("Link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed to copy link", "error");
    }
  }

  function handleOpen() {
    if (generatedUrl) window.open(generatedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Button disabled={disabled || status === "loading"} onClick={handleGenerate} size="sm" variant="accent">
      {status === "loading" ? (
        <><Loader2 className="size-4 animate-spin" /> Generating...</>
      ) : (
        <><Link2 className="size-4" /> Generate Payment Link</>
      )}
    </Button>
  );
}
