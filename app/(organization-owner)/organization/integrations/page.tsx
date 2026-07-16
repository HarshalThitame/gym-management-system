import { getOrgIntegrationsAction } from "@/features/organization-owner/actions/integration-actions";
import { IntegrationsManager } from "@/features/organization-owner/components/integrations-manager";
import { requireOrganizationOwner } from "@/features/organization-owner/lib/access";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Activity, ShieldCheck, Sparkles, Users } from "lucide-react";

export const metadata = { title: "Integrations", description: "Manage your organization's third-party integrations" };

export default async function OrgIntegrationsPage() {
  await requireOrganizationOwner("/organization/integrations");
  let dashboard: Awaited<ReturnType<typeof getOrgIntegrationsAction>> | null = null;
  try {
    dashboard = await getOrgIntegrationsAction();
  } catch {}

  const connectedCount = dashboard?.items.filter((item) => item.status === "connected").length ?? 0;
  const needingAttention = dashboard?.items.filter((item) => item.status === "error").length ?? 0;
  const providerCount = dashboard?.items.length ?? 0;

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ href: "/organization", label: "Dashboard" }, { href: "/organization/integrations", label: "Integrations" }]} />

      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="member-info" className="w-fit gap-1.5 border-white/20 text-white">
              <Sparkles className="size-3.5" />
              Enterprise integrations
            </Badge>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Organization Integrations</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Integration Hub
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72">
                Manage your payment gateway, calendar sync, CRM connectors, SMS, and WhatsApp providers. Each integration is scoped to your organization and audited end-to-end.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/organization/integrations/msg91" variant="accent">
              Open MSG91 console
            </ButtonLink>
            <ButtonLink href="/admin/communications" variant="secondary">
              Open communications hub
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="elevated" className="border-border/70">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Connected</p>
              <p className="mt-1 text-lg font-black">{connectedCount}</p>
              <p className="text-sm text-muted-foreground">Providers ready for live operations.</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="border-border/70">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Needs attention</p>
              <p className="mt-1 text-lg font-black">{needingAttention}</p>
              <p className="text-sm text-muted-foreground">Providers with validation or sync issues.</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="border-border/70">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Integrated services</p>
              <p className="mt-1 text-lg font-black">{providerCount}</p>
              <p className="text-sm text-muted-foreground">Billing, calendar, CRM, messaging.</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <p>HubSpot and Zoho CRM use durable sync jobs and external-ID mappings so lead updates can be retried safely without creating duplicates.</p>
          <p>MSG91 SMS and WhatsApp are configured per organization with provider-specific credentials and templates.</p>
        </div>
      </div>
    </div>
  );
}
