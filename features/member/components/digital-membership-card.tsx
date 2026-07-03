"use client";

import { motion } from "framer-motion";
import { Shield, CalendarDays, CreditCard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/features/member/components/progress-ring";

type DigitalMembershipCardProps = {
  memberName: string;
  memberCode: string;
  planName: string;
  membershipStatus: string;
  remainingDays: number;
  totalDays: number;
  gymName: string;
};

export function DigitalMembershipCard({
  memberName,
  memberCode,
  planName,
  membershipStatus,
  remainingDays,
  totalDays,
  gymName
}: DigitalMembershipCardProps) {
  const percentage = totalDays > 0 ? (remainingDays / totalDays) * 100 : 0;
  const isActive = membershipStatus === "active";

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl shadow-premium-lg"
      initial={{ opacity: 0, y: 20, rotateX: 5 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      whileHover={{ y: -8, rotateX: -3, transition: { duration: 0.3 } }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
    >
      <div className="relative z-10 bg-gradient-to-br from-ink via-primary to-obsidian p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-gradient-mesh opacity-20" />
        <div className="absolute top-0 right-0 size-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 size-32 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur">
                <Shield className="size-3" />
                {isActive ? "Active Member" : membershipStatus}
              </div>
              <h3 className="mt-3 text-2xl font-black">{memberName}</h3>
              <p className="mt-1 text-sm font-semibold text-white/70">{gymName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Member ID</p>
              <p className="mt-1 font-mono text-sm font-bold text-white/80">{memberCode}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Plan</p>
              <p className="mt-1 font-bold">{planName}</p>
            </div>
            <div className="flex-shrink-0">
              <div className="relative size-20">
                <svg className="size-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                  <motion.circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={isActive ? "#6366f1" : "#dc2626"}
                    strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34}
                    animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - percentage / 100) }}
                    transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1], delay: 0.3 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-lg font-black"
                    key={remainingDays}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {remainingDays}
                  </motion.span>
                  <span className="text-[10px] font-bold text-white/60">days left</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white/50">
              <CalendarDays className="size-3.5" />
              {remainingDays > 0 ? `${remainingDays} days remaining` : "Expired"}
            </div>
            <div className="flex items-center gap-1.5">
              <motion.div
                className="size-2 rounded-full bg-green-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-xs font-bold text-white/60">Apex Performance Club</span>
            </div>
          </div>
        </div>

        <div className="absolute top-6 right-6 opacity-10">
          <Sparkles className="size-24" />
        </div>
      </div>
    </motion.div>
  );
}
