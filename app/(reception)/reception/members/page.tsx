import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { listMembers } from "@/features/memberships/services/membership-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reception Member Support",
  description: "Reception member lookup and support workspace for assigned branch front desk operations.",
  path: "/reception/members"
});

type ReceptionMembersPageProps = {
  searchParams: Promise<{ q?: string; membershipStatus?: string; expiry?: string; page?: string }>;
};

export default async function ReceptionMembersPage({ searchParams }: ReceptionMembersPageProps) {
  const scope = await requireReceptionScope("/reception/members");
  const params = await searchParams;
  const result = await listMembers({
    gymId: scope.gymId,
    query: params.q,
    membershipStatus: params.membershipStatus,
    expiry: params.expiry,
    page: Number(params.page ?? "1"),
    pageSize: 20
  });

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Member Support</p>
        <h2 className="mt-2 text-3xl font-black">Member support desk</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Search assigned branch members, verify membership status, contact details, attendance readiness, and payment follow-up needs.</p>
      </section>
      <Card>
        <CardContent className="p-5 md:p-6">
          <form className="grid gap-4 md:grid-cols-4" method="get">
            <input className="h-11 rounded-md border border-border bg-surface px-3 md:col-span-2" name="q" placeholder="Search name, phone, email, member ID" defaultValue={params.q ?? ""} />
            <select className="h-11 rounded-md border border-border bg-surface px-3" name="membershipStatus" defaultValue={params.membershipStatus ?? "all"}>
              <option value="all">All memberships</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="frozen">Frozen</option>
              <option value="suspended">Suspended</option>
            </select>
            <button className="h-11 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground" type="submit">Search Members</button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {result.members.map((member) => (
          <div className="rounded-md border border-border bg-surface p-4" key={member.id}>
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <p className="text-lg font-black">{member.full_name}</p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{member.member_code} · {member.phone} · {member.email ?? "No email"}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Emergency: {member.emergency_contact_name ?? "not captured"} {member.emergency_contact_phone ? `· ${member.emergency_contact_phone}` : ""}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm font-black capitalize">
                {member.current_membership?.status ?? "no membership"}
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
              <Metric label="Plan" value={member.current_plan?.name ?? "Not assigned"} />
              <Metric label="Expiry" value={member.current_membership?.end_date ?? "Not available"} />
              <Metric label="Payment" value={member.current_membership?.payment_status ?? "Not available"} />
            </div>
          </div>
        ))}
        {result.members.length === 0 ? <EmptyState text="No members match the current search." /> : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">{text}</div>;
}
