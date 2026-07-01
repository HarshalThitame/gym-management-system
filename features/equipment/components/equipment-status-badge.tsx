import { Badge } from "@/components/ui/badge";

export function EquipmentStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <Badge variant="neutral">Unknown</Badge>;
  }

  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "active" || normalizedStatus === "operational") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (normalizedStatus === "maintenance" || normalizedStatus === "under_maintenance") {
    return <Badge variant="warning">{status}</Badge>;
  }
  if (normalizedStatus === "retired" || normalizedStatus === "decommissioned") {
    return <Badge variant="error">{status}</Badge>;
  }

  return <Badge variant="neutral">{status}</Badge>;
}
