import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, CreditCard, FileText, History, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DeleteDocumentForm, MemberLifecycleForms } from "@/features/memberships/components/member-lifecycle-forms";
import { MembershipStatusBadge } from "@/features/memberships/components/membership-status-badge";
import { formatMoney, getRemainingDays } from "@/features/memberships/lib/business-rules";
import { getMemberProfile, listActiveMembershipPlans } from "@/features/memberships/services/membership-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import { createMetadata } from "@/lib/seo/metadata";

type MemberProfilePageProps = {
  params: Promise<{ memberId: string }>;
};

export async function generateMetadata({ params }: MemberProfilePageProps): Promise<Metadata> {
  const { memberId } = await params;

  return createMetadata({
    title: "Member Profile",
    description: `Member membership profile ${memberId}.`,
    path: `/admin/members/${memberId}`
  });
}

export default async function AdminMemberProfilePage({ params }: MemberProfilePageProps) {
  const scope = await requireGymAdminScope("/admin/members");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "member_management", actionName: "admin.member.profile.read" });
  const { memberId } = await params;
  const [profile, plans] = await Promise.all([
    getMemberProfile(memberId),
    listActiveMembershipPlans(scope.gymId)
  ]);

  if (!profile || profile.member.gym_id !== scope.gymId) {
    notFound();
  }

  const currentMembership = profile.currentMembership;
  const currentPlan = profile.currentPlan;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl font-black">{profile.member.full_name}</h2>
            <Badge>{profile.member.member_code}</Badge>
            <MembershipStatusBadge status={currentMembership?.status ?? "none"} />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{profile.member.phone} · {profile.member.email ?? "No email"} · Joined {profile.member.joined_at}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail={currentPlan?.name ?? "No active plan"} icon={<CreditCard className="size-5" />} label="Current Plan" value={currentPlan?.plan_type.replace("_", " ") ?? "None"} />
        <StatCard detail={currentMembership?.end_date ?? "No expiry date"} icon={<CalendarDays className="size-5" />} label="Remaining Days" value={currentMembership ? String(getRemainingDays(currentMembership.end_date)) : "0"} />
        <StatCard detail="Attendance connects in Phase 7" icon={<UserRound className="size-5" />} label="Attendance" value="Ready" />
        <StatCard detail={currentMembership ? formatMoney(currentMembership.total_amount) : "No invoice"} icon={<FileText className="size-5" />} label="Payment" value={currentMembership?.payment_status ?? "none"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Personal Information</h3>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <ProfileField label="Phone" value={profile.member.phone} />
              <ProfileField label="Email" value={profile.member.email ?? "-"} />
              <ProfileField label="Date of birth" value={profile.member.date_of_birth ?? "-"} />
              <ProfileField label="Gender" value={profile.member.gender?.replaceAll("_", " ") ?? "-"} />
              <ProfileField label="Emergency contact" value={profile.member.emergency_contact_name ?? "-"} />
              <ProfileField label="Emergency phone" value={profile.member.emergency_contact_phone ?? "-"} />
              <ProfileField className="sm:col-span-2" label="Address" value={profile.member.address ?? "-"} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Membership Information</h3>
          </CardHeader>
          <CardContent>
            {currentMembership && currentPlan ? (
              <dl className="grid gap-4 text-sm">
                <ProfileField label="Plan" value={currentPlan.name} />
                <ProfileField label="Access level" value={currentPlan.access_level} />
                <ProfileField label="Start date" value={currentMembership.start_date} />
                <ProfileField label="Expiry date" value={currentMembership.end_date} />
                <ProfileField label="Invoice" value={currentMembership.invoice_number ?? "-"} />
                <ProfileField label="Amount" value={formatMoney(currentMembership.total_amount)} />
              </dl>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">No open membership assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <MemberLifecycleForms plans={plans} profile={profile} />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Documents</h3>
            <p className="text-sm leading-6 text-muted-foreground">Uploaded files are stored in the private Supabase member-documents bucket.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.documents.map((document) => (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3" key={document.id}>
                <div>
                  <p className="font-bold">{document.file_name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{document.document_type.replaceAll("_", " ")} · {Math.round(document.file_size / 1024)} KB</p>
                </div>
                <DeleteDocumentForm document={document} />
              </div>
            ))}
            {profile.documents.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No documents uploaded.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="size-5" />
              <h3 className="text-2xl font-black">Membership History</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.history.map((history) => (
              <div className="rounded-md border border-border bg-surface-muted p-3" key={history.id}>
                <p className="font-bold capitalize">{history.event.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{new Date(history.created_at).toLocaleString("en-IN")} · {history.reason ?? "No reason provided"}</p>
              </div>
            ))}
            {profile.history.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">No membership events yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold capitalize">{value}</dd>
    </div>
  );
}
