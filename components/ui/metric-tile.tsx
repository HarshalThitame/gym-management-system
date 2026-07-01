import { cn } from "@/lib/utils";

type MetricProps = {
  label: string;
  value: string;
  detail?: string;
  className?: string;
};

export function Metric({ label, value, detail, className }: MetricProps) {
  if (detail) {
    return (
      <div className={cn("rounded-md border border-border bg-surface-muted p-4", className)}>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-3 text-3xl font-black">{value}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border border-border bg-surface p-3", className)}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

export function MetricTile({ label, value, detail, className }: MetricProps) {
  return <Metric label={label} value={value} detail={detail} className={className} />;
}
