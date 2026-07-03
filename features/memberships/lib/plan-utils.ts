import { getRemainingDays } from "@/features/memberships/lib/business-rules";

export function getPlanDurationDays(planType: string | undefined): number {
  switch (planType) {
    case "monthly": return 30;
    case "quarterly": return 90;
    case "half_yearly": return 180;
    case "annual": return 365;
    default: return 30;
  }
}
