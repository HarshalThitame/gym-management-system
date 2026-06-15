import { Activity, AlertTriangle, BarChart3, Building2, CreditCard, Dumbbell, Gauge, Globe2, MessageSquare, ShieldCheck, Tags, UsersRound } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { AuditTrailViewer } from "@/features/organization-owner/components/audit-trail-viewer";
import { LanguageSwitcher } from "@/features/organization-owner/components/language-switcher";
import { ThemePreview } from "@/features/organization-owner/components/modules/ThemePreview";
import { EnterpriseDashboard } from "@/features/organization-owner/components/enterprise-dashboard";
import { AnalyticsIntelligence } from "@/features/organization-owner/components/analytics/advanced-analytics";
import { BranchesModule } from "@/features/organization-owner/components/modules/GymsModule";
import { StaffModule } from "@/features/organization-owner/components/modules/StaffModule";
import { MembersModule } from "@/features/organization-owner/components/modules/MembersModule";
import { MembershipsModule } from "@/features/organization-owner/components/modules/MembershipsModule";
import { RevenueEnterpriseModule } from "@/features/organization-owner/components/modules/RevenueModule";
import { TrainersEnterpriseModule } from "@/features/organization-owner/components/modules/TrainersModule";
import { AttendanceEnterpriseModule } from "@/features/organization-owner/components/modules/AttendanceModule";
import { ClassesEnterpriseModule } from "@/features/organization-owner/components/modules/ClassesModule";
import { CommunicationsEnterpriseModule } from "@/features/organization-owner/components/modules/CommunicationsModule";
import { AnalyticsEnterpriseModule } from "@/features/organization-owner/components/modules/AnalyticsModule";
import { BrandingEnterpriseModule } from "@/features/organization-owner/components/modules/BrandingModule";
import { DomainsEnterpriseModule } from "@/features/organization-owner/components/modules/DomainsModule";
import { BillingEnterpriseModule } from "@/features/organization-owner/components/modules/BillingModule";
import { NutritionEnterpriseModule } from "@/features/organization-owner/components/modules/NutritionModule";
import { SupportEnterpriseModule } from "@/features/organization-owner/components/modules/SupportModule";
import { ProfileEnterpriseModule } from "@/features/organization-owner/components/modules/ProfileModule";
import { SettingsEnterpriseModule } from "@/features/organization-owner/components/modules/SettingsModule";
import { SecurityEnterpriseModule } from "@/features/organization-owner/components/modules/SecurityModule";
import type { OrganizationOwnerModule } from "@/features/organization-owner/lib/organization-owner-modules";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { ModuleSearchParams } from "@/features/organization-owner/services/module-data-resolver";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import { cn } from "@/lib/utils";

type OrganizationOwnerWorkspaceProps = {
  dashboard: OrganizationOwnerDashboard;
  module?: OrganizationOwnerModule | undefined;
  moduleData?: unknown | undefined;
  moduleFilters?: ModuleSearchParams | undefined;
  planContext?: OrgPlanContext | null | undefined;
};

const packageClasses: Record<string, string> = {
  lite: "border-slate-200 bg-slate-50 text-slate-700",
  standard: "border-indigo-200 bg-indigo-50 text-indigo-700",
  premium: "border-amber-200 bg-amber-50 text-amber-800"
};

export function OrganizationOwnerWorkspace({ dashboard, module, moduleData, moduleFilters, planContext }: OrganizationOwnerWorkspaceProps) {
  if (module) {
    return (
      <div className="space-y-8">
        <ModuleHero dashboard={dashboard} module={module} />
        <ModuleContent dashboard={dashboard} module={module} moduleData={moduleData} moduleFilters={moduleFilters} planContext={planContext} />
      </div>
    );
  }

  return <OrganizationOwnerDashboardView dashboard={dashboard} planContext={planContext} />;
}

function OrganizationOwnerDashboardView({ dashboard, planContext }: { dashboard: OrganizationOwnerDashboard; planContext?: OrgPlanContext | null | undefined }) {
  return <EnterpriseDashboard dashboard={dashboard} planContext={planContext} />;
}

function ModuleHero({ dashboard, module }: { dashboard: OrganizationOwnerDashboard; module: OrganizationOwnerModule }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground md:text-xs md:tracking-[0.14em]">{dashboard.organization.name}</p>
          <h2 className="mt-2 text-xl font-black md:mt-3 md:text-3xl lg:text-4xl">{module.title}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground md:mt-3 md:text-sm md:leading-6">{module.description}</p>
        </div>
        <span className="hidden size-10 text-accent md:block [&>svg]:size-full" aria-hidden="true">{module.icon}</span>
      </div>
    </section>
  );
}

