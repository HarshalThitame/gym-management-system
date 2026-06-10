import { Badge } from "@/components/ui/badge";
import { formatCommunicationLabel } from "../lib/business-rules";

type StatusBadgeProps = {
  status: string;
};

export function CommunicationStatusBadge({ status }: StatusBadgeProps) {
  const variant = status === "active" || status === "published" || status === "sent" || status === "delivered" || status === "completed"
    ? "success"
    : status === "scheduled" || status === "queued" || status === "running" || status === "draft"
      ? "warning"
      : status === "failed" || status === "archived" || status === "cancelled"
        ? "error"
        : "neutral";

  return <Badge variant={variant}>{formatCommunicationLabel(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const variant = priority === "urgent" || priority === "high" ? "error" : priority === "normal" ? "info" : "neutral";
  return <Badge variant={variant}>{formatCommunicationLabel(priority)}</Badge>;
}
