import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Integrations", description: "Integration management" };

export default async function IntegrationsPage() {
  const context = await requireRole(["organization_owner", "gym_admin", "super_admin"], "/admin/integrations");

  const isOwner = context.roles.includes("organization_owner");
  const isSuperAdmin = context.roles.includes("super_admin");

  if (isOwner || isSuperAdmin) {
    redirect("/organization/integrations");
  }

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
              Manage production-ready payment, calendar, SMS, and WhatsApp providers.
            </p>
          </div>
        </div>
      </section>

      <Card variant="elevated" className="border-border/70">
        <CardHeader className="border-b border-border/60 bg-surface/70">
          <CardTitle>Access Restricted</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-700">
            <p className="font-bold mb-1">Integration management has moved</p>
            <p>
              Integration setup and management is now available in the{" "}
              <a href="/organization/integrations" className="underline font-semibold">Organization Owner workspace</a>.
              Only organization owners can configure integrations.
            </p>
            <p className="mt-2">
              Contact your organization owner if you need to update any integration settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
