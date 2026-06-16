"use client";

import { useActionState, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { roleNames } from "@/types/auth";
import type { BranchRow, BranchSettingRow, BranchUserRow, ComplianceRequestRow, FeatureFlagRow, GymRow, OrganizationRow, PlatformSubscriptionRow, RetentionPolicyRow, SecurityEventRow, TenantConfigRow, TenantDomainRow } from "@/types/enterprise";
import {
  backupScopes,
  backupTypes,
  branchAccessScopes,
  branchRoles,
  branchStatuses,
  complianceRequestTypes,
  complianceStatuses,
  featureFlagStatuses,
  gymStatuses,
  healthComponents,
  healthStatuses,
  organizationStatuses,
  planTiers,
  retentionActions,
  retentionCategories,
  securityStatuses,
  subscriptionStatuses,
  tenantDomainRoutingModes,
  tenantDomainTypes
} from "@/types/enterprise";
import {
  queueBackupJobAction,
  recordHealthCheckAction,
  saveBranchAction,
  saveBranchSettingsAction,
  saveBranchUserAction,
  saveComplianceRequestAction,
  saveFeatureFlagAction,
  saveGymAction,
  saveOrganizationAction,
  saveRetentionPolicyAction,
  saveSubscriptionAction,
  saveTenantConfigAction,
  saveTenantDomainAction,
  updateSecurityEventStatusAction
} from "../actions/enterprise-actions";
import { formatEnterpriseLabel } from "../lib/business-rules";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function OrganizationForm({ organizations }: { organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveOrganizationAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Create new organization" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="org-name" label="Name" name="name" state={state}><Input id="org-name" name="name" placeholder="Apex Fitness Group" /></Field>
        <Field id="org-slug" label="Slug" name="slug" state={state}><Input id="org-slug" name="slug" placeholder="apex-fitness-group" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Status" name="status" options={organizationStatuses} />
        <Field id="org-billing" label="Billing email" name="billingEmail" state={state}><Input id="org-billing" name="billingEmail" type="email" placeholder="finance@apexfit.com" /></Field>
      </div>
      <Field id="org-domain" label="Primary domain" name="primaryDomain" state={state}><Input id="org-domain" name="primaryDomain" placeholder="apexfit.com" /></Field>
      <OrganizationSettingsFields />
      <AuthSubmitButton>Save Organization</AuthSubmitButton>
    </form>
  );
}

export function GymForm({ gyms, organizations }: { gyms: GymRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveGymAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Gym" name="gymId" options={gyms.map((item) => ({ label: item.name, value: item.id }))} placeholder="Create new gym" />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="gym-name" label="Name" name="name" state={state}><Input id="gym-name" name="name" placeholder="Apex Fitness Mumbai" /></Field>
        <Field id="gym-slug" label="Slug" name="slug" state={state}><Input id="gym-slug" name="slug" placeholder="apex-fitness-mumbai" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="gym-timezone" label="Timezone" name="timezone" state={state}><Input id="gym-timezone" name="timezone" defaultValue="Asia/Kolkata" /></Field>
        <Field id="gym-currency" label="Currency" name="currency" state={state}><Input id="gym-currency" name="currency" defaultValue="INR" /></Field>
        <SelectField label="Status" name="status" options={gymStatuses} />
      </div>
      <AuthSubmitButton>Save Gym</AuthSubmitButton>
    </form>
  );
}

export function BranchForm({ branches, organizations }: { branches: BranchRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveBranchAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="Create new branch" />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="branch-name" label="Name" name="name" state={state}><Input id="branch-name" name="name" placeholder="Apex Bandra" /></Field>
        <Field id="branch-slug" label="Slug" name="slug" state={state}><Input id="branch-slug" name="slug" placeholder="apex-bandra" /></Field>
        <Field id="branch-code" label="Branch code" name="branchCode" state={state}><Input id="branch-code" name="branchCode" placeholder="BND001" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Status" name="status" options={branchStatuses} />
        <Field id="branch-timezone" label="Timezone" name="timezone" state={state}><Input id="branch-timezone" name="timezone" defaultValue="Asia/Kolkata" /></Field>
        <Field id="branch-currency" label="Currency" name="currency" state={state}><Input id="branch-currency" name="currency" defaultValue="INR" /></Field>
        <Field id="branch-capacity" label="Capacity" name="capacity" state={state}><Input id="branch-capacity" name="capacity" defaultValue="120" type="number" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="city" placeholder="City" aria-label="City" />
        <Input name="state" placeholder="State" aria-label="State" />
        <Input name="country" placeholder="Country" aria-label="Country" defaultValue="India" />
      </div>
      <Textarea name="address" placeholder="Branch address" aria-label="Branch address" />
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="phone" placeholder="Phone" aria-label="Phone" />
        <Input name="email" placeholder="Email" aria-label="Email" />
        <Input name="postalCode" placeholder="Postal code" aria-label="Postal code" />
      </div>
      <Input name="gymId" placeholder="Optional existing gym ID" aria-label="Optional existing gym ID" />
      <OperatingHoursFields />
      <AuthSubmitButton>Save Branch</AuthSubmitButton>
    </form>
  );
}

export function BranchUserForm({ branchUsers, branches, organizations }: { branchUsers: BranchUserRow[]; branches: BranchRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveBranchUserAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Branch user" name="branchUserId" options={branchUsers.map((item) => ({ label: `${item.role_name} · ${item.branch_role}`, value: item.id }))} placeholder="Assign branch user" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} />
      </div>
      <Field id="branch-user" label="User ID" name="userId" state={state}><Input id="branch-user" name="userId" placeholder="Supabase auth user ID" /></Field>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="System role" name="roleName" options={roleNames} />
        <SelectField label="Branch role" name="branchRole" options={branchRoles} />
        <SelectField label="Access scope" name="accessScope" options={branchAccessScopes} />
        <SelectField label="Status" name="status" options={["active", "invited", "suspended", "revoked"]} />
      </div>
      <PermissionOverrideFields />
      <AuthSubmitButton>Save Branch Access</AuthSubmitButton>
    </form>
  );
}

export function BranchSettingsForm({ branches, branchSettings, organizations }: { branches: BranchRow[]; branchSettings: BranchSettingRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveBranchSettingsAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Settings record" name="branchSettingsId" options={branchSettings.map((item) => ({ label: item.branch_id, value: item.id }))} placeholder="Create branch settings" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} />
      </div>
      <BranchSettingsControls />
      <AuthSubmitButton>Save Branch Settings</AuthSubmitButton>
    </form>
  );
}

export function TenantConfigForm({ organizations, tenantConfigs }: { organizations: OrganizationRow[]; tenantConfigs: TenantConfigRow[] }) {
  const [state, formAction] = useActionState(saveTenantConfigAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Tenant config" name="tenantConfigId" options={tenantConfigs.map((item) => ({ label: item.brand_name, value: item.id }))} placeholder="Create tenant config" />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="tenant-key" label="Tenant key" name="tenantKey" state={state}><Input id="tenant-key" name="tenantKey" placeholder="apex-fitness" /></Field>
        <Field id="brand-name" label="Brand name" name="brandName" state={state}><Input id="brand-name" name="brandName" placeholder="Apex Performance Club" /></Field>
        <SelectField label="Plan tier" name="planTier" options={planTiers} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Status" name="status" options={["active", "trial", "suspended", "archived"]} />
        <Input name="customDomain" placeholder="apexfit.com" aria-label="Custom domain" />
        <Input name="subdomain" placeholder="apexfit" aria-label="Subdomain" />
        <Input name="logoUrl" placeholder="Logo URL" aria-label="Logo URL" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input name="primaryColor" type="color" defaultValue="#111315" aria-label="Primary color" />
        <Input name="secondaryColor" type="color" defaultValue="#16a34a" aria-label="Secondary color" />
        <Input name="accentColor" type="color" defaultValue="#d7ff3f" aria-label="Accent color" />
      </div>
      <TenantConfigControls />
      <AuthSubmitButton>Save Tenant Config</AuthSubmitButton>
    </form>
  );
}

export function TenantDomainForm({
  branches,
  domains,
  organizations,
  tenantConfigs
}: {
  branches: BranchRow[];
  domains: TenantDomainRow[];
  organizations: OrganizationRow[];
  tenantConfigs: TenantConfigRow[];
}) {
  const [state, formAction] = useActionState(saveTenantDomainAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect
        label="Tenant domain"
        name="tenantDomainId"
        options={domains.map((item) => ({ label: `${item.domain} · ${formatEnterpriseLabel(item.status)}`, value: item.id }))}
        placeholder="Create new domain"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
        <EntitySelect label="Tenant config" name="tenantConfigId" options={tenantConfigs.map((item) => ({ label: item.brand_name, value: item.id }))} placeholder="Optional white-label config" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="Organization-level domain" />
        <Field id="domain-gym-id" label="Gym ID" name="gymId" state={state}>
          <Input id="domain-gym-id" name="gymId" placeholder="Optional gym ID for gym routing" />
        </Field>
      </div>
      <Field id="tenant-domain" label="Domain" name="domain" state={state}>
        <Input id="tenant-domain" name="domain" placeholder="apexfit.com or bandra.apexfit.com" />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="Domain type" name="domainType" options={tenantDomainTypes.filter((type) => type !== "system")} />
        <SelectField label="Routing mode" name="routingMode" options={tenantDomainRoutingModes} />
        <SelectField label="Lifecycle" name="status" options={["pending", "disabled"]} />
      </div>
      <label className="flex items-center gap-2 text-sm font-bold"><input name="isPrimary" suppressHydrationWarning type="checkbox" /> Set as primary domain</label>
      <AuthSubmitButton>Save Tenant Domain</AuthSubmitButton>
    </form>
  );
}

export function FeatureFlagForm({ branches, featureFlags, organizations }: { branches: BranchRow[]; featureFlags: FeatureFlagRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(saveFeatureFlagAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Feature flag" name="featureFlagId" options={featureFlags.map((item) => ({ label: item.name, value: item.id }))} placeholder="Create feature flag" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Global flag" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="flag-key" label="Flag key" name="flagKey" state={state}><Input id="flag-key" name="flagKey" placeholder="custom_domains" /></Field>
        <Field id="flag-name" label="Name" name="name" state={state}><Input id="flag-name" name="name" placeholder="Custom Domains" /></Field>
        <SelectField label="Status" name="status" options={featureFlagStatuses} />
      </div>
      <Textarea name="description" placeholder="Feature description" aria-label="Feature description" />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm font-bold"><input name="enabled" suppressHydrationWarning type="checkbox" /> Enabled</label>
        <Input name="rolloutPercentage" type="number" defaultValue="100" aria-label="Rollout percentage" />
        <Input name="targetPlanTiers" defaultValue="starter,professional,enterprise" aria-label="Target plan tiers" />
      </div>
      <FeatureRulesControls />
      <AuthSubmitButton>Save Feature Flag</AuthSubmitButton>
    </form>
  );
}

export function SubscriptionForm({ organizations, subscriptions }: { organizations: OrganizationRow[]; subscriptions: PlatformSubscriptionRow[] }) {
  const [state, formAction] = useActionState(saveSubscriptionAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Subscription" name="subscriptionId" options={subscriptions.map((item) => ({ label: `${item.plan_tier} · ${item.status}`, value: item.id }))} placeholder="Create subscription" />
      <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} />
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Plan tier" name="planTier" options={planTiers} />
        <SelectField label="Status" name="status" options={subscriptionStatuses} />
        <Input name="branchLimit" type="number" defaultValue="1" aria-label="Branch limit" />
        <Input name="memberLimit" type="number" defaultValue="500" aria-label="Member limit" />
        <Input name="staffLimit" type="number" defaultValue="10" aria-label="Staff limit" />
        <Input name="storageLimitMb" type="number" defaultValue="1024" aria-label="Storage limit MB" />
        <Input name="renewsOn" type="date" aria-label="Renews on" />
        <Input name="trialEndsOn" type="date" aria-label="Trial ends on" />
      </div>
      <AuthSubmitButton>Save License</AuthSubmitButton>
    </form>
  );
}

export function RetentionPolicyForm({ branches, organizations, policies }: { branches: BranchRow[]; organizations: OrganizationRow[]; policies: RetentionPolicyRow[] }) {
  const [state, formAction] = useActionState(saveRetentionPolicyAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Retention policy" name="retentionPolicyId" options={policies.map((item) => ({ label: item.data_category, value: item.id }))} placeholder="Create policy" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Global default" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Data category" name="dataCategory" options={retentionCategories} />
        <Input name="retentionDays" type="number" defaultValue="730" aria-label="Retention days" />
        <SelectField label="Disposition" name="dispositionAction" options={retentionActions} />
        <SelectField label="Status" name="status" options={["active", "paused", "archived"]} />
      </div>
      <label className="flex items-center gap-2 text-sm font-bold"><input name="legalHold" suppressHydrationWarning type="checkbox" /> Legal hold</label>
      <AuthSubmitButton>Save Retention Policy</AuthSubmitButton>
    </form>
  );
}

export function ComplianceRequestForm({ branches, organizations, requests }: { branches: BranchRow[]; organizations: OrganizationRow[]; requests: ComplianceRequestRow[] }) {
  const [state, formAction] = useActionState(saveComplianceRequestAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <EntitySelect label="Compliance request" name="complianceRequestId" options={requests.map((item) => ({ label: `${item.request_type} · ${item.requester_email}`, value: item.id }))} placeholder="Create request" />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Platform request" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <SelectField label="Request type" name="requestType" options={complianceRequestTypes} />
        <Input name="requesterEmail" type="email" placeholder="member@example.com" aria-label="Requester email" />
        <SelectField label="Status" name="status" options={complianceStatuses} />
        <Input name="dueAt" type="datetime-local" aria-label="Due date" />
      </div>
      <Textarea name="notes" placeholder="Review notes" aria-label="Review notes" />
      <ComplianceMetadataControls />
      <AuthSubmitButton>Save Compliance Request</AuthSubmitButton>
    </form>
  );
}

export function BackupJobForm({ branches, organizations }: { branches: BranchRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(queueBackupJobAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Platform backup" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="Backup type" name="backupType" options={backupTypes} />
        <SelectField label="Scope" name="scope" options={backupScopes} />
      </div>
      <BackupMetadataControls />
      <AuthSubmitButton>Queue Backup</AuthSubmitButton>
    </form>
  );
}

export function HealthCheckForm({ branches, organizations }: { branches: BranchRow[]; organizations: OrganizationRow[] }) {
  const [state, formAction] = useActionState(recordHealthCheckAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <EntitySelect label="Organization" name="organizationId" options={organizations.map((item) => ({ label: item.name, value: item.id }))} placeholder="Platform check" />
        <EntitySelect label="Branch" name="branchId" options={branches.map((item) => ({ label: item.name, value: item.id }))} placeholder="All branches" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Input name="checkKey" placeholder="database-primary" aria-label="Check key" />
        <SelectField label="Component" name="component" options={healthComponents} />
        <SelectField label="Status" name="status" options={healthStatuses} />
        <Input name="latencyMs" type="number" placeholder="Latency ms" aria-label="Latency ms" />
      </div>
      <Textarea name="message" placeholder="Health check message" aria-label="Health check message" />
      <HealthMetadataControls />
      <AuthSubmitButton>Record Health Check</AuthSubmitButton>
    </form>
  );
}

export function SecurityEventStatusForm({ event }: { event: SecurityEventRow }) {
  const [state, formAction] = useActionState(updateSecurityEventStatusAction, initialAuthActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <FormMessage state={state} />
      <input name="securityEventId" type="hidden" value={event.id} />
      {securityStatuses.filter((status) => status !== event.status).map((status) => (
        <Button key={status} name="status" size="sm" type="submit" value={status} variant={status === "resolved" ? "secondary" : "ghost"}>{formatEnterpriseLabel(status)}</Button>
      ))}
    </form>
  );
}

function OrganizationSettingsFields() {
  const [governance, setGovernance] = useState("standard");
  const [releaseChannel, setReleaseChannel] = useState("stable");
  const [auditExportsEnabled, setAuditExportsEnabled] = useState(true);
  const [ownerApprovalRequired, setOwnerApprovalRequired] = useState(true);

  return (
    <ControlGroup title="Organization controls">
      <input
        name="settings"
        type="hidden"
        value={toJson({
          governance,
          release_channel: releaseChannel,
          audit_exports_enabled: auditExportsEnabled,
          owner_approval_required: ownerApprovalRequired
        })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectControl label="Governance level" onChange={setGovernance} options={["standard", "strict", "enterprise"]} value={governance} />
        <SelectControl label="Release channel" onChange={setReleaseChannel} options={["stable", "beta", "early_access"]} value={releaseChannel} />
        <CheckboxControl checked={auditExportsEnabled} label="Allow audit exports" onChange={setAuditExportsEnabled} />
        <CheckboxControl checked={ownerApprovalRequired} label="Require owner approval for sensitive changes" onChange={setOwnerApprovalRequired} />
      </div>
    </ControlGroup>
  );
}

function OperatingHoursFields() {
  const [weekdayOpen, setWeekdayOpen] = useState("06:00");
  const [weekdayClose, setWeekdayClose] = useState("22:00");
  const [weekendOpen, setWeekendOpen] = useState("07:00");
  const [weekendClose, setWeekendClose] = useState("20:00");
  const [closedOnSunday, setClosedOnSunday] = useState(false);

  return (
    <ControlGroup title="Operating hours">
      <input
        name="operatingHours"
        type="hidden"
        value={toJson({
          monday_friday: `${weekdayOpen}-${weekdayClose}`,
          saturday: `${weekendOpen}-${weekendClose}`,
          sunday: closedOnSunday ? "closed" : `${weekendOpen}-${weekendClose}`
        })}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <TimeControl label="Weekday opens" onChange={setWeekdayOpen} value={weekdayOpen} />
        <TimeControl label="Weekday closes" onChange={setWeekdayClose} value={weekdayClose} />
        <TimeControl label="Weekend opens" onChange={setWeekendOpen} value={weekendOpen} />
        <TimeControl label="Weekend closes" onChange={setWeekendClose} value={weekendClose} />
      </div>
      <CheckboxControl checked={closedOnSunday} label="Closed on Sunday" onChange={setClosedOnSunday} />
    </ControlGroup>
  );
}

function PermissionOverrideFields() {
  const [memberRead, setMemberRead] = useState(true);
  const [memberUpdate, setMemberUpdate] = useState(true);
  const [reportRead, setReportRead] = useState(true);
  const [paymentRead, setPaymentRead] = useState(false);

  return (
    <ControlGroup title="Permission overrides">
      <input
        name="permissions"
        type="hidden"
        value={toJson({
          members: selectedPermissions({ read: memberRead, update: memberUpdate }),
          reports: selectedPermissions({ read: reportRead }),
          payments: selectedPermissions({ read: paymentRead })
        })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <CheckboxControl checked={memberRead} label="Members: read" onChange={setMemberRead} />
        <CheckboxControl checked={memberUpdate} label="Members: update" onChange={setMemberUpdate} />
        <CheckboxControl checked={reportRead} label="Reports: read" onChange={setReportRead} />
        <CheckboxControl checked={paymentRead} label="Payments: read" onChange={setPaymentRead} />
      </div>
    </ControlGroup>
  );
}

function BranchSettingsControls() {
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [capacityAlert, setCapacityAlert] = useState("85");
  const [crossBranchAccess, setCrossBranchAccess] = useState("premium_only");
  const [taxMode, setTaxMode] = useState("inclusive");
  const [razorpayEnabled, setRazorpayEnabled] = useState(true);
  const [duplicateWindow, setDuplicateWindow] = useState("30");
  const [waitlistPromotion, setWaitlistPromotion] = useState(true);
  const [renewalDays, setRenewalDays] = useState("30,15,7,1");
  const [mfaRequired, setMfaRequired] = useState(true);
  const [ipRanges, setIpRanges] = useState("");

  return (
    <div className="space-y-4">
      <input name="generalSettings" type="hidden" value={toJson({ timezone, capacity_alert: toNumber(capacityAlert) })} />
      <input name="membershipSettings" type="hidden" value={toJson({ cross_branch_access: crossBranchAccess })} />
      <input name="paymentSettings" type="hidden" value={toJson({ tax_mode: taxMode, razorpay_enabled: razorpayEnabled })} />
      <input name="attendanceSettings" type="hidden" value={toJson({ duplicate_checkin_window_minutes: toNumber(duplicateWindow) })} />
      <input name="classSettings" type="hidden" value={toJson({ waitlist_auto_promotion: waitlistPromotion })} />
      <input name="notificationSettings" type="hidden" value={toJson({ renewal_reminders: csvNumbers(renewalDays) })} />
      <input name="securitySettings" type="hidden" value={toJson({ allowed_ip_ranges: csvStrings(ipRanges), mfa_required_for_admins: mfaRequired })} />

      <ControlGroup title="General and membership">
        <div className="grid gap-4 md:grid-cols-2">
          <TextControl label="Timezone" onChange={setTimezone} value={timezone} />
          <NumberControl label="Capacity alert percent" min={1} max={100} onChange={setCapacityAlert} value={capacityAlert} />
          <SelectControl label="Cross-branch access" onChange={setCrossBranchAccess} options={["disabled", "premium_only", "all_members"]} value={crossBranchAccess} />
          <SelectControl label="Tax mode" onChange={setTaxMode} options={["inclusive", "exclusive"]} value={taxMode} />
        </div>
      </ControlGroup>

      <ControlGroup title="Operational rules">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberControl label="Duplicate check-in window minutes" min={0} onChange={setDuplicateWindow} value={duplicateWindow} />
          <TextControl label="Renewal reminder days" onChange={setRenewalDays} value={renewalDays} />
          <CheckboxControl checked={razorpayEnabled} label="Enable Razorpay collection" onChange={setRazorpayEnabled} />
          <CheckboxControl checked={waitlistPromotion} label="Auto-promote class waitlists" onChange={setWaitlistPromotion} />
        </div>
      </ControlGroup>

      <ControlGroup title="Security">
        <div className="grid gap-4 md:grid-cols-2">
          <TextControl label="Allowed IP ranges" onChange={setIpRanges} placeholder="10.0.0.0/24, 203.0.113.10" value={ipRanges} />
          <CheckboxControl checked={mfaRequired} label="Require MFA for admins" onChange={setMfaRequired} />
        </div>
      </ControlGroup>
    </div>
  );
}

function TenantConfigControls() {
  const [headingFont, setHeadingFont] = useState("Inter");
  const [bodyFont, setBodyFont] = useState("Inter");
  const [fromName, setFromName] = useState("Apex Performance Club");
  const [replyTo, setReplyTo] = useState("support@apexfit.com");
  const [branches, setBranches] = useState("5");
  const [members, setMembers] = useState("5000");
  const [storageMb, setStorageMb] = useState("10240");
  const [privacyContact, setPrivacyContact] = useState("privacy@apexfit.com");
  const [dataResidency, setDataResidency] = useState("india");

  return (
    <div className="space-y-4">
      <input name="typography" type="hidden" value={toJson({ heading: headingFont, body: bodyFont })} />
      <input name="emailBranding" type="hidden" value={toJson({ from_name: fromName, reply_to: replyTo })} />
      <input name="limits" type="hidden" value={toJson({ branches: toNumber(branches), members: toNumber(members), storage_mb: toNumber(storageMb) })} />
      <input name="complianceSettings" type="hidden" value={toJson({ privacy_contact: privacyContact, data_residency: dataResidency })} />

      <ControlGroup title="Brand typography and email">
        <div className="grid gap-4 md:grid-cols-2">
          <TextControl label="Heading font" onChange={setHeadingFont} value={headingFont} />
          <TextControl label="Body font" onChange={setBodyFont} value={bodyFont} />
          <TextControl label="Email sender name" onChange={setFromName} value={fromName} />
          <TextControl label="Reply-to email" onChange={setReplyTo} type="email" value={replyTo} />
        </div>
      </ControlGroup>

      <ControlGroup title="Tenant limits and compliance">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberControl label="Branch limit" min={-1} onChange={setBranches} value={branches} />
          <NumberControl label="Member limit" min={-1} onChange={setMembers} value={members} />
          <NumberControl label="Storage limit MB" min={0} onChange={setStorageMb} value={storageMb} />
          <SelectControl label="Data residency" onChange={setDataResidency} options={["india", "global", "custom"]} value={dataResidency} />
          <TextControl label="Privacy contact" onChange={setPrivacyContact} type="email" value={privacyContact} />
        </div>
      </ControlGroup>
    </div>
  );
}

function FeatureRulesControls() {
  const [minimumRole, setMinimumRole] = useState("gym_admin");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [staffOnly, setStaffOnly] = useState(true);

  return (
    <ControlGroup title="Feature rule requirements">
      <input name="rules" suppressHydrationWarning type="hidden" value={toJson({ min_staff_role: minimumRole, requires_mfa: requiresMfa, staff_only: staffOnly })} />
      <div className="grid gap-4 md:grid-cols-3">
        <SelectControl label="Minimum staff role" onChange={setMinimumRole} options={roleNames} value={minimumRole} />
        <CheckboxControl checked={requiresMfa} label="Require MFA" onChange={setRequiresMfa} />
        <CheckboxControl checked={staffOnly} label="Staff only" onChange={setStaffOnly} />
      </div>
    </ControlGroup>
  );
}

function ComplianceMetadataControls() {
  const [source, setSource] = useState("admin_console");
  const [priority, setPriority] = useState("normal");
  const [reference, setReference] = useState("");

  return (
    <ControlGroup title="Request details">
      <input name="metadata" type="hidden" value={toJson({ source, priority, reference })} />
      <div className="grid gap-4 md:grid-cols-3">
        <SelectControl label="Source" onChange={setSource} options={["admin_console", "member_request", "support_ticket", "import"]} value={source} />
        <SelectControl label="Priority" onChange={setPriority} options={["low", "normal", "high", "urgent"]} value={priority} />
        <TextControl label="Reference" onChange={setReference} placeholder="Ticket or case ID" value={reference} />
      </div>
    </ControlGroup>
  );
}

function BackupMetadataControls() {
  const [reason, setReason] = useState("scheduled_recovery_point");
  const [includeStorage, setIncludeStorage] = useState(true);
  const [requestedByTeam, setRequestedByTeam] = useState("platform_ops");

  return (
    <ControlGroup title="Backup details">
      <input name="metadata" type="hidden" value={toJson({ reason, include_storage: includeStorage, requested_by_team: requestedByTeam })} />
      <div className="grid gap-4 md:grid-cols-3">
        <SelectControl label="Reason" onChange={setReason} options={["scheduled_recovery_point", "pre_release", "tenant_export", "incident_response"]} value={reason} />
        <TextControl label="Requested by team" onChange={setRequestedByTeam} value={requestedByTeam} />
        <CheckboxControl checked={includeStorage} label="Include file storage" onChange={setIncludeStorage} />
      </div>
    </ControlGroup>
  );
}

function HealthMetadataControls() {
  const [region, setRegion] = useState("bom1");
  const [provider, setProvider] = useState("vercel");
  const [observedBy, setObservedBy] = useState("platform_monitor");

  return (
    <ControlGroup title="Health context">
      <input name="metadata" type="hidden" value={toJson({ region, provider, observed_by: observedBy })} />
      <div className="grid gap-4 md:grid-cols-3">
        <TextControl label="Region" onChange={setRegion} value={region} />
        <SelectControl label="Provider" onChange={setProvider} options={["vercel", "supabase", "resend", "razorpay", "openai", "other"]} value={provider} />
        <TextControl label="Observed by" onChange={setObservedBy} value={observedBy} />
      </div>
    </ControlGroup>
  );
}

function ControlGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-4 rounded-md border border-border bg-surface-muted p-4">
      <h3 className="text-sm font-black">{title}</h3>
      {children}
    </section>
  );
}

function Field({ id, label, name, state, children }: { id: string; label: string; name: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={id}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: readonly string[] }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <select className={selectClass} name={name} defaultValue={options[0] ?? ""}>
        {options.map((option) => <option key={option} value={option}>{formatEnterpriseLabel(option)}</option>)}
      </select>
    </label>
  );
}

function SelectControl({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: readonly string[]; value: string }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <select className={selectClass} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option} value={option}>{formatEnterpriseLabel(option)}</option>)}
      </select>
    </label>
  );
}

function TextControl({ label, onChange, placeholder, type = "text", value }: { label: string; onChange: (value: string) => void; placeholder?: string; type?: "email" | "text"; value: string }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <Input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  );
}

function NumberControl({ label, max, min, onChange, value }: { label: string; max?: number; min?: number; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <Input max={max} min={min} onChange={(event) => onChange(event.target.value)} type="number" value={value} />
    </label>
  );
}

function TimeControl({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <Input onChange={(event) => onChange(event.target.value)} type="time" value={value} />
    </label>
  );
}

function CheckboxControl({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} suppressHydrationWarning type="checkbox" />
      {label}
    </label>
  );
}

function EntitySelect({ label, name, options, placeholder = "Select" }: { label: string; name: string; options: Array<{ label: string; value: string }>; placeholder?: string }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <select className={selectClass} name={name} defaultValue="">
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function selectedPermissions(values: Record<string, boolean>) {
  return Object.entries(values)
    .filter(([, enabled]) => enabled)
    .map(([permission]) => permission);
}

function csvStrings(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function csvNumbers(value: string) {
  return csvStrings(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function toNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toJson(value: Record<string, unknown>) {
  return JSON.stringify(value);
}
