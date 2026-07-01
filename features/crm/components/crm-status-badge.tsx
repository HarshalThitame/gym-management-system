import { Badge } from "@/components/ui/badge";

export function CrmLeadStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <Badge variant="neutral">No Status</Badge>;
  }

  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "new" || normalizedStatus === "open") {
    return <Badge variant="info">{status}</Badge>;
  }
  if (normalizedStatus === "contacted" || normalizedStatus === "in_progress") {
    return <Badge variant="warning">{status}</Badge>;
  }
  if (normalizedStatus === "converted" || normalizedStatus === "won") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (normalizedStatus === "lost" || normalizedStatus === "closed") {
    return <Badge variant="error">{status}</Badge>;
  }

  return <Badge variant="neutral">{status}</Badge>;
}
