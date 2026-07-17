"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Clock3, Copy, CreditCard, Download, ReceiptText, Search, ShieldAlert, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { Database, Json } from "@/types/database";
import type { OrganizationAuditTimelineItem, OrganizationDetailData } from "../../services/organization-management-service";
import { OrgSubscriptionControlPanel } from "./OrgSubscriptionControlPanel";
import { buildBillingTimeline, formatBillingFailureInsight, type BillingTimelineEntry } from "../../lib/org-billing-export";
import { retryPaymentAttemptAction } from "../../actions/payment-attempt-actions";
import { showToast } from "@/components/ui/toast";

type SubscriptionInvoiceRow = Database["public"]["Tables"]["org_subscription_invoices"]["Row"];
type SubscriptionPaymentRow = Database["public"]["Tables"]["org_subscription_payments"]["Row"];
type PaymentAttemptRow = Database["public"]["Tables"]["payment_attempts"]["Row"];

export function OrgBillingTab({ data, criticalSuperAdminEmail }: { data: OrganizationDetailData; criticalSuperAdminEmail: string }) {
  const payments = data.recentPayments || [];
  const paymentAttempts = useMemo(() => data.paymentAttempts || [], [data.paymentAttempts]);
  const router = useRouter();
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [expandedAttemptIds, setExpandedAttemptIds] = useState<string[]>([]);
  const [attemptQuery, setAttemptQuery] = useState("");
  const [attemptStatusFilter, setAttemptStatusFilter] = useState("all");
  const [attemptProviderFilter, setAttemptProviderFilter] = useState("all");
  const [retryingAttemptId, setRetryingAttemptId] = useState<string | null>(null);
  const [isRetrying, startRetryTransition] = useTransition();
  const subscriptionInvoices = [...(data.subscriptionInvoices || [])].sort((left: SubscriptionInvoiceRow, right: SubscriptionInvoiceRow) => {
    const leftDate = new Date(String(left.created_at ?? left.issued_at ?? 0)).getTime();
    const rightDate = new Date(String(right.created_at ?? right.issued_at ?? 0)).getTime();
    return rightDate - leftDate;
  });
  const subscriptionPayments = [...(data.subscriptionPayments || [])].sort((left: SubscriptionPaymentRow, right: SubscriptionPaymentRow) => {
    const leftDate = new Date(String(left.created_at ?? left.paid_at ?? 0)).getTime();
    const rightDate = new Date(String(right.created_at ?? right.paid_at ?? 0)).getTime();
    return rightDate - leftDate;
  });
  const subscriptionOutstanding = subscriptionInvoices.reduce((sum, invoice) => {
    return sum + Number(invoice.amount_due ?? invoice.total_amount ?? 0);
  }, 0);
  const subscriptionCollectedMtd = subscriptionPayments.reduce((sum, payment) => {
    const createdAt = String(payment.created_at ?? payment.paid_at ?? "");
    if (!createdAt) return sum;
    const d = new Date(createdAt);
    if (d.getMonth() !== new Date().getMonth() || d.getFullYear() !== new Date().getFullYear()) {
      return sum;
    }
    return sum + Number(payment.amount ?? 0);
  }, 0);
  const failedPaymentAttempts = paymentAttempts.filter((attempt) => attempt.status === "failed");
  const retryingPaymentAttempts = paymentAttempts.filter((attempt) => attempt.status === "retrying" || attempt.status === "processing" || attempt.status === "created");
  const paymentAttemptSummary = {
    total: paymentAttempts.length,
    failed: failedPaymentAttempts.length,
    retrying: retryingPaymentAttempts.length,
    successful: paymentAttempts.filter((attempt) => attempt.status === "success" || attempt.status === "paid").length,
  };
  const latestPaymentAttemptFailure = failedPaymentAttempts[0] ?? null;
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthPayments = payments.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const currentMonthRevenue = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const thisYearPayments = payments.filter((p) => new Date(p.created_at).getFullYear() === currentYear);
  const thisYearRevenue = thisYearPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const avgPaymentValue = payments.length > 0 ? totalRevenue / payments.length : 0;

  const monthlyData: Record<string, { month: string; revenue: number; count: number }> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    monthlyData[key] = { month: label, revenue: 0, count: 0 };
  }
  for (const p of payments) {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyData[key]) {
      monthlyData[key].revenue += Number(p.amount || 0);
      monthlyData[key].count += 1;
    }
  }
  const chartData = Object.values(monthlyData);
  const uniqueAttemptProviders = Array.from(new Set(paymentAttempts.map((attempt) => attempt.provider).filter(Boolean))).sort();
  const filteredPaymentAttempts = useMemo(() => {
    const query = attemptQuery.trim().toLowerCase();
    return paymentAttempts.filter((attempt) => {
      if (attemptStatusFilter !== "all" && attempt.status !== attemptStatusFilter) return false;
      if (attemptProviderFilter !== "all" && attempt.provider !== attemptProviderFilter) return false;

      if (!query) return true;

      const haystack = [
        attempt.payment_id,
        attempt.provider,
        attempt.attempt_type,
        attempt.status,
        attempt.error_code,
        attempt.error_description,
        attempt.provider_order_id,
        attempt.provider_payment_id,
        attempt.invoice_id,
        attempt.subscription_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [attemptQuery, attemptProviderFilter, attemptStatusFilter, paymentAttempts]);
  const attemptsByPaymentId = useMemo(() => {
    const grouped = new Map<string, PaymentAttemptRow[]>();

    for (const attempt of paymentAttempts) {
      const key = attempt.payment_id;
      const current = grouped.get(key) ?? [];
      current.push(attempt);
      grouped.set(key, current);
    }

    for (const list of grouped.values()) {
      list.sort((left, right) => new Date(String(left.created_at)).getTime() - new Date(String(right.created_at)).getTime());
    }

    return grouped;
  }, [paymentAttempts]);
  const retryStateByAttemptId = useMemo(() => {
    const grouped = new Map<string, {
      canRetry: boolean;
      cooldownRemainingMinutes: number | null;
      retryCount: number;
      retryLimit: number;
      label: string;
      detail: string;
    }>();
    const retryLimit = data.billingGatewayHealth.retryLimit;
    const cooldownMinutes = data.billingGatewayHealth.retryCooldownMinutes;

    for (const attempts of attemptsByPaymentId.values()) {
      attempts.forEach((attempt, index) => {
        if (attempt.status !== "failed") {
          return;
        }

        const retryCount = index;
        const cooldownRemainingMinutes = Math.max(
          0,
          Math.ceil((new Date(attempt.created_at).getTime() + cooldownMinutes * 60 * 1000 - Date.now()) / (60 * 1000)),
        );
        const retryLimitReached = retryCount >= retryLimit;
        const retryCoolingDown = cooldownRemainingMinutes > 0;
        const canRetry = !retryLimitReached && !retryCoolingDown && !data.billingGatewayHealth.retryBlocked && data.billingGatewayHealth.status !== "risk";
        const label = retryLimitReached
          ? `Limit ${retryCount}/${retryLimit}`
          : retryCoolingDown
            ? `Cooldown ${cooldownRemainingMinutes}m`
            : `Retry ${retryCount + 1}/${retryLimit}`;

        grouped.set(attempt.id, {
          canRetry,
          cooldownRemainingMinutes: retryCoolingDown ? cooldownRemainingMinutes : null,
          retryCount,
          retryLimit,
          label,
          detail: retryLimitReached
            ? "Retry limit reached for this payment chain."
            : retryCoolingDown
              ? `Retry reopens in ${cooldownRemainingMinutes} minute(s).`
              : "Retry is available now.",
        });
      });
    }

    return grouped;
  }, [attemptsByPaymentId, data.billingGatewayHealth.retryBlocked, data.billingGatewayHealth.retryCooldownMinutes, data.billingGatewayHealth.retryLimit, data.billingGatewayHealth.status]);
  const billingAuditEntries = useMemo(() => {
    return data.auditTimeline
      .filter(isBillingAuditEvent)
      .slice(0, 8);
  }, [data.auditTimeline]);

  const gymRevenue: Record<string, { name: string; revenue: number; count: number }> = {};
  for (const p of payments) {
    const gymId = String(p.gym_id || "unknown");
    if (!gymRevenue[gymId]) {
      const gym = data.gyms.find((g) => g.id === gymId);
      gymRevenue[gymId] = { name: gym?.name ?? "Unknown Gym", revenue: 0, count: 0 };
    }
    gymRevenue[gymId].revenue += Number(p.amount || 0);
    gymRevenue[gymId].count += 1;
  }
  const subscription = data.record.subscription;
  const selectedAttempt: PaymentAttemptRow | null = filteredPaymentAttempts.find((attempt) => attempt.id === selectedAttemptId) ?? filteredPaymentAttempts[0] ?? null;
  const attemptExportCount = filteredPaymentAttempts.length;
  const attemptVisibleCount = paymentAttempts.length;
  const selectedAttemptTimeline = useMemo(() => buildBillingTimeline(data, selectedAttempt?.id ?? null), [data, selectedAttempt?.id]);
  const exportHref = `/api/super-admin/organizations/${data.record.organization.id}/billing/export?format=csv`;
  const exportPdfHref = `/api/super-admin/organizations/${data.record.organization.id}/billing/export?format=pdf`;
  const jumpToProviderHealth = () => {
    document.getElementById("billing-provider-health")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const toggleAttemptExpanded = (attemptId: string) => {
    setExpandedAttemptIds((current) => (current.includes(attemptId) ? current.filter((id) => id !== attemptId) : [...current, attemptId]));
  };

  const handleRetryAttempt = (attempt: PaymentAttemptRow) => {
    if (attempt.status !== "failed") {
      return;
    }

    setRetryingAttemptId(attempt.id);
    startRetryTransition(() => {
      void retryPaymentAttemptAction({
        paymentAttemptId: attempt.id,
        organizationId: data.record.organization.id,
        stepUpEmail: criticalSuperAdminEmail,
        reason: `Manual retry from super-admin billing console for attempt ${attempt.payment_id ?? attempt.id}.`,
      }).then((result) => {
        if (result.status === "success") {
          showToast(result.message ?? "Retry initiated.", "success");
          setSelectedAttemptId(attempt.id);
          router.refresh();
          return;
        }

        showToast(result.message ?? "Retry failed.", "error");
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Retry failed.";
        showToast(message, "error");
      }).finally(() => {
        setRetryingAttemptId(null);
      });
    });
  };

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RevenueKpiCard label="Total Revenue" value={formatCurrency(totalRevenue)} />
        <RevenueKpiCard label="Current Month Revenue" value={formatCurrency(currentMonthRevenue)} />
        <RevenueKpiCard label="Average Payment Value" value={formatCurrency(avgPaymentValue)} />
        <RevenueKpiCard label="Revenue This Year" value={formatCurrency(thisYearRevenue)} />
      </div>

      <OrgSubscriptionControlPanel criticalSuperAdminEmail={criticalSuperAdminEmail} data={data} />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="size-5" />
              <h3 className="text-xl font-black">Subscription Snapshot</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <InfoPill label="Package" value={subscription.packageName ?? "Unassigned"} />
            <InfoPill label="Status" value={subscription.status ? formatEnterpriseLabel(subscription.status) : "Unassigned"} />
            <InfoPill label="Billing engine" value={subscription.billingEngine ? formatEnterpriseLabel(subscription.billingEngine) : "Not configured"} />
            <InfoPill label="Auto renew" value={(data.record.subscription.status === "cancelled" || data.record.subscription.status === "expired") ? "Disabled" : "Enabled"} />
            <InfoPill label="Next billing" value={subscription.nextBillingDate ? formatDateTime(subscription.nextBillingDate) : "Not scheduled"} />
            <InfoPill label="Expires" value={subscription.expiresAt ? formatDate(subscription.expiresAt) : "Never"} />
            <InfoPill label="Latest invoice" value={subscription.latestInvoiceId ? shortId(subscription.latestInvoiceId) : "None"} />
            <InfoPill label="Latest payment" value={subscription.latestPaymentId ? shortId(subscription.latestPaymentId) : "None"} />
            <InfoPill label="Provider sub ID" value={subscription.providerSubscriptionId ? shortId(subscription.providerSubscriptionId) : "None"} />
            <InfoPill label="Dunning status" value={subscription.dunningStatus ? formatEnterpriseLabel(subscription.dunningStatus) : "Clear"} />
            <InfoPill label="Dunning attempts" value={subscription.dunningAttempts !== null && subscription.dunningAttempts !== undefined ? String(subscription.dunningAttempts) : "0"} />
            <InfoPill label="Next retry" value={subscription.dunningNextRetry ? formatDateTime(subscription.dunningNextRetry) : "Not scheduled"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5" />
              <h3 className="text-xl font-black">Billing Health</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Current billing state</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {subscription.status === "trial"
                  ? "This organization is still in trial."
                  : subscription.status === "active"
                    ? "Billing is active and ready for the next invoice cycle."
                    : subscription.status === "suspended"
                      ? "Billing is suspended and needs recovery."
                      : subscription.status === "cancelled"
                        ? "Billing is cancelled. Reactivation requires a manual action."
                        : "Billing state is not yet assigned."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatChip label="Invoice records" value={String(subscriptionInvoices.length)} />
              <StatChip label="Payment records" value={String(subscriptionPayments.length)} />
              <StatChip label="Outstanding" value={formatCurrency(subscriptionOutstanding)} />
              <StatChip label="Collected MTD" value={formatCurrency(subscriptionCollectedMtd)} />
            </div>
            {subscription.dunningStatus && subscription.dunningStatus !== "clear" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Dunning needs attention. Retry window: {subscription.dunningNextRetry ? formatDateTime(subscription.dunningNextRetry) : "not scheduled"}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-black">Revenue Trend (Last 12 Months)</h3>
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href={exportHref} variant="secondary" size="sm">
                <Download className="mr-2 size-4" />
                Export CSV
              </ButtonLink>
              <ButtonLink href={exportPdfHref} variant="secondary" size="sm">
                <Download className="mr-2 size-4" />
                Print PDF
              </ButtonLink>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.some((d) => d.revenue > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#888" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#888" />
                  <Tooltip
                    contentStyle={{ fontSize: 13 }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">No revenue data available for chart rendering.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <InfoCard title="Subscription" icon={<CreditCard className="size-5" />}>
          <Line label="Package" value={data.record.subscription.packageName ?? "Unassigned"} />
          <Line label="Status" value={data.record.subscription.status ? formatEnterpriseLabel(data.record.subscription.status) : "Unassigned"} />
          <Line label="Started" value={formatDate(data.record.subscription.startedAt)} />
          <Line label="Expires" value={data.record.subscription.expiresAt ? formatDate(data.record.subscription.expiresAt) : "Never"} />
          <Line label="Member limit" value={limitLabel(data.record.subscription.maxMembers)} />
          <Line label="Branch limit" value={limitLabel(data.record.subscription.maxBranches)} />
        </InfoCard>

        {Object.keys(gymRevenue).length > 1 && (
          <Card>
            <CardHeader>
              <h3 className="text-xl font-black">Revenue by Gym</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.values(gymRevenue).map((gym) => (
                <div key={gym.name} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">{gym.name}</p>
                    <p className="text-sm font-black">{formatCurrency(gym.revenue)}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{gym.count} payment(s)</span>
                    <span>·</span>
                    <span>{totalRevenue > 0 ? `${((gym.revenue / totalRevenue) * 100).toFixed(1)}%` : "0%"}</span>
                  </div>
                  {totalRevenue > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(gym.revenue / totalRevenue) * 100}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ReceiptText className="size-5" />
              <h3 className="text-xl font-black">Subscription Invoices</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscriptionInvoices.length > 0 ? subscriptionInvoices.slice(0, 6).map((invoice) => (
              <div className="rounded-md border border-border bg-background p-4" key={invoice.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{String(invoice.invoice_number ?? invoice.id).slice(0, 18)}</p>
                  <EnterpriseStatusBadge status={String(invoice.status ?? "unknown")} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatCurrency(Number(invoice.total_amount ?? 0), String(invoice.currency ?? "INR"))}
                  {" · "}
                  Due {invoice.due_at ? formatDateTime(invoice.due_at) : "Not set"}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <InfoPill label="Provider" value={invoice.payment_provider ? formatEnterpriseLabel(invoice.payment_provider) : "Not set"} />
                  <InfoPill label="Dunning" value={invoice.dunning_status ? formatEnterpriseLabel(invoice.dunning_status) : "Clear"} />
                </div>
              </div>
            )) : (
              <p className="text-sm font-semibold text-muted-foreground">No subscription invoices were found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock3 className="size-5" />
              <h3 className="text-xl font-black">Subscription Payments</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscriptionPayments.length > 0 ? subscriptionPayments.slice(0, 6).map((payment) => (
              <div className="rounded-md border border-border bg-background p-4" key={payment.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{String(payment.payment_number ?? payment.id).slice(0, 18)}</p>
                  <EnterpriseStatusBadge status={String(payment.status ?? "unknown")} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatCurrency(Number(payment.amount ?? 0), String(payment.currency ?? "INR"))}
                  {" · "}
                  {payment.payment_method_id ? `Method ${shortId(payment.payment_method_id)}` : "Method not linked"}
                  {" · "}
                  {payment.paid_at ? formatDateTime(payment.paid_at) : formatDateTime(payment.created_at)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {payment.provider_signature_verified === true ? "Provider signature verified" : payment.provider_signature_verified === false ? "Provider signature unverified" : "Signature status unknown"}
                </p>
              </div>
            )) : (
              <p className="text-sm font-semibold text-muted-foreground">No subscription payments were found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            <h3 className="text-xl font-black">Payment Attempts</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatChip label="Total attempts" value={String(paymentAttemptSummary.total)} />
            <StatChip label="Succeeded" value={String(paymentAttemptSummary.successful)} />
            <StatChip label="Retrying" value={String(paymentAttemptSummary.retrying)} />
            <StatChip label="Failed" value={String(paymentAttemptSummary.failed)} />
          </div>
          <ProviderHealthPanel health={data.billingGatewayHealth} />
          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={attemptQuery}
                onChange={(event) => setAttemptQuery(event.target.value)}
                placeholder="Search payment id, provider id, error text, invoice, or subscription"
                className="pl-9"
              />
            </div>
            <select
              className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
              value={attemptStatusFilter}
              onChange={(event) => setAttemptStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="created">Created</option>
              <option value="processing">Processing</option>
              <option value="retrying">Retrying</option>
              <option value="failed">Failed</option>
              <option value="success">Success</option>
              <option value="paid">Paid</option>
            </select>
            <select
              className="h-11 rounded-md border border-border bg-surface px-3 text-sm"
              value={attemptProviderFilter}
              onChange={(event) => setAttemptProviderFilter(event.target.value)}
            >
              <option value="all">All providers</option>
              {uniqueAttemptProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {formatEnterpriseLabel(provider)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAttemptQuery("");
                setAttemptStatusFilter("all");
                setAttemptProviderFilter("all");
              }}
            >
              <X className="mr-2 size-4" />
              Clear
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{attemptExportCount} matching attempts</span>
            <span>{attemptVisibleCount} total attempts loaded</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-3">
              {latestPaymentAttemptFailure ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  <p className="font-black">Latest failure</p>
                  {(() => {
                    const failureInsight = formatBillingFailureInsight(
                      latestPaymentAttemptFailure.provider,
                      latestPaymentAttemptFailure.error_code,
                      latestPaymentAttemptFailure.error_description,
                    );

                    return (
                      <>
                        <p className="mt-1 font-semibold text-red-900">{failureInsight.headline}</p>
                        <p className="mt-1 text-red-800">{failureInsight.detail}</p>
                      </>
                    );
                  })()}
                  <p className="mt-2 text-xs text-red-700">
                    {latestPaymentAttemptFailure.provider ? `Provider: ${formatEnterpriseLabel(latestPaymentAttemptFailure.provider)}` : "Provider unknown"}
                    {latestPaymentAttemptFailure.provider_order_id ? ` · Order ${shortId(String(latestPaymentAttemptFailure.provider_order_id))}` : ""}
                    {latestPaymentAttemptFailure.provider_payment_id ? ` · Payment ${shortId(String(latestPaymentAttemptFailure.provider_payment_id))}` : ""}
                  </p>
                </div>
              ) : null}

              {filteredPaymentAttempts.length > 0 ? filteredPaymentAttempts.slice(0, 6).map((attempt) => {
                const isSelected = attempt.id === selectedAttempt?.id;
                const isExpanded = expandedAttemptIds.includes(attempt.id);
                return (
                  <div
                    key={attempt.id}
                    className={`rounded-md border p-4 transition ${
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-border-strong"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        onClick={() => setSelectedAttemptId(attempt.id)}
                      >
                        <div className="mt-0.5 rounded-md border border-border bg-surface p-1">
                          <CreditCard className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black">{String(attempt.payment_id ?? attempt.id).slice(0, 16)}</p>
                            <EnterpriseStatusBadge status={String(attempt.status ?? "unknown")} />
                          </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {formatCurrency(Number(attempt.amount ?? 0), String(attempt.currency ?? "INR"))}
                            {" · "}
                            {attempt.attempt_type ? formatEnterpriseLabel(String(attempt.attempt_type)) : "Unknown attempt"}
                            {" · "}
                            {attempt.provider ? formatEnterpriseLabel(String(attempt.provider)) : "Provider unknown"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatBillingFailureInsight(attempt.provider, attempt.error_code, attempt.error_description).headline}
                            {attempt.created_at ? ` · ${formatDateTime(attempt.created_at)}` : ""}
                          </p>
                          {attempt.status === "failed" ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] ${toneChipClass("warning")}`}>
                                {retryStateByAttemptId.get(attempt.id)?.label ?? "Retry unavailable"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {retryStateByAttemptId.get(attempt.id)?.detail ?? "Retry state unavailable."}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAttemptExpanded(attempt.id)}
                        className="shrink-0"
                      >
                        {isExpanded ? <ChevronDown className="mr-1 size-4" /> : <ChevronRight className="mr-1 size-4" />}
                        {isExpanded ? "Collapse" : "Expand"}
                      </Button>
                      {attempt.status === "failed" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRetryAttempt(attempt)}
                          disabled={isRetrying && retryingAttemptId === attempt.id ? true : !(retryStateByAttemptId.get(attempt.id)?.canRetry ?? false)}
                          className="shrink-0"
                        >
                          {isRetrying && retryingAttemptId === attempt.id
                            ? "Retrying..."
                            : retryStateByAttemptId.get(attempt.id)?.canRetry
                              ? "Retry gateway"
                              : "Retry locked"}
                        </Button>
                      ) : null}
                    </div>
                    {isExpanded ? (
                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <InfoPill label="Invoice" value={attempt.invoice_id ? shortId(attempt.invoice_id) : "Not linked"} />
                          <InfoPill label="Subscription" value={attempt.subscription_id ? shortId(attempt.subscription_id) : "Not linked"} />
                          <CopyFieldPill label="Provider order" value={attempt.provider_order_id} />
                          <CopyFieldPill label="Provider payment" value={attempt.provider_payment_id} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <CopyFieldPill label="Error code" value={attempt.error_code} />
                          <InfoPill label="Retry state" value={retryStateByAttemptId.get(attempt.id)?.label ?? "Retry unavailable"} />
                        </div>
                        <RetryHistoryList
                          attempts={attemptsByPaymentId.get(attempt.payment_id) ?? [attempt]}
                          currentAttemptId={attempt.id}
                          retryStateByAttemptId={retryStateByAttemptId}
                          onOpenProviderHealth={jumpToProviderHealth}
                        />
                        <CompactBillingTimeline entries={buildBillingTimeline(data, attempt.id)} />
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <p className="text-sm font-semibold text-muted-foreground">No payment attempts were found.</p>
              )}
            </div>

            <div className="rounded-md border border-border bg-surface p-4">
              {selectedAttempt ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{String(selectedAttempt.payment_id ?? selectedAttempt.id)}</p>
                    <EnterpriseStatusBadge status={String(selectedAttempt.status ?? "unknown")} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoPill label="Amount" value={formatCurrency(Number(selectedAttempt.amount ?? 0), String(selectedAttempt.currency ?? "INR"))} />
                    <InfoPill label="Attempt type" value={selectedAttempt.attempt_type ? formatEnterpriseLabel(selectedAttempt.attempt_type) : "Not set"} />
                    <InfoPill label="Provider" value={selectedAttempt.provider ? formatEnterpriseLabel(selectedAttempt.provider) : "Unknown"} />
                    <InfoPill label="Created" value={selectedAttempt.created_at ? formatDateTime(selectedAttempt.created_at) : "Not set"} />
                    <InfoPill label="Updated" value={selectedAttempt.updated_at ? formatDateTime(selectedAttempt.updated_at) : "Not set"} />
                    <CopyFieldPill label="Invoice" value={selectedAttempt.invoice_id} />
                    <CopyFieldPill label="Subscription" value={selectedAttempt.subscription_id} />
                    <CopyFieldPill label="Payment ID" value={selectedAttempt.provider_payment_id} />
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Failure reason</p>
                    <FailureInsightCard attempt={selectedAttempt} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CopyFieldPill label="Provider order" value={selectedAttempt.provider_order_id} />
                    <CopyFieldPill label="Error code" value={selectedAttempt.error_code} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <JsonPreviewCard label="Request payload" value={selectedAttempt.request_payload} />
                    <JsonPreviewCard label="Response payload" value={selectedAttempt.response_payload} />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <CompactBillingTimeline entries={selectedAttemptTimeline} />
                    <CompactAuditTrailPanel entries={billingAuditEntries} />
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">Select an attempt to inspect provider ids, payloads, and failure context.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-black">Operational Payments</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.length > 0 ? payments.map((payment) => (
            <div className="rounded-md border border-border bg-background p-4" key={payment.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-black">{payment.payment_number}</p>
                <EnterpriseStatusBadge status={payment.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{formatCurrency(Number(payment.amount), payment.currency)} · {formatEnterpriseLabel(payment.method)} · {formatDateTime(payment.created_at)}</p>
            </div>
          )) : (
            <p className="text-sm font-semibold text-muted-foreground">No operational payments were found.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function RevenueKpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs reveal-up">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function InfoCard({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xl font-black">{title}</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="max-w-[65%] break-words text-right text-sm font-black">{value}</span>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortId(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function limitLabel(value: number | null) {
  if (value === null) return "Not configured";
  return value === -1 ? "Unlimited" : formatCompactNumber(value);
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-black leading-5 break-words">{value}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function JsonPreviewCard({ label, value }: { label: string; value: Json | null }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
        {formatJsonPreview(value)}
      </p>
    </div>
  );
}

function ProviderHealthPanel({ health }: { health: OrganizationDetailData["billingGatewayHealth"] }) {
  return (
    <div id="billing-provider-health" className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Provider health</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] ${toneChipClass(health.status === "healthy" ? "success" : health.status === "risk" ? "warning" : "info")}`}>
              {health.status}
            </span>
            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
              {health.source === "live_org_data" ? "Live org data" : "Unknown source"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <ButtonLink href="/super-admin/payment-gateways" variant="secondary" size="sm">
            Gateway state
          </ButtonLink>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">Retry policy</p>
            <p className="mt-1 text-sm font-black">
              {health.retryBlocked
                ? "Temporarily blocked"
                : health.retryCooldownRemainingMinutes && health.retryCooldownRemainingMinutes > 0
                  ? `Cooldown ${health.retryCooldownRemainingMinutes}m`
                  : "Ready now"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoPill label="Provider" value={health.provider ? formatEnterpriseLabel(health.provider) : "Unknown"} />
        <InfoPill label="Environment" value={health.providerEnvironment ? formatEnterpriseLabel(health.providerEnvironment) : "Not set"} />
        <InfoPill label="Retry backlog" value={String(health.retryBacklog)} />
        <InfoPill label="Webhook backlog" value={String(health.webhookBacklog)} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoPill label="Last event" value={health.lastEventAt ? formatDateTime(health.lastEventAt) : "No recent event"} />
        <InfoPill label="Last failure" value={health.lastFailureAt ? formatDateTime(health.lastFailureAt) : "No recent failure"} />
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface p-3">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Retry readiness</p>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {health.retryBlocked
            ? "Retries are blocked until the live provider state settles."
            : health.retryCooldownRemainingMinutes && health.retryCooldownRemainingMinutes > 0
              ? `Retries resume in ${health.retryCooldownRemainingMinutes} minute(s).`
              : "Retries are allowed against the live provider state."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {health.retryReadyAt ? `Retry ready at ${formatDateTime(health.retryReadyAt)}.` : "Retry ready time unavailable."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {health.latestFailureMessage ?? "No provider failure message recorded in the last 7 days."}
        </p>
      </div>
    </div>
  );
}

function CopyFieldPill({ label, value }: { label: string; value: string | null | undefined }) {
  const [isCopying, setIsCopying] = useState(false);
  const text = value?.trim() ?? "";

  const handleCopy = async () => {
    if (!text) return;

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`, "success");
    } catch {
      showToast(`Failed to copy ${label.toLowerCase()}.`, "error");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        {text ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
            onClick={handleCopy}
            disabled={isCopying}
          >
            <Copy className="size-3" />
            {isCopying ? "Copying" : "Copy"}
          </button>
        ) : null}
      </div>
      <p className="mt-2 break-words text-sm font-black leading-5">{text ? shortId(text) : "Not linked"}</p>
    </div>
  );
}

function CopyFieldPillCompact({ label, value }: { label: string; value: string }) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied`, "success");
    } catch {
      showToast(`Failed to copy ${label.toLowerCase()}.`, "error");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground transition hover:text-foreground disabled:opacity-60"
      onClick={handleCopy}
      disabled={isCopying}
    >
      <Copy className="size-3" />
      {isCopying ? "Copying" : label}
    </button>
  );
}

function formatJsonPreview(value: Json | null) {
  if (value === null) return "No payload recorded.";
  if (typeof value === "string") return value.slice(0, 240);

  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 240 ? `${text.slice(0, 240)}…` : text;
  } catch {
    return "Payload could not be rendered.";
  }
}

function CompactBillingTimeline({ entries }: { entries: BillingTimelineEntry[] }) {
  const [activeCategory, setActiveCategory] = useState<BillingTimelineEntry["category"] | "all">("all");
  const [activeTone, setActiveTone] = useState<BillingTimelineEntry["tone"] | "all">("all");

  const categoryCounts = useMemo(() => entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    return counts;
  }, {}), [entries]);

  const toneCounts = useMemo(() => entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.tone] = (counts[entry.tone] ?? 0) + 1;
    return counts;
  }, {}), [entries]);

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (activeCategory !== "all" && entry.category !== activeCategory) {
      return false;
    }

    if (activeTone !== "all" && entry.tone !== activeTone) {
      return false;
    }

    return true;
  }), [activeCategory, activeTone, entries]);

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Billing timeline</p>
        <span className="text-xs text-muted-foreground">{filteredEntries.length} of {entries.length} events</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {([
          ["all", "All"],
          ["invoice", `Invoices (${categoryCounts.invoice ?? 0})`],
          ["attempt", `Attempts (${categoryCounts.attempt ?? 0})`],
          ["payment", `Payments (${categoryCounts.payment ?? 0})`],
          ["subscription", `Subscription (${categoryCounts.subscription ?? 0})`],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveCategory(value)}
            className={`rounded-full border px-3 py-1 text-xs font-black transition ${
              activeCategory === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {([
          ["all", "All statuses"],
          ["success", `Success (${toneCounts.success ?? 0})`],
          ["warning", `Attention (${toneCounts.warning ?? 0})`],
          ["info", `Info (${toneCounts.info ?? 0})`],
          ["neutral", `Neutral (${toneCounts.neutral ?? 0})`],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTone(value)}
            className={`rounded-full border px-3 py-1 text-xs font-black transition ${
              activeTone === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filteredEntries.length > 0 ? filteredEntries.map((entry, index) => (
          <div key={`${entry.label}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`mt-0.5 size-2.5 rounded-full ${
                  entry.tone === "success"
                    ? "bg-emerald-500"
                    : entry.tone === "warning"
                      ? "bg-amber-500"
                      : entry.tone === "info"
                        ? "bg-sky-500"
                        : "bg-muted-foreground"
                }`}
              />
              {index < entries.length - 1 ? <div className="h-full w-px flex-1 bg-border" /> : null}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black">{entry.label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] ${toneChipClass(entry.tone)}`}>
                  {entry.tone}
                </span>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">
                  {entry.category}
                </span>
                {entry.timestamp ? <span className="text-xs text-muted-foreground">{formatDateTime(entry.timestamp)}</span> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{entry.details}</p>
            </div>
          </div>
        )) : (
          <p className="text-sm font-semibold text-muted-foreground">No timeline events match the selected filters.</p>
        )}
      </div>
    </div>
  );
}

function RetryHistoryList({
  attempts,
  currentAttemptId,
  retryStateByAttemptId,
  onOpenProviderHealth,
}: {
  attempts: PaymentAttemptRow[];
  currentAttemptId: string;
  retryStateByAttemptId: Map<string, {
    canRetry: boolean;
    cooldownRemainingMinutes: number | null;
    retryCount: number;
    retryLimit: number;
    label: string;
    detail: string;
  }>;
  onOpenProviderHealth: () => void;
}) {
  const history = [...attempts].sort((left, right) => new Date(String(left.created_at)).getTime() - new Date(String(right.created_at)).getTime());

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Retry history</p>
        <span className="text-xs text-muted-foreground">{history.length} attempt(s)</span>
      </div>
      <div className="mt-3 space-y-2">
        {history.map((historyAttempt, index) => {
          const insight = formatBillingFailureInsight(historyAttempt.provider, historyAttempt.error_code, historyAttempt.error_description);
          const isCurrent = historyAttempt.id === currentAttemptId;
          const retryState = retryStateByAttemptId.get(historyAttempt.id);

          return (
            <div key={historyAttempt.id} className={`rounded-lg border p-3 ${isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black">Attempt {index + 1}</p>
                  <EnterpriseStatusBadge status={historyAttempt.status} />
                  {historyAttempt.status === "failed" && retryState ? (
                    <button
                      type="button"
                      onClick={onOpenProviderHealth}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] transition hover:opacity-80 ${toneChipClass("warning")}`}
                      title="Jump to provider health"
                    >
                      {retryState.label}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {historyAttempt.provider_order_id ? <CopyFieldPillCompact label="Order" value={historyAttempt.provider_order_id} /> : null}
                  {historyAttempt.provider_payment_id ? <CopyFieldPillCompact label="Payment" value={historyAttempt.provider_payment_id} /> : null}
                  {historyAttempt.error_code ? <CopyFieldPillCompact label="Code" value={historyAttempt.error_code} /> : null}
                  {historyAttempt.created_at ? <span className="text-xs text-muted-foreground">{formatDateTime(historyAttempt.created_at)}</span> : null}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{insight.headline}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {retryState
                  ? retryState.detail
                  : historyAttempt.provider_order_id
                    ? `Order ${shortId(historyAttempt.provider_order_id)}`
                    : "No provider order"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FailureInsightCard({ attempt }: { attempt: PaymentAttemptRow }) {
  const insight = formatBillingFailureInsight(attempt.provider, attempt.error_code, attempt.error_description);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] ${toneChipClass(insight.tone)}`}>
          {insight.headline}
        </span>
        {attempt.provider ? <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] text-muted-foreground">{formatEnterpriseLabel(attempt.provider)}</span> : null}
      </div>
      <p className="text-sm font-semibold text-foreground">{insight.detail}</p>
      <p className="text-xs text-muted-foreground">
        {attempt.error_code ? `Code ${attempt.error_code}` : "No provider error code"}
        {attempt.provider_payment_id ? ` · Payment ${shortId(attempt.provider_payment_id)}` : ""}
      </p>
    </div>
  );
}

function CompactAuditTrailPanel({ entries }: { entries: OrganizationAuditTimelineItem[] }) {
  const severityCounts = useMemo(() => entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.severity] = (counts[entry.severity] ?? 0) + 1;
    return counts;
  }, {}), [entries]);

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Audit trail</p>
        <span className="text-xs text-muted-foreground">{entries.length} event(s)</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["info", "notice", "warning", "critical"] as const).map((severity) => (
          <span
            key={severity}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] ${auditSeverityChipClass(severity)}`}
          >
            {severity} {severityCounts[severity] ?? 0}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {entries.length > 0 ? entries.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black">{formatEnterpriseLabel(entry.action)}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.08em] ${auditSeverityChipClass(entry.severity)}`}>
                {entry.severity}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.actorName ?? entry.actorEmail ?? "System"}
              {entry.createdAt ? ` · ${formatDateTime(entry.createdAt)}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {entry.entityType}
              {entry.entityId ? `:${shortId(entry.entityId)}` : ""}
            </p>
          </div>
        )) : (
          <p className="text-sm font-semibold text-muted-foreground">No billing-related audit events were found.</p>
        )}
      </div>
    </div>
  );
}

function auditSeverityChipClass(severity: OrganizationAuditTimelineItem["severity"]) {
  switch (severity) {
    case "critical":
      return "bg-red-50 text-red-700 border-red-200";
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "notice":
      return "bg-sky-50 text-sky-700 border-sky-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function isBillingAuditEvent(entry: OrganizationAuditTimelineItem) {
  const action = entry.action.toLowerCase();
  const entityType = entry.entityType.toLowerCase();

  return (
    action.includes("billing")
    || action.includes("payment")
    || action.includes("subscription")
    || action.includes("retry")
    || entityType.includes("payment")
    || entityType.includes("subscription")
  );
}

function toneChipClass(tone: BillingTimelineEntry["tone"]) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "warning":
      return "bg-amber-50 text-amber-700 border border-amber-200";
    case "info":
      return "bg-sky-50 text-sky-700 border border-sky-200";
    default:
      return "bg-slate-50 text-slate-600 border border-slate-200";
  }
}
