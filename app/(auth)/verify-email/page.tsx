import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResendVerificationForm } from "@/features/auth/components/resend-verification-form";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Verify Email",
  description: "Request a new Apex Performance Club email verification link.",
  path: "/verify-email"
});

export default function VerifyEmailPage() {
  return (
    <AuthShell
      description="Staff and member accounts must verify email before using protected portal features."
      eyebrow="Verification"
      title="Confirm your account identity."
    >
      <ResendVerificationForm />
    </AuthShell>
  );
}
