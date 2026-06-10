import { Badge } from "@/components/ui/badge";
import { formatFitnessLabel } from "../lib/business-rules";

const toneByStatus: Record<string, string> = {
  active: "border-success/30 bg-success/10 text-success",
  completed: "border-success/30 bg-success/10 text-success",
  logged: "border-success/30 bg-success/10 text-success",
  planned: "border-primary/20 bg-primary/10 text-primary",
  in_progress: "border-warning/30 bg-warning/10 text-warning",
  paused: "border-warning/30 bg-warning/10 text-warning",
  draft: "border-muted-foreground/25 bg-surface-muted text-muted-foreground",
  skipped: "border-warning/30 bg-warning/10 text-warning",
  off_plan: "border-warning/30 bg-warning/10 text-warning",
  archived: "border-muted-foreground/25 bg-surface-muted text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive"
};

export function FitnessStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={toneByStatus[status] ?? "border-border bg-surface-muted text-muted-foreground"} variant="neutral">
      {formatFitnessLabel(status)}
    </Badge>
  );
}
