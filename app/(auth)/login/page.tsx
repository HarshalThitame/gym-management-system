import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { createMetadata } from "@/lib/seo/metadata";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export const metadata: Metadata = createMetadata({
  title: "Sign In",
  description: "Secure member, trainer, receptionist, and admin sign in for the Apex Performance Club gym management and member portal.",
  path: "/login"
});

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeRedirectPath(params.next, "/member");

  return (
    <AuthShell
      description="One secure entry point for memberships, trainer workflows, attendance, payments, and gym operations."
      eyebrow="Secure Access"
      title="Train, manage, and operate from one premium portal."
    >
      <LoginForm inactive={params.error === "inactive"} nextPath={nextPath} />
    </AuthShell>
  );
}
