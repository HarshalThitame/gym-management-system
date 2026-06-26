"use client";

import { useState, useMemo } from "react";
import { RotateCcw, Loader2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { processRefundAction } from "@/features/super-admin/actions/billing-actions";
import { formatCurrency } from "@/features/billing/lib/money";

type ProcessRefundModalProps = {
  organizations: any[];
  invoices?: any[];
  payments?: any[];
  preSelectedInvoiceId?: string;
  preSelectedPaymentId?: string;
  preSelectedOrgId?: string;
  preFilledAmount?: number;
  onClose: () => void;
  onSuccess?: () => void;
};

const REFUND_REASONS = [
  { value: "duplicate", label: "Duplicate Payment" },
  { value: "customer_request", label: "Customer Request" },
  { value: "service_issue", label: "Service Issue" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

export function ProcessRefundModal({
  organizations, invoices, payments,
  preSelectedInvoiceId, preSelectedPaymentId, preSelectedOrgId, preFilledAmount,
  onClose, onSuccess,
}: ProcessRefundModalProps) {
  const [orgId, setOrgId] = useState(preSelectedOrgId || "");
  const [invoiceId, setInvoiceId] = useState(preSelectedInvoiceId || "");
  const [paymentId, setPaymentId] = useState(preSelectedPaymentId || "");
  const [amount, setAmount] = useState(preFilledAmount ? String(preFilledAmount) : "");
  const [reason, setReason] = useState("customer_request");
  const [notes, setNotes] = useState("");
  const [stepUpEmail, setStepUpEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const amountInr = amount ? Number(amount) / 100 : 0;

  const handleSubmit = async () => {
    if (!orgId) { showToast("Select an organization", "error"); return; }
    if (!amount || Number(amount) <= 0) { showToast("Enter a valid amount", "error"); return; }
    if (!stepUpEmail || !stepUpEmail.includes("@")) { showToast("Valid MFA step-up email required", "error"); return; }
    if (confirmText !== `REFUND:${amount}`) { showToast(`Type "REFUND:${amount}" to confirm`, "error"); return; }

    setLoading(true);
    const result = await processRefundAction({
      organizationId: orgId,
      invoiceId: invoiceId || null,
      paymentId: paymentId || null,
      amount: Number(amount),
      reason: reason as any,
      notes: notes || null,
      stepUpEmail,
    });
    setLoading(false);

    if (result.status === "success") {
      showToast(`Refund ${result.refundId?.slice(0, 12)} processed`, "success");
      onSuccess?.();
      onClose();
    } else {
      showToast(result.message || "Refund failed", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border-2 border-orange-200 bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-full bg-orange-50 p-2"><RotateCcw className="size-5 text-orange-600" /></div>
          <div>
            <h3 className="text-lg font-black">Process Refund</h3>
            <p className="text-xs text-muted-foreground">MFA step-up + confirmation required</p>
          </div>
        </div>

        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
          <p className="text-xs text-amber-800 font-semibold">Refunds are irreversible. Double-check the amount and reason before processing.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Organization</label>
            {organizations.length > 0 ? (
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
                <option value="">Select...</option>
                {organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ) : (
              <input value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Organization ID (uuid)" />
            )}
          </div>

          {invoices && invoices.length > 0 && (
            <div>
              <label className="text-xs font-black uppercase text-muted-foreground">Invoice (optional)</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
                <option value="">No invoice</option>
                {invoices.map((inv: any) => <option key={inv.id} value={inv.id}>{inv.invoice_number ?? inv.id.slice(0, 12)}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Amount (in paise)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="e.g. 50000" min={1} />
            {amountInr > 0 && <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(Number(amount))} INR</p>}
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Refund Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
              {REFUND_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Notes (optional)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1" placeholder="Additional notes..." />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Super Admin Email (MFA step-up)</label>
            <input value={stepUpEmail} onChange={(e) => setStepUpEmail(e.target.value)} type="email" className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="admin@example.com" />
          </div>

          <InlineMfaStepUp compact />

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Type &quot;REFUND:{amount}&quot; to confirm</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder={`REFUND:${amount}`} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleSubmit} disabled={!orgId || !amount || Number(amount) <= 0 || !stepUpEmail || confirmText !== `REFUND:${amount}` || loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Process Refund
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
