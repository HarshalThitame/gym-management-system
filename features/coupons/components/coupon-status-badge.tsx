import { Badge } from "@/components/ui/badge";

export function CouponStatusBadge({ status, expiresAt, usedCount, usageLimit }: { 
  status: string | null | undefined; 
  expiresAt?: string | null;
  usedCount?: number;
  usageLimit?: number | null;
}) {
  const today = new Date().toISOString();
  
  if (expiresAt && expiresAt < today) {
    return <Badge variant="error">Expired</Badge>;
  }
  
  if (usageLimit && usedCount !== undefined && usedCount >= usageLimit) {
    return <Badge variant="warning">Usage Limit Reached</Badge>;
  }

  if (!status) {
    return <Badge variant="neutral">Unknown</Badge>;
  }

  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "active") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (normalizedStatus === "inactive" || normalizedStatus === "paused") {
    return <Badge variant="warning">{status}</Badge>;
  }
  if (normalizedStatus === "expired") {
    return <Badge variant="error">{status}</Badge>;
  }

  return <Badge variant="neutral">{status}</Badge>;
}
