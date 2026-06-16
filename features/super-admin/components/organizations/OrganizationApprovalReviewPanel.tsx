"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  ShieldCheck,
  XCircle,
  ArrowRight,
  Building2,
  UserRound,
  CalendarDays,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HydrationSafeDate } from "@/components/ui/hydration-safe-date";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { InlineMfaStepUp } from "@/features/super-admin/components/security/InlineMfaStepUp";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { reviewOrganizationApprovalAction } from "../../actions/organization-actions";
import type { OrganizationApprovalRequest } from "../../services/organization-management-service";

export function OrganizationApprovalReviewPanel({
  approvals,
  emptyText = "No pending approval requests for this organization.",
  showOrganization = false
}: {
  approvals: OrganizationApprovalRequest[];
  emptyText?: string;
  showOrganization?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(reviewOrganizationApprovalAction, initialAuthActionState);
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Approval Requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and manage pending organization governance requests
          </p>
        </div>
        <Badge
          variant={pendingApprovals.length > 0 ? "warning" : "success"}
          className="px-3 py-1 text-sm"
        >
          {pendingApprovals.length} pending
        </Badge>
      </div>

      <FormMessage state={state} />

      <InlineMfaStepUp />

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="size-12 text-green-400" />
            <p className="mt-4 text-lg font-bold">{emptyText}</p>
            <p className="mt-1 text-sm text-muted-foreground">All requests have been reviewed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              formAction={formAction}
              showOrganization={showOrganization}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  formAction,
  showOrganization,
}: {
  approval: OrganizationApprovalRequest;
  formAction: (payload: FormData) => void;
  showOrganization: boolean;
}) {
  const [decision, setDecision] = useState<"approve" | "reject" | "cancel">("approve");

  const isPending = approval.status === "pending";
  const isApproved = approval.status === "approved";
  const isRejected = approval.status === "rejected";

  const actionIcon: Record<string, React.ReactNode> = {
    delete: <AlertTriangle className="size-4 text-red-500" />,
    suspend: <AlertTriangle className="size-4 text-amber-500" />,
    transfer_owner: <UserRound className="size-4 text-blue-500" />,
    bulk_suspend: <AlertTriangle className="size-4 text-amber-500" />,
    bulk_assign_package: <Building2 className="size-4 text-indigo-500" />,
    permanent_purge: <XCircle className="size-4 text-red-600" />,
  };

  const actionLabel: Record<string, string> = {
    delete: "Soft Delete Organization",
    suspend: "Suspend Organization",
    transfer_owner: "Transfer Ownership",
    bulk_suspend: "Bulk Suspend",
    bulk_assign_package: "Bulk Package Assignment",
    permanent_purge: "Permanent Purge",
  };

  const actionColor: Record<string, string> = {
    delete: "border-red-200 bg-red-50",
    suspend: "border-amber-200 bg-amber-50",
    transfer_owner: "border-blue-200 bg-blue-50",
    bulk_suspend: "border-amber-200 bg-amber-50",
    bulk_assign_package: "border-indigo-200 bg-indigo-50",
    permanent_purge: "border-red-300 bg-red-100",
  };

  return (
    <div className={`rounded-xl border ${isPending ? "border-border bg-surface shadow-sm" : isApproved ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"} overflow-hidden`}>
      {/* Top bar: action type + status + timestamp */}
      <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${isPending ? "border-b border-border" : ""}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-background shadow-xs">
            {actionIcon[approval.action] ?? <ShieldCheck className="size-4 text-secondary" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-black">{actionLabel[approval.action] ?? formatEnterpriseLabel(approval.action)}</p>
              <EnterpriseStatusBadge status={approval.status} />
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                Requested <HydrationSafeDate date={approval.requestedAt} format="datetime" />
              </span>
              <span className="flex items-center gap-1">
                <UserRound className="size-3" />
                by {approval.requestedByName ?? approval.requestedBy ?? "Unknown"}
              </span>
              {!isPending ? (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3" />
                  Reviewed by {approval.reviewedByName ?? approval.reviewedBy ?? "Unknown"}
                  {approval.reviewedAt ? (
                    <> on <HydrationSafeDate date={approval.reviewedAt} format="datetime" /></>
                  ) : null}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        {isPending && (
          <Badge variant="warning" className="shrink-0">
            <Clock className="mr-1 size-3" />
            Expires <HydrationSafeDate date={approval.expiresAt} format="date" />
          </Badge>
        )}
      </div>

      {/* Body: org info + reason + diff */}
      <div className="space-y-4 px-5 py-4">
        {/* Organization info */}
        {showOrganization && (approval.organizationName || approval.organizationId) && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-accent/10">
              <Building2 className="size-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-bold">{approval.organizationName ?? "Unknown Organization"}</p>
              {approval.organizationSlug && (
                <p className="text-xs text-muted-foreground">{approval.organizationSlug}</p>
              )}
            </div>
          </div>
        )}

        {/* Reason */}
        {approval.reason && (
          <div className="rounded-lg border border-border bg-background px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Reason</p>
            <p className="mt-1 text-sm">{approval.reason}</p>
          </div>
        )}

        {/* Diff table */}
        {approval.diff.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50">
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Field</th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Before</th>
                  <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">After</th>
                </tr>
              </thead>
              <tbody>
                {approval.diff.map((item, idx) => (
                  <tr
                    key={item.field}
                    className={`${idx < approval.diff.length - 1 ? "border-b border-border" : ""} transition-colors hover:bg-surface-muted/30`}
                  >
                    <td className="px-4 py-3 font-bold text-foreground">{item.label}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 line-through decoration-red-400">
                        {item.before}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                        {item.after}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions for pending */}
      {isPending && (
        <form action={formAction} className="border-t border-border bg-surface-muted/30 px-5 py-4">
          <input name="approvalId" type="hidden" value={approval.id} />
          <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Decision</label>
              <div className="flex gap-2">
                {(["approve", "reject", "cancel"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDecision(opt)}
                    className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-center text-sm font-bold transition-all ${
                      decision === opt
                        ? opt === "approve"
                          ? "border-green-500 bg-green-50 text-green-700 shadow-xs"
                          : opt === "reject"
                            ? "border-red-400 bg-red-50 text-red-700 shadow-xs"
                            : "border-gray-400 bg-gray-50 text-gray-700 shadow-xs"
                        : "border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground"
                    }`}
                  >
                    {opt === "approve" ? "Approve" : opt === "reject" ? "Reject" : "Cancel"}
                  </button>
                ))}
              </div>
              <input name="decision" type="hidden" value={decision} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Review Note</label>
              <Textarea
                className="min-h-20 resize-none"
                name="reviewNote"
                placeholder="Add a note for the audit trail..."
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <ShieldCheck className="mr-1 inline size-3" />
              This action requires fresh MFA verification
            </p>
            <div className="flex gap-3">
              <Button
                type="submit"
                variant={decision === "approve" ? "primary" : decision === "reject" ? "destructive" : "secondary"}
                className="min-w-32"
              >
                <SubmitContent decision={decision} />
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function SubmitContent({ decision }: { decision: string }) {
  const { pending } = useFormStatus();
  if (pending) return <><Loader2 className="mr-1 size-4 animate-spin" /> Processing...</>;

  switch (decision) {
    case "approve":
      return <><CheckCircle2 className="mr-1 size-4" /> Approve Request</>;
    case "reject":
      return <><XCircle className="mr-1 size-4" /> Reject Request</>;
    case "cancel":
      return <><AlertTriangle className="mr-1 size-4" /> Cancel Request</>;
    default:
      return "Submit";
  }
}
