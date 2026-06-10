import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reset Password",
  description: "Set a new secure password for your Apex Performance Club account.",
  path: "/reset-password"
});

export default function ResetPasswordPage() {
  return (
    <AuthShell
      description="Choose a strong password to protect personal membership, attendance, and payment information."
      eyebrow="Password Security"
      title="Set a new portal password."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
