import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { validateFeatureKeyIntegrity } from "@/features/entitlement/feature-key-validator";
import { getEntitlementHealthReport } from "@/features/super-admin/services/entitlement-health-service";
import { FeatureAuditIntegritySection } from "@/features/super-admin/components/feature-audit-integrity-section";

export const metadata: Metadata = {
  title: "Feature Audit – Integrity Checks",
};

export default async function FeatureAuditIntegrityPage() {
  await requireRole(["super_admin"], "/super-admin/feature-audit/integrity");

  const [integrity, healthReport] = await Promise.all([
    validateFeatureKeyIntegrity(),
    getEntitlementHealthReport(),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">Feature Key Integrity</h1>
        </div>
        <p className="text-muted-foreground">
          Runtime validation of feature key consistency across the codebase,
          MODULE_FEATURE_MAP, sidebar modules, and database rows.
          <Link href="/super-admin/feature-audit" className="text-primary hover:underline ml-2">
            Back to Feature Audit →
          </Link>
        </p>
      </div>
      <FeatureAuditIntegritySection integrity={integrity} healthReport={healthReport} />
    </div>
  );
}
