import { getOrgIntegrationsAction } from "@/features/organization-owner/actions/integration-actions";
import { IntegrationsManager } from "@/features/organization-owner/components/integrations-manager";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Integrations", description: "Manage your organization's third-party integrations" };

export default async function OrgIntegrationsPage() {
  const context = await requireOrganizationOwner("/organization/integrations");
  let dashboard: Awaited<ReturnType<typeof getOrgIntegrationsAction>> | null = null;
  try {
    dashboard = await getOrgIntegrationsAction();
  } catch {}

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ href: "/organization", label: "Dashboard" }, { href: "/organization/integrations", label: "Integrations" }]} />

      <section className="rounded-[2rem] border border-border/60 bg-gradient-to-br from-surface via-surface to-surface-muted/80 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Organization Integrations</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Integration Hub
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Manage your payment gateway, calendar sync, SMS, and WhatsApp providers. All integration management is organization-owner only.
            </p>
          </div>
        </div>
      </section>

      <Card variant="elevated" className="border-border/70">
        <CardHeader className="border-b border-border/60 bg-surface/70">
          <CardTitle>Connected Providers</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard ? (
            <IntegrationsManager dashboard={dashboard} />
          ) : (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
              Failed to load integration health. Check connectivity and try again.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-surface to-surface-muted/70 p-5">
        <div className="space-y-2 text-sm text-muted-foreground">
          <h3 className="text-lg font-black text-foreground">About Organization Integrations</h3>
          <p>Razorpay credentials are stored per organization. Each organization manages its own payment gateway for collecting member payments.</p>
          <p>Google Calendar uses platform-managed OAuth credentials with organization-scoped tokens. Only one calendar connection per organization.</p>
          <p>MSG91 SMS and WhatsApp are configured per organization with provider-specific credentials and templates.</p>
        </div>
      </div>
    </div>
  );
}
