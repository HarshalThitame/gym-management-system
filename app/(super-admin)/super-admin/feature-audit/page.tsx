import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { buildFeatureAuditReport } from "@/features/super-admin/services/feature-audit-service";
import { validateFeatureKeyIntegrity } from "@/features/entitlement/feature-key-validator";
import { getEntitlementHealthReport } from "@/features/super-admin/services/entitlement-health-service";
import { FeatureAuditView } from "@/features/super-admin/components/feature-audit-view";
import { FeatureAuditIntegritySection } from "@/features/super-admin/components/feature-audit-integrity-section";

export const metadata: Metadata = {
  title: "Feature Availability Audit",
};

export default async function FeatureAuditPage() {
  await requireRole(["super_admin"], "/super-admin/feature-audit");

  const [report, integrity, healthReport] = await Promise.all([
    buildFeatureAuditReport(),
    validateFeatureKeyIntegrity(),
    getEntitlementHealthReport(),
  ]);

  return (
    <div>
      <FeatureAuditView report={report} />
      <FeatureAuditIntegritySection
        integrity={integrity}
        healthReport={healthReport}
      />
    </div>
  );
}
