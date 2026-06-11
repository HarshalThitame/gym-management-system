import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PackageBadge } from "@/features/super-admin/components/subscriptions/PackageBadge";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import type { OrgFeatureFlags } from "@/lib/tenant";
import type { RoleName } from "@/types/auth";

export const metadata: Metadata = createMetadata({
  title: "Current Plan",
  description: "Current organization SaaS package details, limits, and enabled features.",
  path: "/organization/plan"
});

const organizationOwnerRole = ["organization_owner"] as const satisfies readonly RoleName[];

const featureRows: Array<{ key: FeatureBooleanKey; label: string }> = [
  { key: "qrAttendanceEnabled", label: "QR Attendance" },
  { key: "biometricAttendanceEnabled", label: "Biometric Attendance" },
  { key: "rfidAttendanceEnabled", label: "RFID Attendance" },
  { key: "classSchedulingEnabled", label: "Class Scheduling" },
  { key: "trainerAssignmentEnabled", label: "Trainer Assignment" },
  { key: "razorpayEnabled", label: "Online Payments via Razorpay" },
  { key: "communicationsEnabled", label: "Member Communications and Campaigns" },
  { key: "aiEnabled", label: "AI Recommendations" },
  { key: "advancedReportsEnabled", label: "Advanced Reports and Exports" },
  { key: "customDomainEnabled", label: "Custom Domain and White Label" },
  { key: "apiAccessEnabled", label: "API Access" }
];

type FeatureBooleanKey = Exclude<keyof OrgFeatureFlags, "maxMembers" | "maxBranches">;

type SubscriptionStartQuery = {
  select(columns: "started_at"): SubscriptionStartQuery;
  eq(column: "organization_id", value: string): SubscriptionStartQuery;
  order(column: "started_at", options: { ascending: boolean }): SubscriptionStartQuery;
  limit(count: number): SubscriptionStartQuery;
  maybeSingle(): Promise<{ data: { started_at: string | null } | null; error: { message: string } | null }>;
};

type SubscriptionStartClient = {
  from(table: "organization_subscriptions"): SubscriptionStartQuery;
};

export default async function OrganizationPlanPage() {
  await requireAuth("/organization/plan");
  const context = await requireRole(organizationOwnerRole, "/organization/plan");

  if (!context.organizationId) {
    redirect("/unauthorized?reason=organization_scope");
  }

  const [planContext, startedAt] = await Promise.all([
    getOrgPlanContext(context.organizationId),
    getSubscriptionStartedAt(context.organizationId)
  ]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Subscription</p>
        <h1 className="mt-2 text-3xl font-black">Current Plan</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Review your current package, subscription status, enabled features, and plan capacity for this organization.
        </p>
      </section>

      {planContext.isTrialing ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold leading-6 text-cyan-900">
          Your trial ends on {formatDate(planContext.trialEndsAt) ?? "the configured trial end date"}. Upgrade before it ends to continue uninterrupted access.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <PackageBadge packageName={planContext.packageName} />
            <Badge variant={getStatusVariant(planContext.status)}>{formatStatus(planContext.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PlanField label="Package" value={planContext.packageName} />
            <PlanField label="Status" value={formatStatus(planContext.status)} />
            <PlanField label="Start Date" value={formatDate(startedAt) ?? "Not available"} />
            <PlanField label="Expiry Date" value={formatDate(planContext.expiresAt) ?? "No expiry"} />
            <PlanField label="Member Limit" value={formatLimit(planContext.features.maxMembers)} />
            <PlanField label="Branch Limit" value={formatLimit(planContext.features.maxBranches)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Feature Access</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Feature availability is resolved from the package assigned to this organization.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {featureRows.map((feature) => (
              <FeatureAccessRow
                enabled={planContext.features[feature.key]}
                key={feature.key}
                label={feature.label}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-black">Need to upgrade?</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Contact us to upgrade your plan or add more capacity.
          </p>
          <ButtonLink href={`mailto:${supportEmail}`} variant="accent">Contact Support</ButtonLink>
        </CardContent>
      </Card>
    </div>
  );
}

// TODO: Replace with the real support email before launch.
const supportEmail = "support@yourdomain.com";

async function getSubscriptionStartedAt(organizationId: string) {
  try {
    const supabase = await createSupabaseServerClient() as unknown as SubscriptionStartClient;
    const { data, error } = await supabase
      .from("organization_subscriptions")
      .select("started_at")
      .eq("organization_id", organizationId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to resolve subscription start date", {
        organizationId,
        message: error.message
      });
      return null;
    }

    return parseDate(data?.started_at ?? null);
  } catch (error) {
    console.error("Unexpected subscription start date failure", {
      organizationId,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return null;
  }
}

function FeatureAccessRow({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-muted p-4">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {enabled ? (
        <span className="inline-flex items-center gap-2 text-sm font-black text-green-700">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Enabled
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground">
          <XCircle className="size-4" aria-hidden="true" />
          Locked
        </span>
      )}
    </div>
  );
}

function PlanField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-black">{value}</p>
    </div>
  );
}

function getStatusVariant(status: string) {
  if (status === "active") {
    return "success";
  }

  if (status === "trial") {
    return "info";
  }

  if (status === "suspended" || status === "cancelled" || status === "expired") {
    return "error";
  }

  return "neutral";
}

function formatLimit(value: number) {
  return value === -1 ? "Unlimited" : String(value);
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(value);
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
