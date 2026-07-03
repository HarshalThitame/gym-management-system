import { Activity, AlertTriangle, BarChart3, Building2, CreditCard, Dumbbell, Gauge, Globe2, MessageSquare, ShieldCheck, Tags, UsersRound, Wrench } from "lucide-react";
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
import { CustomizableDashboard } from "@/features/organization-owner/components/customizable-dashboard";
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
import { LeadsModule } from "@/features/organization-owner/components/modules/LeadsModule";
import { CustomRolesModule } from "@/features/organization-owner/components/modules/CustomRolesModule";
import { CustomRoleAssignmentPanel } from "@/features/organization-owner/components/modules/CustomRoleAssignmentPanel";
import { EquipmentModule } from "@/features/organization-owner/components/modules/EquipmentModule";
import type { OrganizationOwnerModule } from "@/features/organization-owner/lib/organization-owner-modules";
import { organizationOwnerModules } from "@/features/organization-owner/lib/organization-owner-modules";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { ModuleSearchParams } from "@/features/organization-owner/services/module-data-resolver";
import { normalizePackageTier } from "@/features/entitlement/package-tier";
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

