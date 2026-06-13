import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { getBillingSummary, getDetailedBillingData, getCreditNotes, getWriteOffs, getDisputes, getReconciliationEntries, getRevenueRecognitionEntries, getOrgSubscriptionInvoices, getOrgSubscriptionPayments, getSubscriptionRevenueMetrics } from "@/features/billing/services/billing-admin-service";
import { BillingDashboard } from "./billing-dashboard";

export const metadata: Metadata = createMetadata({
  title: "Billing & Finance",
  description: "Enterprise billing management, invoicing, payments, refunds, credit notes, disputes, reconciliation, and revenue recognition.",
  path: "/super-admin/billing",
});

export default async function SuperAdminBillingPage() {
  const context = await requireAuth("/super-admin/billing");
  if (!context.roles.includes("super_admin")) redirect("/unauthorized");
  await requireRole(["super_admin"], "/super-admin/billing");

  const [summary, detailed, creditNotes, writeOffs, disputes, reconciliation, revenueRecognition, subInvoices, subPayments, subMetrics] = await Promise.all([
    safeData(getBillingSummary(), {
      totalInvoicedMonth: 0, totalCollectedMonth: 0, totalRefundedMonth: 0,
      totalOutstanding: 0, totalWrittenOff: 0, openDisputesCount: 0, openDisputeAmount: 0,
      pendingReconciliationCount: 0, creditNotesIssued: 0, creditNotesApplied: 0, monthOverMonthGrowth: 0,
    }),
    safeData(getDetailedBillingData(), { invoices: [], payments: [], refunds: [], transactions: [] }),
    safeData(getCreditNotes({ limit: 20 }), []),
    safeData(getWriteOffs({ limit: 20 }), []),
    safeData(getDisputes({ limit: 20 }), []),
    safeData(getReconciliationEntries({ limit: 20 }), []),
    safeData(getRevenueRecognitionEntries({ limit: 20 }), []),
    safeData(getOrgSubscriptionInvoices({ limit: 20 }), []),
    safeData(getOrgSubscriptionPayments({ limit: 20 }), []),
    safeData(getSubscriptionRevenueMetrics(), { totalInvoicedMonth: 0, totalCollectedMonth: 0, totalOutstanding: 0, invoiceCount: 0 }),
  ]);

  return (
    <div id="main-content">
      <BillingDashboard
        summary={summary}
        invoices={detailed.invoices}
        payments={detailed.payments}
        refunds={detailed.refunds}
        transactions={detailed.transactions}
        creditNotes={creditNotes}
        writeOffs={writeOffs}
        disputes={disputes}
        reconciliation={reconciliation}
        revenueRecognition={revenueRecognition}
        subscriptionInvoices={subInvoices}
        subscriptionPayments={subPayments}
        subscriptionMetrics={subMetrics}
      />
    </div>
  );
}

async function safeData<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try { return await promise; } catch { return fallback; }
}
