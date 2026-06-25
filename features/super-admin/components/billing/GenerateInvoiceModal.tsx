"use client";

import { useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { showToast } from "@/components/ui/toast";
import { generateInvoiceAction } from "@/features/super-admin/actions/billing-actions";
import { formatCurrency } from "@/features/billing/lib/money";

type GenerateInvoiceModalProps = {
  organizations: any[];
  preSelectedOrgId?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function GenerateInvoiceModal({ organizations, preSelectedOrgId, onClose, onSuccess }: GenerateInvoiceModalProps) {
  const [orgId, setOrgId] = useState(preSelectedOrgId || "");
  const [invoiceType, setInvoiceType] = useState<"subscription" | "one_time">("subscription");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!orgId) { showToast("Select an organization", "error"); return; }
    if (!amount || Number(amount) <= 0) { showToast("Enter a valid amount in paise", "error"); return; }

    setLoading(true);
    const result = await generateInvoiceAction({
      organizationId: orgId,
      invoiceType,
      amount: Number(amount),
      description: description || null,
      dueDate: new Date(dueDate).toISOString(),
      currency: "INR",
      subscriptionId: null,
    });
    setLoading(false);

    if (result.status === "success") {
      showToast(`Invoice created: ${result.invoiceId ? result.invoiceId.slice(0, 12) : ""}`, "success");
      onSuccess?.();
      onClose();
    } else {
      showToast(result.message || "Failed to generate invoice", "error");
    }
  };

  const amountInr = amount ? Number(amount) / 100 : 0;
  const selectedOrg = organizations.find((o: any) => o.id === orgId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-accent/10 p-2"><FileText className="size-5 text-accent" /></div>
            <h3 className="text-lg font-black">Generate Invoice</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent/10" type="button"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Organization</label>
            {preSelectedOrgId ? (
              <p className="mt-1 text-sm font-semibold">{selectedOrg?.name ?? preSelectedOrgId}</p>
            ) : organizations.length > 0 ? (
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
                <option value="">Select organization...</option>
                {organizations.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ) : (
              <input value={orgId} onChange={(e) => setOrgId(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="Organization ID (uuid)" />
            )}
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Invoice Type</label>
            <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value as any)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm">
              <option value="subscription">Subscription (Recurring)</option>
              <option value="one_time">One-time</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Amount (in paise)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="e.g. 50000" min={1} />
            {amountInr > 0 && <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(Number(amount))} INR</p>}
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm" />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted-foreground">Description / Line Items</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1" placeholder="Optional description of charges..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="button" variant="primary" onClick={handleSubmit} disabled={!orgId || !amount || Number(amount) <= 0 || loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}Generate
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
