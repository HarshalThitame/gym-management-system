import { Badge } from "@/components/ui/badge";
import type { AiChurnRiskCategory, AiInsightSeverity, AiRecommendationStatus } from "@/types/ai";

export function AiRiskBadge({ risk }: { risk: AiChurnRiskCategory | string | null | undefined }) {
  if (risk === "critical" || risk === "high") {
    return <Badge variant="error">{risk}</Badge>;
  }
  if (risk === "medium") {
    return <Badge variant="warning">medium</Badge>;
  }
  return <Badge variant="success">low</Badge>;
}

export function AiReviewBadge({ status }: { status: AiRecommendationStatus | string }) {
  if (status === "approved" || status === "applied") {
    return <Badge variant="success">{status.replaceAll("_", " ")}</Badge>;
  }
  if (status === "rejected" || status === "archived") {
    return <Badge variant="error">{status.replaceAll("_", " ")}</Badge>;
  }
  if (status === "pending_review") {
    return <Badge variant="warning">pending review</Badge>;
  }
  return <Badge variant="neutral">{status.replaceAll("_", " ")}</Badge>;
}

export function AiSeverityBadge({ severity }: { severity: AiInsightSeverity | string }) {
  if (severity === "critical") {
    return <Badge variant="error">critical</Badge>;
  }
  if (severity === "warning") {
    return <Badge variant="warning">warning</Badge>;
  }
  if (severity === "opportunity") {
    return <Badge variant="premium">opportunity</Badge>;
  }
  return <Badge variant="info">info</Badge>;
}
