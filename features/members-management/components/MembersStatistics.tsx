"use client";

import { motion } from "framer-motion";
import { Users, TrendingUp, Award } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CinematicCard } from "@/components/ui/card";
import { useCountUp } from "@/components/motion";
import {
  staggerContainer,
  staggerItem,
} from "@/components/motion/animation-presets";

export interface StatisticsData {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  tierDistribution: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  monthlyGrowth: Array<{
    month: string;
    newMembers: number;
    activeMembers: number;
  }>;
}

export interface MembersStatisticsProps {
  data: StatisticsData;
  isLoading?: boolean;
}

const TIER_COLORS = {
  bronze: "#b45309",
  silver: "#94a3b8",
  gold: "#facc15",
  platinum: "#8b5cf6",
};

const COLORS = ["#10b981", "#64748b"] as const;

export function MembersStatistics({
  data,
  isLoading = false,
}: MembersStatisticsProps) {
  // Count-up animations
  const totalCountUp = useCountUp({
    start: 0,
    end: data.totalMembers,
    duration: 2,
    decimals: 0,
  });

  const activeCountUp = useCountUp({
    start: 0,
    end: data.activeMembers,
    duration: 2,
    decimals: 0,
  });

  const inactiveCountUp = useCountUp({
    start: 0,
    end: data.inactiveMembers,
    duration: 2,
    decimals: 0,
  });

  const pieData = [
    { name: "Active", value: data.activeMembers, color: COLORS[0] },
    { name: "Inactive", value: data.inactiveMembers, color: COLORS[1] },
  ];

  const tierData = [
    { name: "Bronze", value: data.tierDistribution.bronze, color: TIER_COLORS.bronze },
    { name: "Silver", value: data.tierDistribution.silver, color: TIER_COLORS.silver },
    { name: "Gold", value: data.tierDistribution.gold, color: TIER_COLORS.gold },
    { name: "Platinum", value: data.tierDistribution.platinum, color: TIER_COLORS.platinum },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Members Overview
        </h2>
        <p className="text-slate-400">
          Key metrics and analytics for your membership base
        </p>
      </div>

      {/* Top stats */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Total Members */}
        <motion.div variants={staggerItem}>
          <CinematicCard
            variant="glow"
            className="p-6 border-purple-500/40 shadow-[0_0_30px_rgba(139,92,246,0.3)]"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-slate-400 mb-2">Total Members</p>
                <div className="text-4xl font-bold text-white">
                  {isLoading ? "..." : totalCountUp}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-purple-600/20 border border-purple-500/40">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
            </div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.5 }}
              className="h-1 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
            />
          </CinematicCard>
        </motion.div>

        {/* Active Members */}
        <motion.div variants={staggerItem}>
          <CinematicCard
            variant="default"
            className="p-6 border-emerald-500/30 hover:border-emerald-500/60"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-slate-400 mb-2">Active Members</p>
                <div className="text-4xl font-bold text-emerald-400">
                  {isLoading ? "..." : activeCountUp}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-600/20 border border-emerald-500/40">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.7 }}
              className="h-1 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
            />
          </CinematicCard>
        </motion.div>

        {/* Inactive Members */}
        <motion.div variants={staggerItem}>
          <CinematicCard
            variant="default"
            className="p-6 border-orange-500/30 hover:border-orange-500/60"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-slate-400 mb-2">Inactive Members</p>
                <div className="text-4xl font-bold text-orange-400">
                  {isLoading ? "..." : inactiveCountUp}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-600/20 border border-orange-500/40">
                <Award className="w-6 h-6 text-orange-400" />
              </div>
            </div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, delay: 0.9 }}
              className="h-1 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"
            />
          </CinematicCard>
        </motion.div>
      </motion.div>

      {/* Charts */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Activity pie chart */}
        <motion.div variants={staggerItem}>
          <CinematicCard
            variant="default"
            className="p-6 h-full flex flex-col"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Member Activity Status
            </h3>
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-slate-400">Loading...</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(30, 41, 59, 0.8)",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex justify-center gap-6 text-sm mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-400">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-500" />
                <span className="text-slate-400">Inactive</span>
              </div>
            </div>
          </CinematicCard>
        </motion.div>

        {/* Tier distribution pie chart */}
        <motion.div variants={staggerItem}>
          <CinematicCard
            variant="default"
            className="p-6 h-full flex flex-col"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Membership Tier Distribution
            </h3>
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-slate-400">Loading...</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    animationDuration={1500}
                  >
                    {tierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(30, 41, 59, 0.8)",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap justify-center gap-4 text-sm mt-4">
              {tierData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="text-slate-400">{tier.name}</span>
                </div>
              ))}
            </div>
          </CinematicCard>
        </motion.div>
      </motion.div>

      {/* Monthly growth chart */}
      <motion.div
        variants={staggerItem}
        initial="hidden"
        animate="visible"
      >
        <CinematicCard variant="default" className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Monthly Growth Trend
          </h3>
          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-pulse text-slate-400">Loading...</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={data.monthlyGrowth}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148, 163, 184, 0.1)"
                />
                <XAxis
                  dataKey="month"
                  stroke="rgba(148, 163, 184, 0.6)"
                  style={{ fontSize: "12px" }}
                />
                <YAxis
                  stroke="rgba(148, 163, 184, 0.6)"
                  style={{ fontSize: "12px" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="newMembers"
                  stroke="#8b5cf6"
                  dot={false}
                  strokeWidth={2}
                  animationDuration={1500}
                  isAnimationActive={true}
                  name="New Members"
                />
                <Line
                  type="monotone"
                  dataKey="activeMembers"
                  stroke="#10b981"
                  dot={false}
                  strokeWidth={2}
                  animationDuration={1500}
                  isAnimationActive={true}
                  name="Active Members"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CinematicCard>
      </motion.div>
    </div>
  );
}
