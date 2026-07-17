import { Badge } from "@/components/ui/badge";

export function ProviderBadge({ provider }: { provider: string }) {
  const p = provider?.toLowerCase() || "manual";
  if (p === "razorpay") return <Badge variant="info">Razorpay</Badge>;
  return <Badge variant="neutral">{p}</Badge>;
}
