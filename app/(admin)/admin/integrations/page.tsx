import { getIntegrationDashboardAction } from "@/features/integrations/actions/integrations-actions";
import { IntegrationsGrid } from "@/features/integrations/components/integrations-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Integrations", description: "Enterprise integration control hub" };

export default async function IntegrationsPage() {
  let dashboard: Awaited<ReturnType<typeof getIntegrationDashboardAction>> | null = null;
  try {
    dashboard = await getIntegrationDashboardAction();
  } catch {}

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-border/60 bg-gradient-to-br from-surface via-surface to-surface-muted/80 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Admin Integrations</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Enterprise Control Hub
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Manage production-ready payment, calendar, SMS, and WhatsApp providers with live validation, operational visibility, and provider-specific controls.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-background/90 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Providers</p>
              <p className="mt-2 text-2xl font-black">4</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/90 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Runtime</p>
              <p className="mt-2 text-2xl font-black">Live</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/90 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Mode</p>
              <p className="mt-2 text-2xl font-black">India-first</p>
            </div>
          </div>
        </div>
      </section>

      <Card variant="elevated" className="border-border/70">
        <CardHeader className="border-b border-border/60 bg-surface/70">
          <CardTitle>Operational Providers</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard ? (
            <IntegrationsGrid dashboard={dashboard} />
          ) : (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
              Failed to load integration health. Check provider environment variables and database connectivity.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
