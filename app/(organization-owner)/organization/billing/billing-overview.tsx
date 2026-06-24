"use client";

import { useState } from "react";
import { CreditCard, Download, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatCurrency(amount?: number | null) {
  const safe = amount ?? 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(safe / 100);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "paid" || status === "active" ? "success" as const
    : status === "issued" || status === "draft" || status === "pending" ? "warning" as const
    : "neutral" as const;
  return <Badge variant={variant}>{status}</Badge>;
}

export function BillingOverview({
  subscription, invoices, paymentMethods,
}: {
  organizationId: string;
  subscription: Record<string, unknown> | null;
  invoices: Array<Record<string, unknown>>;
  paymentMethods: Array<Record<string, unknown>>;
}) {
  const [section, setSection] = useState<"overview" | "invoices" | "payment-methods">("overview");

  const planName = (subscription?.package_name as string) ?? "Current Plan";
  const status = (subscription?.status as string) ?? "inactive";
  const nextBilling = subscription?.next_billing_date as string | null;

  const totalDue = invoices
    .filter((inv) => (inv.status as string) !== "paid" && (inv.status as string) !== "cancelled")
    .reduce((s, inv) => s + ((inv.amount_due as number) || 0), 0);

  const navClass = (name: string) =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      section === name ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
    }`;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-muted-foreground">Manage your subscription, invoices, and payment methods</p>
        </div>
        <ButtonLink href="/organization/plan" variant="outline" size="sm" className="w-full sm:w-auto">View Plan Details</ButtonLink>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Plan</p>
          <p className="text-lg font-bold truncate">{planName}</p>
          <div className="mt-1"><StatusBadge status={status} /></div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(totalDue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Next Billing</p>
          <p className="text-lg font-bold">{nextBilling ? formatDate(nextBilling) : "N/A"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Invoices</p>
          <p className="text-lg font-bold">{invoices.length}</p>
        </Card>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 overflow-x-auto">
        {(["overview", "invoices", "payment-methods"] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)} className={navClass(s)}>
            {s === "overview" ? "Overview" : s === "invoices" ? "Invoices" : "Payment Methods"}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Recent Invoices</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 5).map((inv) => (
                <div key={inv.id as string} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <ReceiptText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-xs truncate">{inv.invoice_number as string}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={inv.status as string} />
                    <span className="font-black">{formatCurrency((inv.total_amount as number) || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {section === "invoices" && (
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">No invoices found.</Card>
          ) : (
            invoices.map((inv) => (
              <Card key={inv.id as string} className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold truncate">{inv.invoice_number as string}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.issued_at ? formatDate(inv.issued_at as string) : ""}
                      {inv.due_at ? ` · Due ${formatDate(inv.due_at as string)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={inv.status as string} />
                    <span className="font-black">{formatCurrency((inv.total_amount as number) || 0)}</span>
                    <a href={`/api/billing/subscription-invoices/pdf/${inv.id}`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}>
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {section === "payment-methods" && (
        <>
          {paymentMethods.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <CreditCard className="h-8 w-8 mx-auto mb-2" />
              <p>No payment methods saved.</p>
              <p className="text-xs mt-1">Payment methods can be added during checkout.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paymentMethods.map((pm) => (
                <Card key={pm.id as string} className="p-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{pm.display_name as string}</p>
                      <p className="text-xs text-muted-foreground">
                        {pm.payment_type as string}
                        {pm.last_four ? ` · ****${pm.last_four}` : ""}
                      </p>
                    </div>
                    {(pm.is_default as boolean) && <Badge variant="info" className="ml-auto shrink-0">Default</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
