import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getPasswordPolicies } from "@/features/security/services/security-password-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PasswordPolicyManager } from "./password-manager";

async function PasswordsContent() {
  await requireRole(["super_admin"], "/super-admin");
  const policy = await getPasswordPolicies();
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: locked } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "suspended");

  return (
    <div className="space-y-6">
      <Link href="/super-admin/security" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="h-4 w-4" /> Back to Security</Link>
      <div><h1 className="text-2xl font-bold tracking-tight">Password Policy & Risk Engine</h1><p className="text-sm text-muted-foreground mt-0.5">Manage password policies, check password strength, and detect breached credentials.</p></div>
      <PasswordPolicyManager policy={policy as Record<string, unknown> | null} userCount={count ?? 0} lockedCount={locked ?? 0} />
    </div>
  );
}

export default function PasswordsPage() {
  return <Suspense fallback={<div className="h-96 bg-muted rounded-xl animate-pulse" />}><PasswordsContent /></Suspense>;
}
