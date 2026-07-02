import { getIntegrationsAction } from "@/features/integrations/actions/integrations-actions";
import { IntegrationsGrid } from "@/features/integrations/components/integrations-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Integrations", description: "Connect third-party services" };

export default async function IntegrationsPage() {
  let integrations: Awaited<ReturnType<typeof getIntegrationsAction>> = [];
  try {
    integrations = await getIntegrationsAction();
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Integrations</p>
            <h2 className="text-3xl font-black">Third-Party Integrations</h2>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Connect your gym management system with your favorite tools and services.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <IntegrationsGrid integrations={integrations} />
        </CardContent>
      </Card>
    </div>
  );
}
