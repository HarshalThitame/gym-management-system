import { Badge } from "@/components/ui/badge";
import { formatAnalyticsLabel } from "../lib/business-rules";

export function AnalyticsStatusBadge({ status }: { status: string }) {
  const variant = status === "active" || status === "completed" || status === "resolved"
    ? "success"
    : status === "queued" || status === "processing" || status === "acknowledged" || status === "paused" || status === "medium"
      ? "warning"
      : status === "failed" || status === "critical" || status === "high" || status === "archived" || status === "dismissed"
        ? "error"
        : "neutral";

  return <Badge variant={variant}>{formatAnalyticsLabel(status)}</Badge>;
}

export function KpiStatusBadge({ status }: { status: "good" | "watch" | "risk" }) {
  const variant = status === "good" ? "success" : status === "risk" ? "error" : "warning";
  return <Badge variant={variant}>{formatAnalyticsLabel(status)}</Badge>;
}
