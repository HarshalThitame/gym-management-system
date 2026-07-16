"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type CopyableMetaRowProps = {
  label: string;
  value: string;
  className?: string;
};

export function CopyableMetaRow({ label, value, className }: CopyableMetaRowProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface-muted px-4 py-3", className)}>
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="max-w-[60ch] break-all font-mono text-xs font-semibold text-foreground">{value}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
      >
        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
