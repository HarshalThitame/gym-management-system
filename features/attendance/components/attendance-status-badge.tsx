import { Badge } from "@/components/ui/badge";

export function AttendanceStatusBadge({ status }: { status: string }) {
  const variant = status === "inside" || status === "granted" || status === "success"
    ? "success"
    : status === "warning" || status === "auto_closed"
      ? "warning"
      : status === "denied" || status === "void"
        ? "error"
        : "neutral";

  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}
