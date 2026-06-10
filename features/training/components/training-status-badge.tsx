import { Badge } from "@/components/ui/badge";

type TrainingStatusBadgeProps = {
  status: string;
};

export function TrainingStatusBadge({ status }: TrainingStatusBadgeProps) {
  const variant = status === "active" || status === "completed" || status === "scheduled"
    ? "success"
    : status === "pending_payment" || status === "rescheduled" || status === "on_leave"
      ? "warning"
      : status === "cancelled" || status === "missed" || status === "archived" || status === "expired"
        ? "error"
        : "neutral";

  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}
