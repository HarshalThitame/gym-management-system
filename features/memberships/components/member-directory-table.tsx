import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import type { MemberDirectoryItem } from "@/types/membership";
import { formatMoney, getRemainingDays } from "../lib/business-rules";
import { MembershipStatusBadge } from "./membership-status-badge";
import type { MembershipStatus } from "@/types/membership";

type MemberDirectoryTableProps = {
  members: MemberDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
};

export function MemberDirectoryTable({ members, total, page, pageSize }: MemberDirectoryTableProps) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-surface-muted text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Current Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr className="border-t border-border align-top" key={member.id}>
                <td className="px-4 py-4">
                  <Link className="font-black underline-offset-4 hover:underline" href={`/admin/members/${member.id}`}>{member.full_name}</Link>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{member.member_code}</p>
                </td>
                <td className="px-4 py-4">
                  <p>{member.phone}</p>
                  <p className="mt-1 text-muted-foreground">{member.email ?? "No email"}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-bold">{member.current_plan?.name ?? "Unassigned"}</p>
                  <p className="mt-1 text-muted-foreground">{member.current_plan?.plan_type?.replace("_", " ") ?? "No membership"}</p>
                </td>
                <td className="px-4 py-4">
                  <MembershipStatusBadge status={(member.current_membership?.status ?? "none") as MembershipStatus | "none"} />
                </td>
                <td className="px-4 py-4">
                  <p>{member.current_membership?.end_date ?? "-"}</p>
                  {member.current_membership ? <p className="mt-1 text-muted-foreground">{getRemainingDays(member.current_membership.end_date)} days left</p> : null}
                </td>
                <td className="px-4 py-4">{member.current_membership ? formatMoney(member.current_membership.total_amount) : "-"}</td>
                <td className="px-4 py-4">
                  <ButtonLink href={`/admin/members/${member.id}`} size="sm" variant="secondary">Open</ButtonLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm font-semibold text-muted-foreground">No members match the selected filters.</div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>Page {page} of {totalPages}. {total} total members.</p>
        <div className="flex gap-2">
          <ButtonLink href={`/admin/members?page=${Math.max(page - 1, 1)}`} size="sm" variant="secondary">Previous</ButtonLink>
          <ButtonLink href={`/admin/members?page=${Math.min(page + 1, totalPages)}`} size="sm" variant="secondary">Next</ButtonLink>
        </div>
      </div>
    </div>
  );
}
