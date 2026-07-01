import { Badge } from "@/components/ui/badge";

export function TicketStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <Badge variant="neutral">Unknown</Badge>;
  }

  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "open") {
    return <Badge variant="info">{status}</Badge>;
  }
  if (normalizedStatus === "pending" || normalizedStatus === "waiting") {
    return <Badge variant="warning">{status}</Badge>;
  }
  if (normalizedStatus === "resolved") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (normalizedStatus === "closed") {
    return <Badge variant="neutral">{status}</Badge>;
  }

  return <Badge variant="neutral">{status}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) {
    return <Badge variant="neutral">Normal</Badge>;
  }

  const normalizedPriority = priority.toLowerCase();

  if (normalizedPriority === "low") {
    return <Badge variant="neutral">{priority}</Badge>;
  }
  if (normalizedPriority === "medium") {
    return <Badge variant="info">{priority}</Badge>;
  }
  if (normalizedPriority === "high") {
    return <Badge variant="warning">{priority}</Badge>;
  }
  if (normalizedPriority === "urgent" || normalizedPriority === "critical") {
    return <Badge variant="error">{priority}</Badge>;
  }

  return <Badge variant="neutral">{priority}</Badge>;
}
