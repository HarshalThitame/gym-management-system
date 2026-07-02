import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SessionManager } from "@/features/security/components/session-manager";

export const metadata: Metadata = {
  title: "Active Sessions",
  description: "Manage your active sessions and signed-in devices."
};

export default async function SessionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Active Sessions</h1>
        <p className="text-muted-foreground mt-2">
          Manage devices where you&apos;re currently signed in
        </p>
      </div>

      <SessionManager />
    </div>
  );
}
