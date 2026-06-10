import { Badge } from "@/components/ui/badge";
import { formatEnterpriseLabel } from "../lib/business-rules";

export function EnterpriseStatusBadge({ status }: { status: string }) {
  const variant = status === "active" || status === "healthy" || status === "completed" || status === "resolved" || status === "verified" || status === "good"
    ? "success"
    : status === "trial" || status === "planned" || status === "maintenance" || status === "queued" || status === "running" || status === "pending" || status === "degraded" || status === "medium" || status === "watch" || status === "in_review" || status === "investigating"
      ? "warning"
      : status === "suspended" || status === "failed" || status === "down" || status === "critical" || status === "high" || status === "risk" || status === "rejected"
        ? "error"
        : "neutral";

  return <Badge variant={variant}>{formatEnterpriseLabel(status)}</Badge>;
}
