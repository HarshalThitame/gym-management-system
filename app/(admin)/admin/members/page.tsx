import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberDirectoryTable } from "@/features/memberships/components/member-directory-table";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

type MembersPageProps = {
  searchParams: Promise<{
    q?: string;
    memberStatus?: string;
    membershipStatus?: string;
    planType?: string;
    expiry?: string;
    page?: string;
  }>;
};

export const metadata: Metadata = createMetadata({
  title: "Admin Members",
  description: "Protected admin member management foundation.",
  path: "/admin/members"
});

export default async function AdminMembersPage({ searchParams }: MembersPageProps) {
  const scope = await requireGymAdminScope("/admin/members");
  if (!scope.scopedOrganizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId: scope.scopedOrganizationId, featureKey: "member_management", actionName: "admin.members.read" });
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const result = await listMembers({
    gymId: scope.gymId,
    query: params.q,
    memberStatus: params.memberStatus,
    membershipStatus: params.membershipStatus,
    planType: params.planType,
    expiry: params.expiry,
    page
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Member Directory</p>
          <h2 className="mt-2 text-3xl font-black">Members</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Search, filter, sort, and open complete member membership profiles.</p>
        </div>
        <ButtonLink href="/admin/members/new" variant="accent">Add Member</ButtonLink>
      </div>

      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-5" method="get">
            <input className="h-11 rounded-md border border-border bg-surface px-3 md:col-span-2" name="q" placeholder="Search name, phone, email, ID" defaultValue={params.q ?? ""} />
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="membershipStatus" defaultValue={params.membershipStatus ?? "all"}>
              <option value="all">All memberships</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="frozen">Frozen</option>
              <option value="suspended">Suspended</option>
            </select>
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="expiry" defaultValue={params.expiry ?? "all"}>
              <option value="all">All expiry</option>
              <option value="today">Expiring today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="expired">Expired</option>
            </select>
            <button className="h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground" type="submit">Apply Filters</button>
          </form>
        </CardContent>
      </Card>

      <MemberDirectoryTable members={result.members} page={result.page} pageSize={result.pageSize} total={result.total} />
    </div>
  );
}
