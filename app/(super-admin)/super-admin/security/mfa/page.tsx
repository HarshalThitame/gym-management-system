import type { Metadata } from "next";
import { SuperAdminMfaPanel } from "@/features/super-admin/components/security/SuperAdminMfaPanel";
import { getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Super Admin MFA",
  description: "Enroll and verify MFA for critical Super Admin organization actions.",
  path: "/super-admin/security/mfa"
});

export default async function SuperAdminMfaPage() {
  const context = await requireRole(["super_admin"], "/super-admin/security/mfa");
  const requiredSuperAdminEmail = getCriticalSuperAdminEmail();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-secondary">Security Center</p>
        <h1 className="mt-2 text-3xl font-black md:text-4xl">Super Admin MFA</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Configure TOTP multi-factor authentication for protected organization transfer, suspend, activate, delete, and bulk operations.
        </p>
      </div>
      <SuperAdminMfaPanel currentEmail={context.email} requiredEmail={requiredSuperAdminEmail} />
    </div>
  );
}
