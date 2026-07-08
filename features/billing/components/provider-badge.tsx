import { Badge } from "@/components/ui/badge";

export function ProviderBadge({ provider }: { provider: string }) {
  const p = provider?.toLowerCase() || "manual";
  if (p === "razorpay") return <Badge variant="info">Razorpay</Badge>;
  if (p === "payu") return <Badge variant="warning">PayU</Badge>;
  return <Badge variant="neutral">{p}</Badge>;
}
