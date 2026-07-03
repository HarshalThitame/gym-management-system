import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { formatCompactNumber, formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { OrganizationOwnerModule } from "@/features/organization-owner/lib/organization-owner-modules";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { ModuleSearchParams } from "@/features/organization-owner/services/module-data-resolver";
import { normalizePackageTier } from "@/features/entitlement/package-tier";
import type { OrgPlanContext } from "@/lib/tenant/plan-context";
import { cn } from "@/lib/utils";

const EnterpriseDashboard = dynamic(() => import("@/features/organization-owner/components/enterprise-dashboard").then(m => ({ default: m.EnterpriseDashboard })));
const CustomizableDashboard = dynamic(() => import("@/features/organization-owner/components/customizable-dashboard").then(m => ({ default: m.CustomizableDashboard })));
const BranchesModule = dynamic(() => import("@/features/organization-owner/components/modules/GymsModule").then(m => ({ default: m.BranchesModule })));
const StaffModule = dynamic(() => import("@/features/organization-owner/components/modules/StaffModule").then(m => ({ default: m.StaffModule })));
const MembersModule = dynamic(() => import("@/features/organization-owner/components/modules/MembersModule").then(m => ({ default: m.MembersModule })));
const MembershipsModule = dynamic(() => import("@/features/organization-owner/components/modules/MembershipsModule").then(m => ({ default: m.MembershipsModule })));
const RevenueEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/RevenueModule").then(m => ({ default: m.RevenueEnterpriseModule })));
const TrainersEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/TrainersModule").then(m => ({ default: m.TrainersEnterpriseModule })));
const AttendanceEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/AttendanceModule").then(m => ({ default: m.AttendanceEnterpriseModule })));
const ClassesEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/ClassesModule").then(m => ({ default: m.ClassesEnterpriseModule })));
const CommunicationsEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/CommunicationsModule").then(m => ({ default: m.CommunicationsEnterpriseModule })));
const AnalyticsEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/AnalyticsModule").then(m => ({ default: m.AnalyticsEnterpriseModule })));
const BrandingEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/BrandingModule").then(m => ({ default: m.BrandingEnterpriseModule })));
const DomainsEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/DomainsModule").then(m => ({ default: m.DomainsEnterpriseModule })));
const BillingEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/BillingModule").then(m => ({ default: m.BillingEnterpriseModule })));
const NutritionEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/NutritionModule").then(m => ({ default: m.NutritionEnterpriseModule })));
const SupportEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/SupportModule").then(m => ({ default: m.SupportEnterpriseModule })));
const ProfileEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/ProfileModule").then(m => ({ default: m.ProfileEnterpriseModule })));
const SettingsEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/SettingsModule").then(m => ({ default: m.SettingsEnterpriseModule })));
const SecurityEnterpriseModule = dynamic(() => import("@/features/organization-owner/components/modules/SecurityModule").then(m => ({ default: m.SecurityEnterpriseModule })));
const LeadsModule = dynamic(() => import("@/features/organization-owner/components/modules/LeadsModule").then(m => ({ default: m.LeadsModule })));
const CustomRolesModule = dynamic(() => import("@/features/organization-owner/components/modules/CustomRolesModule").then(m => ({ default: m.CustomRolesModule })));
const EquipmentModule = dynamic(() => import("@/features/organization-owner/components/modules/EquipmentModule").then(m => ({ default: m.EquipmentModule })));

type OrganizationOwnerWorkspaceProps = {
  dashboard: OrganizationOwnerDashboard;
  module?: OrganizationOwnerModule | undefined;
  moduleData?: unknown | undefined;
  moduleFilters?: ModuleSearchParams | undefined;
  planContext?: OrgPlanContext | null | undefined;
};

const packageClasses: Record<string, string> = {
  starter: "border-slate-200 bg-slate-50 text-slate-700",
  growth: "border-indigo-200 bg-indigo-50 text-indigo-700",
  enterprise: "border-amber-200 bg-amber-50 text-amber-800"
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
  const hasCustomDashboards = planContext?.features?.customDashboardsKpis ?? false;

  if (hasCustomDashboards) {
    return (
      <div className="space-y-6">
        <EnterpriseDashboard dashboard={dashboard} planContext={planContext} />
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Customizable Dashboard</p>
          <p className="mt-1 text-sm text-muted-foreground">Drag, reorder, and toggle widgets to build your perfect dashboard layout. Changes are saved to your account.</p>
        </div>
        <CustomizableDashboard dashboard={dashboard} />
      </div>
    );
  }

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

// Module slug → page component (feature gating handled by route guard in [module]/page.tsx)
function ModuleContent({ dashboard, module, moduleData, moduleFilters, planContext }: { dashboard: OrganizationOwnerDashboard; module: OrganizationOwnerModule; moduleData?: unknown | undefined; moduleFilters?: ModuleSearchParams | undefined; planContext?: OrgPlanContext | null | undefined }) {
  void moduleData; void moduleFilters;
  switch (module.slug) {
    case "gyms":
    case "branches": return <BranchesModule dashboard={dashboard} />;
    case "staff": return <StaffModule dashboard={dashboard} />;
    case "members": return <MembersModule dashboard={dashboard} />;
    case "memberships": return <MembershipsModule dashboard={dashboard} />;
    case "revenue": return <RevenueEnterpriseModule dashboard={dashboard} />;
    case "trainers": return <TrainersEnterpriseModule dashboard={dashboard} planContext={planContext} />;
    case "attendance": return <AttendanceEnterpriseModule dashboard={dashboard} />;
    case "classes": return <ClassesEnterpriseModule dashboard={dashboard} {...(moduleData ? { moduleData: moduleData as { items: Record<string, unknown>[]; crossBranchCounts?: Record<string, number> } } : {})} />;
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
    case "leads": return <LeadsModule dashboard={dashboard} moduleFilters={moduleFilters} />;
    case "custom-roles": return <CustomRolesModule dashboard={dashboard} moduleData={moduleData as never} moduleFilters={moduleFilters} hasFeature={planContext?.features?.customRolesGranularPermissions ?? false} />;
    case "equipment": return <EquipmentModule dashboard={dashboard} />;
    default: return null;
  }
}

function PackageBadge({ packageName }: { packageName: string }) {
  const normalizedName = normalizePackageTier(packageName) ?? packageName.toLowerCase();

  return (
    <Badge className={cn(packageClasses[normalizedName] ?? "border-border bg-surface-muted text-muted-foreground")}>
      {packageName}
    </Badge>
  );
}

