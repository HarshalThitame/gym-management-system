"use client";

import { motion } from "framer-motion";
import { Check, Star, TrendingUp } from "lucide-react";
import { CinematicCard } from "@/components/ui/card";
import { staggerContainer, staggerItem } from "@/components/motion/animation-presets";

export interface TierBenefit {
  name: string;
  included: boolean;
}

export interface Tier {
  id: "bronze" | "silver" | "gold" | "platinum";
  label: string;
  price: number;
  currency: string;
  description: string;
  benefits: TierBenefit[];
  gradient: string;
  glowColor: string;
  isCurrentTier?: boolean;
}

export interface MembershipTierDisplayProps {
  currentTierId: "bronze" | "silver" | "gold" | "platinum";
  tiers: Tier[];
  onUpgrade?: (tierId: string) => void;
  showCurrentOnly?: boolean;
}

const defaultTiers: Tier[] = [
  {
    id: "bronze",
    label: "Bronze",
    price: 299,
    currency: "₹",
    description: "Perfect for beginners",
    gradient: "from-amber-600 to-amber-700",
    glowColor: "rgba(180, 83, 9, 0.3)",
    benefits: [
      { name: "Unlimited classes", included: true },
      { name: "2 guest passes/month", included: true },
      { name: "Personal trainer access", included: false },
      { name: "Premium gear discount", included: false },
    ],
  },
  {
    id: "silver",
    label: "Silver",
    price: 499,
    currency: "₹",
    description: "For active members",
    gradient: "from-slate-400 to-slate-500",
    glowColor: "rgba(148, 163, 184, 0.3)",
    benefits: [
      { name: "Unlimited classes", included: true },
      { name: "4 guest passes/month", included: true },
      { name: "Personal trainer access", included: true },
      { name: "Premium gear discount", included: false },
    ],
  },
  {
    id: "gold",
    label: "Gold",
    price: 799,
    currency: "₹",
    description: "For serious athletes",
    gradient: "from-yellow-400 to-yellow-600",
    glowColor: "rgba(250, 204, 21, 0.3)",
    benefits: [
      { name: "Unlimited classes", included: true },
      { name: "Unlimited guest passes", included: true },
      { name: "Personal trainer access", included: true },
      { name: "Premium gear discount", included: true },
    ],
  },
  {
    id: "platinum",
    label: "Platinum",
    price: 1299,
    currency: "₹",
    description: "Ultimate fitness experience",
    gradient: "from-blue-400 to-purple-600",
    glowColor: "rgba(139, 92, 246, 0.3)",
    benefits: [
      { name: "Unlimited classes", included: true },
      { name: "Unlimited guest passes", included: true },
      { name: "Personal trainer access", included: true },
      { name: "Premium gear discount", included: true },
    ],
  },
];

export function MembershipTierDisplay({
  currentTierId,
  tiers = defaultTiers,
  onUpgrade,
  showCurrentOnly = false,
}: MembershipTierDisplayProps) {
  const currentTier = tiers.find((t) => t.id === currentTierId);
  const displayTiers = showCurrentOnly
    ? [currentTier || tiers[0]]
    : tiers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Membership Tiers
        </h2>
        <p className="text-slate-400">
          {showCurrentOnly
            ? "Your current membership tier with available benefits"
            : "Choose the perfect plan for your fitness goals"}
        </p>
      </div>

      {/* Tiers grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {displayTiers.map((tier) => {
          const isCurrentTier = tier.id === currentTierId;
          const isUpgrade =
            tiers.findIndex((t) => t.id === tier.id) >
            tiers.findIndex((t) => t.id === currentTierId);

          return (
            <motion.div
              key={tier.id}
              variants={staggerItem}
              whileHover={{ y: -8 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <CinematicCard
                variant={isCurrentTier ? "glow" : "default"}
                className={`h-full flex flex-col relative group transition-all duration-300 overflow-hidden ${
                  isCurrentTier
                    ? `border-purple-500/60 shadow-[0_0_40px_${tier.glowColor}]`
                    : "hover:border-white/30"
                }`}
              >
                {/* Badge for current tier */}
                {isCurrentTier && (
                  <motion.div
                    className="absolute top-0 right-0 bg-gradient-to-br from-purple-600 to-purple-800 text-white px-4 py-2 rounded-bl-lg flex items-center gap-1 text-xs font-semibold"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Star className="w-3 h-3" />
                    Current
                  </motion.div>
                )}

                {/* Upgrade badge */}
                {isUpgrade && !isCurrentTier && (
                  <motion.div
                    className="absolute top-0 right-0 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white px-4 py-2 rounded-bl-lg flex items-center gap-1 text-xs font-semibold"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <TrendingUp className="w-3 h-3" />
                    Upgrade
                  </motion.div>
                )}

                {/* Content */}
                <div className="p-6 flex-1 space-y-4 flex flex-col">
                  {/* Tier info */}
                  <div>
                    <h3
                      className={`text-2xl font-bold mb-2 bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`}
                    >
                      {tier.label}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {tier.description}
                    </p>
                  </div>

                  {/* Price */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="py-4 border-y border-white/10"
                  >
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">
                        {tier.currency}
                        {tier.price}
                      </span>
                      <span className="text-sm text-slate-400">/month</span>
                    </div>
                  </motion.div>

                  {/* Benefits */}
                  <motion.div className="space-y-3 flex-1">
                    {tier.benefits.map((benefit, index) => (
                      <motion.div
                        key={benefit.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        {benefit.included ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex-shrink-0 mt-0.5" />
                        )}
                        <span
                          className={`text-sm ${
                            benefit.included
                              ? "text-white"
                              : "text-slate-500 line-through"
                          }`}
                        >
                          {benefit.name}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>

                {/* Action button */}
                <div className="border-t border-white/10 p-4">
                  {isCurrentTier ? (
                    <div className="w-full py-2.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-center text-sm font-medium text-purple-300">
                      Current Plan
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onUpgrade?.(tier.id)}
                      className={`w-full py-2.5 rounded-lg font-medium transition-all ${
                        isUpgrade
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg hover:shadow-emerald-500/50"
                          : "bg-white/5 hover:bg-white/10 border border-white/20 text-white"
                      }`}
                    >
                      {isUpgrade ? "Upgrade Now" : "Select Plan"}
                    </motion.button>
                  )}
                </div>
              </CinematicCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Comparison table (optional) */}
      {!showCurrentOnly && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 pt-8 border-t border-white/10"
        >
          <h3 className="text-lg font-semibold text-white mb-4">
            Feature Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">
                    Feature
                  </th>
                  {displayTiers.map((tier) => (
                    <th
                      key={tier.id}
                      className={`text-center px-4 py-3 font-medium ${
                        tier.id === currentTierId
                          ? `bg-gradient-to-r ${tier.gradient} bg-clip-text text-transparent`
                          : "text-slate-400"
                      }`}
                    >
                      {tier.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayTiers[0]?.benefits.map((benefit) => (
                  <tr key={benefit.name} className="border-b border-white/5">
                    <td className="px-4 py-3 text-slate-400">
                      {benefit.name}
                    </td>
                    {displayTiers.map((tier) => {
                      const tierBenefit = tier.benefits.find(
                        (b) => b.name === benefit.name
                      );
                      return (
                        <td
                          key={`${tier.id}-${benefit.name}`}
                          className="text-center px-4 py-3"
                        >
                          {tierBenefit?.included ? (
                            <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                          ) : (
                            <div className="w-5 h-5 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
