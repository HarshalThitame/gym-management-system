import type { ReactNode } from "react";
import { Card, CardContent } from "./card";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
};

export function StatCard({ label, value, detail, icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-black">{value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
          </div>
          {icon ? <div className="rounded-md bg-accent/20 p-2 text-foreground">{icon}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
