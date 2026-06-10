import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active: "border-success/30 bg-success/10 text-success",
  scheduled: "border-success/30 bg-success/10 text-success",
  booked: "border-success/30 bg-success/10 text-success",
  attended: "border-success/30 bg-success/10 text-success",
  checked_in: "border-success/30 bg-success/10 text-success",
  waiting: "border-warning/30 bg-warning/10 text-warning",
  in_progress: "border-warning/30 bg-warning/10 text-warning",
  draft: "border-border bg-surface-muted text-muted-foreground",
  closed: "border-border bg-surface-muted text-muted-foreground",
  completed: "border-border bg-surface-muted text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
  absent: "border-destructive/30 bg-destructive/10 text-destructive",
  no_show: "border-destructive/30 bg-destructive/10 text-destructive",
  archived: "border-border bg-surface-muted text-muted-foreground",
  promoted: "border-success/30 bg-success/10 text-success",
  late: "border-warning/30 bg-warning/10 text-warning"
};

export function ClassStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-black capitalize", statusStyles[status] ?? statusStyles.draft, className)}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
