"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { updateSubscriptionStatusAction } from "@/features/super-admin/actions/subscription-actions";

type SuspendModalProps = {
  sub: any;
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function SuspendModal({ sub, orgId, onClose, onSuccess }: SuspendModalProps) {
  const [reason, setReason] = useState("");
  const [stepUpEmail, setStepUpEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      showToast("Reason must be at least 10 characters", "error");
      return;
    }
    if (!stepUpEmail || !stepUpEmail.includes("@")) {
      showToast("Valid MFA step-up email is required", "error");
      return;
    }
    if (confirmText !== "SUSPEND") {
      showToast('Type "SUSPEND" to confirm', "error");
      return;
    }

    setLoading(true);
    const result = await updateSubscriptionStatusAction({
      subscriptionId: sub.id,
      organizationId: orgId,
      status: "suspended",
      stepUpEmail,
      reason: reason.trim(),
    });
    setLoading(false);

    if (result.status === "success") {
      showToast("Subscription suspended", "success");
      onSuccess();
      onClose();
    } else {
      showToast(result.message || "Failed to suspend", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border-2 border-red-200 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-full bg-red-50 p-2"><Ban className="size-5 text-red-600" /></div>
          <div>
            <h3 className="text-lg font-black">Suspend Subscription</h3>
            <p className="text-xs text-muted-foreground">MFA step-up + confirmation required</p>
          </div>
        </div>

        <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600" />
          <p className="text-xs text-red-800 font-semibold">
            Suspending will block all organization users until reactivated. All services will be interrupted immediately.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Reason (min 10 chars)</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="Why is this subscription being suspended?" />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Super Admin Email (MFA step-up)</label>
            <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="admin@example.com" />
          </div>

          <InlineMfaStepUp compact />

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Type "SUSPEND" to confirm</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="SUSPEND" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleSubmit} disabled={reason.trim().length < 10 || !stepUpEmail || confirmText !== "SUSPEND" || loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}Suspend Subscription
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
