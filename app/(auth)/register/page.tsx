import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Create Account",
  description: "Create an Apex Performance Club member portal account.",
  path: "/register"
});

export default function RegisterPage() {
  return (
    <AuthShell
      description="Create your member account, verify your email, and keep your training, payments, and class activity in one place."
      eyebrow="Member Registration"
      title="Your training account starts here."
    >
      <RegisterForm />
    </AuthShell>
  );
}
