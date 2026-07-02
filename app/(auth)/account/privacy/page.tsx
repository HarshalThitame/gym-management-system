import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConsentManager } from "@/features/gdpr/components/consent-manager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Settings",
  description: "Manage your privacy preferences, data export, and account deletion."
};

export default async function PrivacySettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Privacy Settings</h1>
        <p className="text-muted-foreground mt-2">
          Control your data, manage consents, and exercise your data rights
        </p>
      </div>

      <ConsentManager />

      {/* Data Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Download className="size-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Export Your Data</CardTitle>
              <CardDescription>
                Download a copy of all your personal data in JSON format
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Your export will include your profile, memberships, payment history, attendance records, and consent history.
          </p>
          <form action={async () => {
            "use server";
            const { requestDataExportAction } = await import("@/features/gdpr/actions/gdpr-actions");
            const result = await requestDataExportAction({ status: "idle" });
            if (result.status === "success") {
              // Redirect or show success
            }
          }}>
            <Button variant="accent">
              <Download className="size-4 mr-2" />
              Request Data Export
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Trash2 className="size-5 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-lg text-red-600">Delete Your Account</CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            This action is irreversible. All your personal data, memberships, and history will be permanently deleted.
            We&apos;ll review your request within 30 days.
          </p>
          <form action={async (formData: FormData) => {
            "use server";
            const { requestAccountDeletionAction } = await import("@/features/gdpr/actions/gdpr-actions");
            await requestAccountDeletionAction({ status: "idle" }, formData);
          }}>
            <div className="space-y-3">
              <input
                type="text"
                name="reason"
                placeholder="Reason for deletion (optional)"
                className="w-full h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
              <Button variant="destructive">
                <Trash2 className="size-4 mr-2" />
                Request Account Deletion
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
