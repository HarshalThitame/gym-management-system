import type { Metadata } from "next";
import { Download, ShieldCheck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { OrganizationApprovalReviewPanel } from "@/features/super-admin/components/organizations/OrganizationApprovalReviewPanel";
import { getOrganizationApprovalInboxData, normalizeApprovalInboxFilters } from "@/features/super-admin/services/organization-management-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

type SuperAdminApprovalsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const approvalActions = ["all", "transfer_owner", "suspend", "delete", "permanent_purge", "bulk_suspend", "bulk_assign_package"];
const approvalStatuses = ["all", "pending", "approved", "rejected", "cancelled", "expired"];

export const metadata: Metadata = createMetadata({
  title: "Organization Approval Inbox",
  description: "Review MFA-protected approvals for Super Admin organization governance.",
  path: "/super-admin/approvals"
});

export default async function SuperAdminApprovalsPage({ searchParams }: SuperAdminApprovalsPageProps) {
  await requireRole(["super_admin"], "/super-admin/approvals");
  const query = searchParams ? await searchParams : {};
  const data = await getOrganizationApprovalInboxData(normalizeApprovalInboxFilters({
    query: stringParam(query.q) ?? "",
    status: stringParam(query.status) ?? "pending",
    action: stringParam(query.action) ?? "all",
    page: Number(stringParam(query.page) ?? 1),
    pageSize: Number(stringParam(query.pageSize) ?? 25)
  }));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="Pending approvals" value={data.summary.pending} variant={data.summary.pending > 0 ? "warning" : "success"} />
        <SummaryCard label="Expired approvals" value={data.summary.expired} variant={data.summary.expired > 0 ? "error" : "neutral"} />
        <SummaryCard label="Reviewed approvals" value={data.summary.reviewed} variant="neutral" />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="size-5 text-secondary" />
                <h1 className="text-3xl font-black md:text-4xl">Organization Approval Inbox</h1>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Review high-risk tenant changes across all organizations. Approvals are protected by fresh MFA verification and expire automatically.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/super-admin/organizations" variant="secondary">Organization Registry</ButtonLink>
              <ButtonLink href={buildApprovalExportUrl(data.filters)} variant="secondary">
                <Download aria-hidden="true" className="size-4" />
                Audit CSV
              </ButtonLink>
            </div>
          </div>
          <form className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_210px_120px_auto]">
            <input className="h-11 rounded-md border border-border bg-surface px-3" name="q" placeholder="Search organization, action, requester, reason..." defaultValue={data.filters.query} />
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="status" defaultValue={data.filters.status}>
              {approvalStatuses.map((status) => <option key={status} value={status}>{formatEnterpriseLabel(status)}</option>)}
            </select>
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="action" defaultValue={data.filters.action}>
              {approvalActions.map((action) => <option key={action} value={action}>{formatEnterpriseLabel(action)}</option>)}
            </select>
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="pageSize" defaultValue={String(data.filters.pageSize)}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} rows</option>)}
            </select>
            <Button type="submit" variant="primary">Filter</Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 text-sm font-semibold text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>Showing {data.pagination.from}-{data.pagination.to} of {formatCompactNumber(data.pagination.total)} approvals.</span>
            <span>Review requires fresh MFA verification.</span>
          </div>
          <OrganizationApprovalReviewPanel
            approvals={data.approvals}
            emptyText="No approvals match these filters."
            showOrganization
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-muted-foreground">Page {data.pagination.page} of {data.pagination.totalPages}</p>
            <div className="flex gap-2">
              <ButtonLink aria-disabled={data.pagination.page <= 1} href={buildApprovalsUrl(data.filters, data.pagination.page - 1)} variant="secondary">Previous</ButtonLink>
              <ButtonLink aria-disabled={data.pagination.page >= data.pagination.totalPages} href={buildApprovalsUrl(data.filters, data.pagination.page + 1)} variant="secondary">Next</ButtonLink>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, variant }: { label: string; value: number; variant: "success" | "warning" | "error" | "neutral" }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-black">{formatCompactNumber(value)}</p>
        </div>
        <EnterpriseStatusBadge status={variant} />
      </CardContent>
    </Card>
  );
}

function buildApprovalsUrl(filters: ReturnType<typeof normalizeApprovalInboxFilters>, page: number) {
  const nextPage = Math.max(1, page);
  const params = new URLSearchParams();
  if (filters.query) {
    params.set("q", filters.query);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.action !== "all") {
    params.set("action", filters.action);
  }
  params.set("page", String(nextPage));
  params.set("pageSize", String(filters.pageSize));
  return `/super-admin/approvals?${params.toString()}`;
}

function buildApprovalExportUrl(filters: ReturnType<typeof normalizeApprovalInboxFilters>) {
  const params = new URLSearchParams();
  params.set("scope", "approvals");
  params.set("format", "csv");
  if (filters.query) {
    params.set("q", filters.query);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.action !== "all") {
    params.set("action", filters.action);
  }
  return `/api/super-admin/organizations/export?${params.toString()}`;
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
