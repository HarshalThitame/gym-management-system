import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserTwoFactorStatus } from "@/features/two-factor-auth/services/two-factor-service";
import { TwoFactorSettings } from "@/features/two-factor-auth/components/two-factor-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Security Settings",
  description: "Manage your account security settings including two-factor authentication"
};

export default async function SecuritySettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const status = await getUserTwoFactorStatus(user.id);
  const { count: remainingCodes } = await supabase
    .from("user_2fa_recovery_codes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("used_at", null);

  const currentStatus = {
    ...status,
    remainingRecoveryCodes: remainingCodes ?? 0
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Security Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account security and authentication preferences
        </p>
      </div>

      <TwoFactorSettings currentStatus={currentStatus} />

      {/* Additional Security Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Recommendations</CardTitle>
          <CardDescription>
            Follow these best practices to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-green-500/10 mt-0.5">
              <svg className="size-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Use a strong, unique password</p>
              <p className="text-sm text-muted-foreground">
                Use at least 12 characters with a mix of letters, numbers, and symbols
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-green-500/10 mt-0.5">
              <svg className="size-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Enable two-factor authentication</p>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security with an authenticator app
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-green-500/10 mt-0.5">
              <svg className="size-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Save your recovery codes</p>
              <p className="text-sm text-muted-foreground">
                Store recovery codes in a secure location in case you lose access to your authenticator
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-amber-500/10 mt-0.5">
              <svg className="size-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Beware of phishing attempts</p>
              <p className="text-sm text-muted-foreground">
                Never share your password or verification codes with anyone
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
