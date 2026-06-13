import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrgSubscriptionSummary, PackageRow, SubscriptionStatus } from "../../services/subscription-service";
import { AssignPackageModal } from "./AssignPackageModal";
import { PackageBadge } from "./PackageBadge";

type OrgSubscriptionTableProps = {
  organizations: OrgSubscriptionSummary[];
  packages: PackageRow[];
};

const statusClasses: Record<SubscriptionStatus, string> = {
  active: "border-green-200 bg-green-50 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400",
  trial: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400",
  expired: "border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400",
  suspended: "border-orange-200 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400",
  cancelled: "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
};

export function OrgSubscriptionTable({ organizations, packages }: OrgSubscriptionTableProps) {
  if (organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
        <div className="mb-4 rounded-full bg-surface-muted p-4">
          <svg className="size-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-muted-foreground">No organizations found</p>
        <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filter criteria.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table — hidden on small screens */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm" role="table">
          <thead>
            <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              <th scope="col" className="px-3 py-3" aria-sort="ascending">Organization</th>
              <th scope="col" className="px-3 py-3">Package</th>
              <th scope="col" className="px-3 py-3">Status</th>
              <th scope="col" className="px-3 py-3">Started</th>
              <th scope="col" className="px-3 py-3">Expires</th>
              <th scope="col" className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {organizations.map((organization) => (
              <tr className="align-middle hover:bg-surface-muted/50 transition-colors" key={organization.organizationId}>
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

      {/* Mobile card list — shown on small screens */}
      <div className="md:hidden space-y-3" role="list" aria-label="Organizations list">
        {organizations.map((organization) => (
          <div
            key={organization.organizationId}
            className="rounded-lg border border-border bg-surface p-4 space-y-3"
            role="listitem"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-black text-foreground truncate">{organization.organizationName}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                  {organization.organizationContact ?? "No billing contact"}
                </p>
              </div>
              <StatusBadge status={organization.status} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-muted-foreground">Package</p>
                <PackageBadge packageName={organization.packageName} />
              </div>
              <div className="text-right space-y-1">
                <p className="font-semibold text-muted-foreground">Started</p>
                <p className="font-medium">{formatDate(organization.startedAt)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-muted-foreground">Expires</p>
                <p className="font-medium">{formatDate(organization.expiresAt)}</p>
              </div>
              <AssignPackageModal organization={organization} packages={packages} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
  const label = status ? formatStatus(status) : "Unassigned";
  if (!status) {
    return <Badge variant="neutral" aria-label={`Status: ${label}`}>{label}</Badge>;
  }

  return (
    <Badge className={cn(statusClasses[status], "flex items-center gap-1.5")} aria-label={`Status: ${label}`}>
      <span className={cn(
        "size-1.5 rounded-full shrink-0",
        status === "active" && "bg-green-500",
        status === "trial" && "bg-blue-500",
        status === "expired" && "bg-red-500",
        status === "suspended" && "bg-orange-500",
        status === "cancelled" && "bg-slate-500",
      )} aria-hidden="true" />
      {label}
    </Badge>
  );
}

function formatStatus(value: SubscriptionStatus) {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
}
