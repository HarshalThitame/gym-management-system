"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HydrationSafeDate } from "@/components/ui/hydration-safe-date";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { reviewOrganizationApprovalAction } from "../../actions/organization-actions";
import type { OrganizationApprovalRequest } from "../../services/organization-management-service";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function OrganizationApprovalReviewPanel({
  approvals,
  criticalSuperAdminEmail,
  emptyText = "No governance approvals exist for this organization yet.",
  showOrganization = false
}: {
  approvals: OrganizationApprovalRequest[];
  criticalSuperAdminEmail: string;
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
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-5 text-secondary" />
              <h3 className="text-2xl font-black">Maker-Checker Approvals</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Critical organization changes require approval from a different Super Admin with a fresh MFA session.
            </p>
          </div>
          <Badge variant={pendingApprovals.length > 0 ? "warning" : "success"}>{pendingApprovals.length} pending</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormMessage state={state} />
        {approvals.length > 0 ? approvals.map((approval) => (
          <div className="rounded-md border border-border bg-background p-4" key={approval.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <EnterpriseStatusBadge status={approval.status} />
                  <EnterpriseStatusBadge status={approval.action} />
                  <p className="font-black">{formatEnterpriseLabel(approval.action)}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Requested <HydrationSafeDate date={approval.requestedAt} format="datetime" /> by {approval.requestedByName ?? approval.requestedBy ?? "Unknown"}.
                </p>
                {showOrganization ? (
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    Organization: {approval.organizationName ?? approval.organizationId} {approval.organizationSlug ? `(${approval.organizationSlug})` : ""}
                  </p>
                ) : null}
                <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Clock aria-hidden="true" className="size-3" />
                  Expires <HydrationSafeDate date={approval.expiresAt} format="datetime" />
                </p>
                {approval.reason ? <p className="mt-2 text-sm font-semibold text-muted-foreground">Reason: {approval.reason}</p> : null}
              </div>
              {approval.status !== "pending" ? (
                <div className="rounded-md border border-border bg-surface p-3 text-sm font-semibold text-muted-foreground">
                  Reviewed by {approval.reviewedByName ?? approval.reviewedBy ?? "Unknown"}{" "}
                  {approval.reviewedAt ? (
                    <>
                      on <HydrationSafeDate date={approval.reviewedAt} format="datetime" />
                    </>
                  ) : null}.
                </div>
              ) : null}
            </div>

            {approval.diff.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-md border border-border bg-surface">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Before</th>
                      <th className="px-3 py-2">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approval.diff.map((item) => (
                      <tr className="border-b border-border last:border-0" key={item.field}>
                        <td className="px-3 py-2 font-black">{item.label}</td>
                        <td className="max-w-xs break-words px-3 py-2 text-muted-foreground">{item.before}</td>
                        <td className="max-w-xs break-words px-3 py-2 font-semibold">{item.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {approval.status === "pending" ? (
              <form action={formAction} className="mt-4 grid gap-3 lg:grid-cols-[160px_1fr_1fr_1fr_auto]">
                <input name="approvalId" type="hidden" value={approval.id} />
                <select aria-label="Approval decision" className={selectClass} name="decision" defaultValue="approve">
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="cancel">Cancel</option>
                </select>
                <Input name="confirmation" placeholder="Type APPROVE, REJECT, or CANCEL" />
                <Input autoComplete="email" name="stepUpEmail" placeholder={`Type ${criticalSuperAdminEmail}`} type="email" />
                <Textarea className="min-h-11" name="reviewNote" placeholder="Review note" />
                <SubmitButton />
              </form>
            ) : null}
          </div>
        )) : (
          <div className="rounded-md border border-dashed border-border bg-background p-5 text-sm font-semibold text-muted-foreground">
            {emptyText}
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900 md:flex-row md:items-center md:justify-between">
          <span>Approval requires a different Super Admin, {criticalSuperAdminEmail}, and a fresh MFA verification.</span>
          <ButtonLink href="/super-admin/security/mfa" target="_blank" rel="noreferrer" size="sm" variant="secondary">
            Open MFA
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" variant="primary">
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" />}
      Review
    </Button>
  );
}

export default OrganizationApprovalReviewPanel;
