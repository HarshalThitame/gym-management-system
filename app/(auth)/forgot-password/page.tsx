import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Forgot Password",
  description: "Request a secure Apex Performance Club password reset link.",
  path: "/forgot-password"
});

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      description="Reset links are sent securely through Supabase Auth and expire automatically."
      eyebrow="Account Recovery"
      title="Recover account access without exposing member data."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
