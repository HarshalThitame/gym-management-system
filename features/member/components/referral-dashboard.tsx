"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Share2, Users, Gift, ArrowRight } from "lucide-react";
import type { MemberReferralData } from "@/features/member/services/referral-service";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  earned: "border-green-200 bg-green-50 text-green-700",
  paid: "border-accent/30 bg-accent/10 text-accent",
  expired: "border-red-200 bg-red-50 text-red-700"
};

export function ReferralDashboard({ data }: { data: MemberReferralData }) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(data.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const shareData = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join me at Apex Performance Club!",
        text: "Use my referral link to sign up and get rewards!",
        url: data.referralLink
      }).catch(() => {});
    } else {
      copyLink();
    }
  };

  if (!data.config?.is_active) return null;

  return (
    <div className="space-y-6">
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-surface via-surface to-accent/5 p-6 md:p-8 shadow-premium"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 size-32 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-bold text-accent">
              <Gift className="size-3.5" />
              Referral Program
            </div>
            <h2 className="mt-3 text-2xl font-black">Invite friends, earn rewards</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Share your unique referral code. When a friend joins and their membership matures, you both earn {data.config?.reward_type === "discount" ? `${data.config.reward_value}% discount` : data.config?.reward_type === "credit" ? `₹${data.config.reward_value} credit` : "a free month"}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <motion.div
              className="text-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
            >
              <p className="text-3xl font-black gradient-text">{data.totalReferrals}</p>
              <p className="text-xs font-bold text-muted-foreground">Referrals</p>
            </motion.div>
            <motion.div
              className="text-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.4 }}
            >
              <p className="text-3xl font-black gradient-text-cool">{data.earnedRewards}</p>
              <p className="text-xs font-bold text-muted-foreground">Earned</p>
            </motion.div>
          </div>
        </div>

        <div className="relative z-10 mt-6">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground mb-3">Your Referral Code</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl border-2 border-dashed border-accent/30 bg-surface-muted px-5 py-3">
              <p className="text-lg font-black tracking-wider text-center">{data.referralCode}</p>
            </div>
            <motion.button
              onClick={copyLink}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-xl bg-accent p-3 text-white shadow-glow-sm hover:shadow-glow transition-all"
            >
              {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
            </motion.button>
            <motion.button
              onClick={shareData}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-xl border border-border p-3 text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all"
            >
              <Share2 className="size-5" />
            </motion.button>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-muted-foreground text-center">
            Or share: <span className="select-all">{data.referralLink}</span>
          </p>
        </div>
      </motion.div>

      {data.rewards.length > 0 && (
        <motion.div
          className="rounded-2xl border border-border bg-surface p-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="size-4 text-muted-foreground" />
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Referral History</p>
          </div>
          <div className="space-y-2">
            {data.rewards.map((reward, i) => (
              <motion.div
                key={reward.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted p-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{reward.referredMemberName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {reward.reward_type.replace(/_/g, " ")} · {reward.reward_value}{reward.reward_type === "discount" ? "%" : " INR"}
                  </p>
                </div>
                <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize shrink-0", STATUS_COLORS[reward.status] ?? STATUS_COLORS.pending)}>
                  {reward.status}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
