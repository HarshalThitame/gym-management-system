import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import type { LucideIcon } from "lucide-react";

type ReceptionModulePageProps = {
  title: string;
  eyebrow: string;
  description: string;
  primaryStat: {
    label: string;
    value: string;
    detail: string;
    icon: LucideIcon;
  };
  capabilities: string[];
};

export function ReceptionModulePage({ title, eyebrow, description, primaryStat, capabilities }: ReceptionModulePageProps) {
  const Icon = primaryStat.icon;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail={primaryStat.detail} icon={<Icon className="size-5" />} label={primaryStat.label} value={primaryStat.value} />
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Allowed reception actions</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            This route is protected for reception staff and scoped to the assigned gym.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {capabilities.map((capability) => (
              <div className="rounded-md border border-border bg-surface-muted p-4 text-sm font-semibold text-muted-foreground" key={capability}>
                {capability}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
