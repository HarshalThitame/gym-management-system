import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { getOrganizationPlanSummary } from "@/features/entitlement";
import { createMetadata } from "@/lib/seo/metadata";
import { LockedFeaturePageClient } from "./locked-feature-client";

export const metadata: Metadata = createMetadata({
  title: "Feature Locked",
  description: "This feature is not available on your current plan.",
  path: "/organization/locked-feature",
});

type Props = {
  searchParams: Promise<{ feature?: string; reason?: string }>;
};

export default async function LockedFeatureRoute({ searchParams }: Props) {
  const context = await requireOrganizationOwner("/organization");
  const params = await searchParams;
  const summary = await getOrganizationPlanSummary(context.organizationId).catch(() => null);

  if (!context.organizationId) redirect("/unauthorized?reason=organization_scope");

  return (
    <LockedFeaturePageClient
      feature={params.feature ?? ""}
      reason={params.reason ?? ""}
      planSummary={summary}
    />
  );
}
