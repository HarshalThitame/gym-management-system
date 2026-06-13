"use client";

import { AlertTriangle, Ban, Info, ShieldAlert } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardHeader } from "./card";

type RiskLevel = "low" | "medium" | "high" | "critical";

type ConfirmAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "destructive";
};

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  riskLevel?: RiskLevel;
  confirmAction: ConfirmAction;
  cancelLabel?: string;
  requireReason?: boolean;
  requireConfirmationText?: string;
  children?: React.ReactNode;
};

const riskConfig: Record<RiskLevel, { icon: typeof AlertTriangle; color: string; border: string; bg: string }> = {
  low: { icon: Info, color: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50" },
  medium: { icon: AlertTriangle, color: "text-amber-600", border: "border-amber-200", bg: "bg-amber-50" },
  high: { icon: ShieldAlert, color: "text-orange-600", border: "border-orange-200", bg: "bg-orange-50" },
  critical: { icon: Ban, color: "text-red-600", border: "border-red-200", bg: "bg-red-50" }
};

export function ConfirmDialog({ open, onClose, title, description, riskLevel = "medium", confirmAction, cancelLabel = "Cancel", requireReason = false, requireConfirmationText, children }: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const [confirmationInput, setConfirmationInput] = useState("");
  const config = riskConfig[riskLevel];
  const Icon = config.icon;
  const canConfirm = (!requireReason || reason.trim().length > 0) && (!requireConfirmationText || confirmationInput === requireConfirmationText);

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    confirmAction.onClick();
    onClose();
    setReason("");
    setConfirmationInput("");
  }, [canConfirm, confirmAction, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className={`w-full max-w-lg border-2 ${config.border}`} onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className={`rounded-full p-2 ${config.bg}`}>
              <Icon className={`size-6 ${config.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-black">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          {requireReason && (
            <div>
              <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="confirm-reason">Reason for this action</label>
              <textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                className="mt-1 h-20 w-full rounded-md border border-border bg-surface p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Explain why this action is necessary..."
              />
            </div>
          )}
          {requireConfirmationText && (
            <div>
              <label className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" htmlFor="confirm-text">
                Type <span className="font-black text-foreground">{requireConfirmationText}</span> to confirm
              </label>
              <input id="confirm-text" value={confirmationInput} onChange={(e) => setConfirmationInput(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={requireConfirmationText}
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
            <Button variant={confirmAction.variant ?? (riskLevel === "critical" || riskLevel === "high" ? "destructive" : "primary")}
              onClick={handleConfirm} disabled={!canConfirm}
            >
              {confirmAction.label}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
