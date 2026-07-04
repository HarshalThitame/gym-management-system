"use client";

import { motion } from "framer-motion";
import { Award, TrendingUp, Zap, Gift } from "lucide-react";
import { AnimatedContainer, AnimatedItem } from "@/components/motion";
import { getLoyaltyTier, LOYALTY_TIERS, getPointsToNextTier, getNextTierName } from "@/features/member/lib/loyalty-tiers";
import type { LoyaltyTier } from "@/features/member/lib/loyalty-tiers";

type LoyaltyWidgetProps = {
  balance: number;
  config: {
    points_redemption_rate: number;
    is_active: boolean;
  } | null;
};

export function LoyaltyWidget({ balance, config }: LoyaltyWidgetProps) {
  if (!config?.is_active) return null;

  const tier = getLoyaltyTier(balance);
  const tierInfo = LOYALTY_TIERS[tier];
  const pointsToNext = getPointsToNextTier(balance, tier);
  const nextTierName = getNextTierName(tier);
  const redemptionValue = config?.points_redemption_rate ? balance / config.points_redemption_rate : 0;
  const progressToNext = tier === "platinum" ? 100 : 
    tier === "none" ? 0 :
    (balance - LOYALTY_TIERS[tier].minPoints) / (pointsToNext + balance - LOYALTY_TIERS[tier].minPoints) * 100;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-glow-sm"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-accent/5 blur-2xl" />
      <div className="absolute -left-4 -bottom-4 size-20 rounded-full bg-accent/5 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Loyalty Points</p>
          <div className="mt-2 flex items-baseline gap-2">
            <motion.span
              className="text-3xl font-black gradient-text"
              key={balance}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {balance.toLocaleString()}
            </motion.span>
            <span className="text-sm font-bold text-muted-foreground">points</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Worth ₹{redemptionValue.toFixed(0)} in membership discounts
          </p>
        </div>

        <motion.div
          className={`flex items-center gap-3 rounded-xl border ${tierInfo.borderColor} ${tierInfo.bgColor} px-4 py-3`}
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-2xl">{tierInfo.icon}</span>
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.1em] ${tierInfo.textColor}`}>{tierInfo.name} Tier</p>
            {tier !== "platinum" && (
              <p className={`text-[10px] font-semibold ${tierInfo.textColor}`}>
                {pointsToNext} pts to {nextTierName}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {tier !== "platinum" && (
        <div className="relative z-10 mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${tierInfo.color}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
          </div>
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground text-right">
            {Math.round(progressToNext)}% to {nextTierName}
          </p>
        </div>
      )}
    </motion.div>
  );
}

type LeaderboardWidgetProps = {
  leaderboard: {
    member_id: string;
    full_name: string;
    balance: number;
  }[];
  currentMemberId?: string;
};

export function LeaderboardWidget({ leaderboard, currentMemberId }: LeaderboardWidgetProps) {
  if (leaderboard.length === 0) return null;

  const top3 = leaderboard.slice(0, 5);
  const userInTop = top3.find((m) => m.member_id === currentMemberId);
  const userRank = userInTop ? leaderboard.indexOf(userInTop) + 1 : null;
  const userEntry = leaderboard.find((m) => m.member_id === currentMemberId);

  return (
    <motion.div
      className="rounded-2xl border border-border bg-surface p-5"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <TrophyBadge className="size-4 text-warning" />
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Gym Leaderboard</p>
      </div>

      <AnimatedContainer>
        <div className="space-y-2">
          {top3.map((entry, index) => (
            <AnimatedItem key={entry.member_id} index={index}>
              <div className={`flex items-center gap-3 rounded-lg p-2.5 ${entry.member_id === currentMemberId ? "bg-accent/5 border border-accent/20" : "hover:bg-surface-muted/50"}`}>
                <span className={`w-6 text-center text-sm font-black ${index === 0 ? "text-warning" : index === 1 ? "text-muted-foreground" : index === 2 ? "text-warning/60" : "text-muted-foreground/60"}`}>
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                </span>
                <span className="flex-1 text-sm font-semibold truncate">{entry.full_name}</span>
                <span className="text-sm font-bold text-muted-foreground">{entry.balance.toLocaleString()} pts</span>
              </div>
            </AnimatedItem>
          ))}
        </div>
      </AnimatedContainer>

      {userEntry && !userInTop && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-3 rounded-lg bg-accent/5 border border-accent/20 p-2.5">
            <span className="w-6 text-center text-sm font-black text-muted-foreground">{userRank}</span>
            <span className="flex-1 text-sm font-semibold">You</span>
            <span className="text-sm font-bold text-muted-foreground">{userEntry.balance.toLocaleString()} pts</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TrophyBadge({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 8 4 9 5" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 16 4 15 5" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
