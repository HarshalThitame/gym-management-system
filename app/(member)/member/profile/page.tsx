import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { requireMemberPortalAccess } from "@/features/member/lib/access";
import { PageHeader, AnimatedCardSection } from "@/features/member/components/page-wrappers";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Profile",
  description: "Manage your Apex member profile and emergency contact.",
  path: "/member/profile"
});

export default async function MemberProfilePage() {
  const context = await requireMemberPortalAccess("/member/profile");

  if (!context.profile) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Profile unavailable</h2>
          <p className="text-sm text-muted-foreground">The profile creation trigger has not produced a profile row yet.</p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Keep contact and emergency details current for gym operations and trainer safety." />
      <AnimatedCardSection>
        <Card variant="glass">
          <CardHeader>
            <h2 className="text-2xl font-black">Edit Profile</h2>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={context.profile} />
          </CardContent>
        </Card>
      </AnimatedCardSection>
    </div>
  );
}
