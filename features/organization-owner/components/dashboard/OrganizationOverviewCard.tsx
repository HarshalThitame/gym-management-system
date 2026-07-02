"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useCountUp, usePulse } from "@/components/motion";
import { ArrowRight, Users, Building2, TrendingUp } from "lucide-react";

export interface OrganizationOverviewCardProps {
  organizationName: string;
  organizationLogo?: string | React.ReactNode;
  memberCount: number;
  branchCount: number;
  monthlyRevenue: number;
  onCtaClick?: () => void;
  ctaLabel?: string;
  delay?: number;
}

export const OrganizationOverviewCard = React.forwardRef<
  HTMLDivElement,
  OrganizationOverviewCardProps
>(
  (
    {
      organizationName,
      organizationLogo,
      memberCount,
      branchCount,
      monthlyRevenue,
      onCtaClick,
      ctaLabel = "View Details",
      delay = 0,
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false);

    const memberCountAnimated = useCountUp({
      from: 0,
      to: memberCount,
      duration: 2,
      decimals: 0,
    });

    const branchCountAnimated = useCountUp({
      from: 0,
      to: branchCount,
      duration: 2,
      decimals: 0,
    });

    const revenueAnimated = useCountUp({
      from: 0,
      to: monthlyRevenue,
      duration: 2,
      decimals: 0,
    });

    const pulseValue = usePulse({
      scale: 1.02,
      duration: 2,
    });

    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay }}
        whileHover={{ scale: 1.02 }}
        className="group relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(168, 85, 247) 100%)",
            scale: pulseValue,
          }}
        />

        <div className="relative rounded-2xl border-2 border-transparent bg-gradient-to-br from-blue-500/5 to-purple-500/5 backdrop-blur-sm transition-all duration-300 group-hover:border-blue-500/50 group-hover:shadow-[0_0_40px_rgba(59,130,246,0.4)]">
          <div className="p-8 md:p-10">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {typeof organizationLogo === "string" ? (
                      <img
                        src={organizationLogo}
                        alt={organizationName}
                        className="h-12 w-12 rounded-lg object-cover shadow-md"
                      />
                    ) : organizationLogo ? (
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 shadow-md flex items-center justify-center text-white font-bold">
                        {organizationLogo}
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 shadow-md flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                        {organizationName}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Organization Overview
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Monitor your organization&apos;s key performance metrics and
                    manage all branches from a single dashboard.
                  </p>
                </div>

                <motion.button
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCtaClick}
                  className="w-fit inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 group/btn"
                >
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </motion.button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-3 md:col-span-1">
                <motion.div
                  className="group/stat rounded-xl border border-blue-200/50 bg-blue-50/30 p-4 transition-all duration-300 hover:border-blue-300 hover:bg-blue-50/50"
                  whileHover={{ y: -2 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-500/10 p-2">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Total Members
                      </p>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        {Math.floor(memberCountAnimated).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="group/stat rounded-xl border border-purple-200/50 bg-purple-50/30 p-4 transition-all duration-300 hover:border-purple-300 hover:bg-purple-50/50"
                  whileHover={{ y: -2 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-purple-500/10 p-2">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Branches
                      </p>
                      <p className="text-2xl font-bold text-purple-600 mt-1">
                        {Math.floor(branchCountAnimated)}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="group/stat rounded-xl border border-emerald-200/50 bg-emerald-50/30 p-4 transition-all duration-300 hover:border-emerald-300 hover:bg-emerald-50/50"
                  whileHover={{ y: -2 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Monthly Revenue
                      </p>
                      <p className="text-lg md:text-xl font-bold text-emerald-600 mt-1 truncate">
                        {formatCurrency(Math.floor(revenueAnimated))}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
      </motion.div>
    );
  }
);

OrganizationOverviewCard.displayName = "OrganizationOverviewCard";
