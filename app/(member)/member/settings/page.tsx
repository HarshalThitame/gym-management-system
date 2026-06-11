import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmailSettingsForm, PasswordSettingsForm } from "@/features/profile/components/account-settings-forms";
import { requirePrimaryRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Account Settings",
  description: "Manage member account email and password settings.",
  path: "/member/settings"
});

export default async function MemberSettingsPage() {
  const context = await requirePrimaryRole(["member"], "/member/settings");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Email</h2>
          <p className="text-sm leading-6 text-muted-foreground">Email changes require confirmation before becoming active.</p>
        </CardHeader>
        <CardContent>
          <EmailSettingsForm email={context.email ?? ""} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Password</h2>
          <p className="text-sm leading-6 text-muted-foreground">Password changes are logged for audit and security review.</p>
        </CardHeader>
        <CardContent>
          <PasswordSettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
