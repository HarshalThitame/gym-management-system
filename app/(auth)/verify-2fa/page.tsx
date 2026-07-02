import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { TwoFactorVerify } from "@/features/two-factor-auth/components/two-factor-verify";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkUserHasTwoFactor } from "@/features/two-factor-auth/services/two-factor-service";

export const metadata: Metadata = {
  title: "Two-Factor Authentication",
  description: "Verify your identity with two-factor authentication"
};

type VerifyTwoFactorPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function VerifyTwoFactorPage({ searchParams }: VerifyTwoFactorPageProps) {
  const { next } = await searchParams;
  const nextPath = next ?? "/member";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/verify-2fa?next=${encodeURIComponent(nextPath)}`);
  }

  // Check if user has 2FA enabled
  const has2fa = await checkUserHasTwoFactor(user.id);

  if (!has2fa) {
    // User doesn't have 2FA, redirect to their destination
    redirect(nextPath);
  }

  // Get available methods
  const { data: methods } = await supabase
    .from("user_2fa_methods")
    .select("method_type")
    .eq("user_id", user.id)
    .eq("is_enabled", true)
    .eq("is_verified", true);

  const availableMethods = methods?.map((m) => m.method_type) ?? ["totp"];

  return (
    <AuthShell>
      <TwoFactorVerify availableMethods={availableMethods} nextPath={nextPath} />
    </AuthShell>
  );
}
