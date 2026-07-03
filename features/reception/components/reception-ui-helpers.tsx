"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel,
  confirmVariant
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "success" | "warning";
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border/60 bg-gradient-to-br from-surface to-surface-muted p-6 shadow-premium-lg backdrop-blur-xl">
        <h3 className="text-xl font-black">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant={confirmVariant ?? "destructive"} onClick={onConfirm}>
            {confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReceptionSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-3 w-32 rounded bg-surface-muted" />
        <div className="mt-2 h-8 w-64 rounded bg-surface-muted" />
        <div className="mt-2 h-4 w-96 rounded bg-surface-muted" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div className="rounded-xl border border-border/60 bg-surface p-5" key={i}>
            <div className="h-4 w-8 rounded bg-surface-muted" />
            <div className="mt-3 h-8 w-16 rounded bg-surface-muted" />
            <div className="mt-2 h-3 w-24 rounded bg-surface-muted" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-surface p-6">
        <div className="h-6 w-48 rounded bg-surface-muted" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div className="h-16 rounded-lg bg-surface-muted" key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border/60 bg-surface p-6">
      <div className="h-5 w-32 rounded bg-surface-muted" />
      <div className="mt-3 h-4 w-48 rounded bg-surface-muted" />
      <div className="mt-4 space-y-2">
        <div className="h-10 rounded bg-surface-muted" />
        <div className="h-10 rounded bg-surface-muted" />
        <div className="h-10 rounded bg-surface-muted" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 3 }: { cols?: number }) {
  return (
    <div className="animate-pulse rounded-lg border border-border/60 bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded bg-surface-muted" />
          <div className="h-3 w-56 rounded bg-surface-muted" />
        </div>
        {Array.from({ length: cols }).map((_, i) => (
          <div className="h-4 w-16 rounded bg-surface-muted" key={i} />
        ))}
      </div>
    </div>
  );
}
