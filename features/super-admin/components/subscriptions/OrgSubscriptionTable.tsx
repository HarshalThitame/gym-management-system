import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OrgSubscriptionSummary, PackageRow, SubscriptionStatus } from "../../services/subscription-service";
import { AssignPackageModal } from "./AssignPackageModal";
import { PackageBadge } from "./PackageBadge";

type OrgSubscriptionTableProps = {
  organizations: OrgSubscriptionSummary[];
  packages: PackageRow[];
};

const statusClasses: Record<SubscriptionStatus, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  trial: "border-blue-200 bg-blue-50 text-blue-700",
  expired: "border-red-200 bg-red-50 text-red-700",
  suspended: "border-orange-200 bg-orange-50 text-orange-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-700"
};

export function OrgSubscriptionTable({ organizations, packages }: OrgSubscriptionTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Organizations</p>
            <h2 className="mt-2 text-2xl font-black">Package Assignments</h2>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{organizations.length.toLocaleString("en-IN")} organizations in platform scope</p>
        </div>
      </CardHeader>
      <CardContent>
        {organizations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-3 py-3">Organization</th>
                  <th className="px-3 py-3">Package</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Started</th>
                  <th className="px-3 py-3">Expires</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {organizations.map((organization) => (
                  <tr className="align-middle" key={organization.organizationId}>
                    <td className="px-3 py-4">
                      <p className="font-black text-foreground">{organization.organizationName}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{organization.organizationContact ?? "No billing contact"}</p>
                    </td>
                    <td className="px-3 py-4">
                      <PackageBadge packageName={organization.packageName} />
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={organization.status} />
                    </td>
                    <td className="px-3 py-4 font-semibold text-muted-foreground">{formatDate(organization.startedAt)}</td>
                    <td className="px-3 py-4 font-semibold text-muted-foreground">{formatDate(organization.expiresAt)}</td>
                    <td className="px-3 py-4 text-right">
                      <AssignPackageModal organization={organization} packages={packages} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-md border border-border bg-background p-5 text-sm font-semibold text-muted-foreground">
            No organizations are available for subscription assignment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) {
    return <Badge className="border-border bg-surface-muted text-muted-foreground">Unassigned</Badge>;
  }

  return (
    <Badge className={cn(statusClasses[status])}>
      {formatStatus(status)}
    </Badge>
  );
}

function formatStatus(value: SubscriptionStatus) {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}
