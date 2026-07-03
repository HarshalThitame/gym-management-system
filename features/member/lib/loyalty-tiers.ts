export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum" | "none";

export const LOYALTY_TIERS: Record<LoyaltyTier, {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
  minPoints: number;
  perks: string[];
}> = {
  platinum: {
    name: "Platinum",
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    textColor: "text-purple-800",
    icon: "💎",
    minPoints: 5000,
    perks: ["Priority class booking", "2 free guest passes/month", "20% off PT packages", "Exclusive events", "Free locker rental"]
  },
  gold: {
    name: "Gold",
    color: "from-amber-400 to-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-800",
    icon: "🥇",
    minPoints: 2000,
    perks: ["Priority class booking", "1 free guest pass/month", "10% off PT packages", "Exclusive events"]
  },
  silver: {
    name: "Silver",
    color: "from-slate-300 to-slate-500",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    textColor: "text-slate-700",
    icon: "🥈",
    minPoints: 500,
    perks: ["Priority class booking", "5% off PT packages"]
  },
  bronze: {
    name: "Bronze",
    color: "from-amber-600 to-amber-800",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-100",
    textColor: "text-amber-700",
    icon: "🥉",
    minPoints: 0,
    perks: ["Standard class booking"]
  },
  none: {
    name: "No Tier",
    color: "from-gray-300 to-gray-400",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    textColor: "text-gray-600",
    icon: "",
    minPoints: -1,
    perks: []
  }
};

export function getLoyaltyTier(totalPoints: number): LoyaltyTier {
  if (totalPoints >= 5000) return "platinum";
  if (totalPoints >= 2000) return "gold";
  if (totalPoints >= 500) return "silver";
  if (totalPoints >= 0) return "bronze";
  return "none";
}

export function getNextTierName(currentTier: LoyaltyTier): string {
  const tiers: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum"];
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex >= 0 && currentIndex < tiers.length - 1) {
    const nextTier = tiers[currentIndex + 1];
    if (nextTier) return LOYALTY_TIERS[nextTier].name;
  }
  return "platinum";
}

export function getPointsToNextTier(totalPoints: number, currentTier: LoyaltyTier): number {
  const tiers: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum"];
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex >= 0 && currentIndex < tiers.length - 1) {
    const nextTier = tiers[currentIndex + 1];
    if (nextTier) return LOYALTY_TIERS[nextTier].minPoints - totalPoints;
  }
  return 0;
}