const MODULE_FEATURE_MAP: Record<string, { feature: string; name: string; plan: string }> = {
  gyms: { feature: "member_management", name: "Branch Management", plan: "Starter" },
  branches: { feature: "member_management", name: "Branch Management", plan: "Starter" },
  staff: { feature: "staff_management", name: "Staff Management", plan: "Growth" },
  members: { feature: "member_management", name: "Member Management", plan: "Starter" },
  memberships: { feature: "member_management", name: "Membership Management", plan: "Starter" },
  revenue: { feature: "billing_invoices", name: "Revenue & Billing", plan: "Starter" },
  trainers: { feature: "trainer_management", name: "Trainer Management", plan: "Starter" },
  attendance: { feature: "attendance_reports", name: "Attendance", plan: "Starter" },
  classes: { feature: "class_booking", name: "Class Booking", plan: "Growth" },
  communications: { feature: "whatsapp_integration", name: "Communications", plan: "Growth" },
  analytics: { feature: "advanced_reports", name: "Advanced Analytics", plan: "Growth" },
  branding: { feature: "custom_branding", name: "White Label Branding", plan: "Enterprise" },
  domains: { feature: "custom_domain", name: "Custom Domains", plan: "Enterprise" },
  billing: { feature: "billing_invoices", name: "Billing", plan: "Starter" },
  nutrition: { feature: "nutrition_plans", name: "Nutrition Plans", plan: "Growth" },
  support: { feature: "priority_support", name: "Priority Support", plan: "Enterprise" },
  security: { feature: "audit_logs", name: "Security & Audit", plan: "Enterprise" },
};

function ModuleContent({ dashboard, module, moduleData, moduleFilters, planContext }: { dashboard: OrganizationOwnerDashboard; module: OrganizationOwnerModule; moduleData?: unknown | undefined; moduleFilters?: ModuleSearchParams | undefined; planContext?: OrgPlanContext | null | undefined }) {
  const featureCheck = MODULE_FEATURE_MAP[module.slug];
  const isFeatureEnabled = featureCheck
    ? planContext?.features?.[featureCheck.feature as keyof typeof planContext.features]
    : true;

  if (!isFeatureEnabled) {
    return (
      <FeatureLocked
        description={`${featureCheck?.name ?? "This feature"} is available on ${featureCheck?.plan ?? "higher"} plans.`}
        featureName={featureCheck?.name ?? module.title}
        requiredPlan={featureCheck?.plan ?? "Growth"}
      />
    );
  }

  const common = { dashboard, moduleData, moduleFilters };
  switch (module.slug) {
    case "gyms":
    case "branches": return <BranchesModule dashboard={dashboard} />;
    case "staff": return <StaffModule dashboard={dashboard} />;
    case "members": return <MembersModule dashboard={dashboard} />;
    case "memberships": return <MembershipsModule dashboard={dashboard} />;
    case "revenue": return <RevenueEnterpriseModule dashboard={dashboard} />;
    case "trainers": return <TrainersEnterpriseModule dashboard={dashboard} />;
    case "attendance": return <AttendanceEnterpriseModule dashboard={dashboard} />;
    case "classes": return <ClassesEnterpriseModule dashboard={dashboard} />;
    case "communications": return <CommunicationsEnterpriseModule dashboard={dashboard} />;
    case "analytics": return <AnalyticsEnterpriseModule dashboard={dashboard} />;
    case "branding": return <BrandingEnterpriseModule dashboard={dashboard} />;
    case "domains": return <DomainsEnterpriseModule dashboard={dashboard} />;
    case "billing": return <BillingEnterpriseModule dashboard={dashboard} />;
    case "nutrition": return <NutritionEnterpriseModule dashboard={dashboard} />;
    case "support": return <SupportEnterpriseModule dashboard={dashboard} />;
    case "profile": return <ProfileEnterpriseModule dashboard={dashboard} />;
    case "settings": return <SettingsEnterpriseModule dashboard={dashboard} />;
    case "security": return <SecurityEnterpriseModule dashboard={dashboard} />;
    default: return null;
  }
}

function PackageBadge({ packageName }: { packageName: string }) {
  const normalizedName = packageName.toLowerCase();

  return (
    <Badge className={cn(packageClasses[normalizedName] ?? "border-border bg-surface-muted text-muted-foreground")}>
      {packageName}
    </Badge>
  );
}


