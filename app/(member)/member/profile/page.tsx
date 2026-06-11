import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { requirePrimaryRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Member Profile",
  description: "Manage your Apex member profile and emergency contact.",
  path: "/member/profile"
});

export default async function MemberProfilePage() {
  const context = await requirePrimaryRole(["member"], "/member/profile");

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
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-black">Profile</h2>
        <p className="text-sm leading-6 text-muted-foreground">Keep contact and emergency details current for gym operations and trainer safety.</p>
      </CardHeader>
      <CardContent>
        <ProfileForm profile={context.profile} />
      </CardContent>
    </Card>
  );
}
