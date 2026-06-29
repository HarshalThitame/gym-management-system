"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { AnimatedContainer, AnimatedItem } from "@/components/motion/animation-helpers";
import { staggerItem } from "@/components/motion/animation-presets";
import { Clock, Zap, Users, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Timeline item data structure
 */
interface TimelineItemData {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  avatar?: string;
  type?: "activity" | "achievement" | "alert" | "update";
}

/**
 * Component props for ActivityTimeline
 */
interface ActivityTimelineProps {
  items: TimelineItemData[];
  className?: string;
}

/**
 * Icon mapping for timeline item types
 */
const TypeIconMap: Record<string, React.ReactNode> = {
  activity: <Clock className="w-4 h-4" />,
  achievement: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  alert: <AlertCircle className="w-4 h-4 text-amber-400" />,
  update: <Zap className="w-4 h-4 text-blue-400" />,
};

/**
 * Color scheme for timeline item types
 */
const TypeColorMap: Record<string, { border: string; bg: string; glow: string }> = {
  activity: {
    border: "border-blue-500/20",
    bg: "from-blue-500/10 to-blue-500/5",
    glow: "shadow-lg shadow-blue-500/10",
  },
  achievement: {
    border: "border-emerald-500/20",
    bg: "from-emerald-500/10 to-emerald-500/5",
    glow: "shadow-lg shadow-emerald-500/10",
  },
  alert: {
    border: "border-amber-500/20",
    bg: "from-amber-500/10 to-amber-500/5",
    glow: "shadow-lg shadow-amber-500/10",
  },
  update: {
    border: "border-purple-500/20",
    bg: "from-purple-500/10 to-purple-500/5",
    glow: "shadow-lg shadow-purple-500/10",
  },
};

/**
 * Sample data for demo purposes
 */
const SAMPLE_TIMELINE_DATA: TimelineItemData[] = [
  {
    id: "1",
    title: "New Member Registered",
    description: "John Doe joined your premium membership program",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    type: "activity",
  },
  {
    id: "2",
    title: "Revenue Milestone Achieved",
    description: "Organization crossed $50K monthly revenue",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Revenue",
    type: "achievement",
  },
  {
    id: "3",
    title: "Low Inventory Alert",
    description: "Protein powder stock below 20% at Main Branch",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alert",
    type: "alert",
  },
  {
    id: "4",
    title: "New Class Schedule Updated",
    description: "Summer yoga classes now available on weekends",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Schedule",
    type: "update",
  },
];

/**
 * Format timestamp to relative time string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Individual timeline item component
 */
function TimelineItem({
  item,
  index,
}: {
  item: TimelineItemData;
  index: number;
}): React.ReactNode {
  const type = item.type || "activity";
  const colors = TypeColorMap[type];
  const icon = TypeIconMap[type];

  return (
    <AnimatedItem key={item.id} index={index} className="relative pb-6">
      <div className="flex gap-4">
        {/* Connector Line - Visual connector between items */}
        {index < 3 && (
          <div className="absolute left-6 top-14 w-0.5 h-12 bg-gradient-to-b from-blue-500/40 via-purple-500/30 to-transparent opacity-0 animate-none" />
        )}

        {/* Avatar Circle with Glow */}
        <div className="relative z-10 flex-shrink-0">
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={`relative w-12 h-12 rounded-full border-2 ${colors.border} overflow-hidden backdrop-blur-sm ${colors.glow}`}
          >
            <img
              src={item.avatar}
              alt={item.title}
              className="w-full h-full object-cover"
            />
            {/* Avatar glow effect */}
            <div className={`absolute inset-0 rounded-full ${colors.border} pointer-events-none`} />
          </motion.div>

          {/* Type icon badge */}
          <div
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border border-white/20 bg-gradient-to-br ${colors.bg} flex items-center justify-center backdrop-blur-sm`}
          >
            {icon}
          </div>
        </div>

        {/* Timeline Card Content */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          whileHover={{
            y: -4,
            boxShadow: "0 20px 40px rgba(59, 130, 246, 0.2)",
          }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          viewport={{ once: true, margin: "-50px" }}
          className={`flex-1 rounded-xl border ${colors.border} bg-gradient-to-br ${colors.bg} backdrop-blur-xl p-4 transition-all duration-300`}
        >
          {/* Card Header with Title and Type */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-sm text-white leading-tight">
              {item.title}
            </h3>
          </div>

          {/* Card Description */}
          <p className="text-xs text-gray-300 mb-3 leading-relaxed">
            {item.description}
          </p>

          {/* Timestamp Footer */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <time>{formatRelativeTime(item.timestamp)}</time>
          </div>

          {/* Animated Background Gradient Accent */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: `radial-gradient(circle at top right, ${type === "achievement" ? "rgba(16, 185, 129, 0.1)" : type === "alert" ? "rgba(251, 191, 36, 0.1)" : type === "update" ? "rgba(168, 85, 247, 0.1)" : "rgba(59, 130, 246, 0.1)"}, transparent)`,
              pointerEvents: "none",
            }}
          />
        </motion.div>
      </div>
    </AnimatedItem>
  );
}

/**
 * Animated connector line that draws on mount
 */
function TimelineConnectorLine({
  itemCount,
}: {
  itemCount: number;
}): React.ReactNode {
  const lineHeight = Math.max(0, (itemCount - 1) * 100);

  return (
    <motion.div
      initial={{ scaleY: 0 }}
      whileInView={{ scaleY: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: "easeInOut" }}
      viewport={{ once: true }}
      className="absolute left-6 top-16 w-0.5 origin-top bg-gradient-to-b from-blue-500/50 via-purple-500/40 to-transparent pointer-events-none"
      style={{ height: `${lineHeight}px` }}
    />
  );
}

/**
 * ActivityTimeline Component
 * Displays a vertical timeline of organizational activities with animations
 *
 * @param items - Array of timeline items to display
 * @param className - Optional CSS classes
 *
 * @example
 * ```tsx
 * <ActivityTimeline
 *   items={[
 *     {
 *       id: "1",
 *       title: "Member Joined",
 *       description: "New premium member",
 *       timestamp: new Date(),
 *       type: "activity"
 *     }
 *   ]}
 * />
 * ```
 */
export function ActivityTimeline({
  items = SAMPLE_TIMELINE_DATA,
  className = "",
}: ActivityTimelineProps): React.ReactElement {
  // Sort items by timestamp (newest first)
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    [items]
  );

  return (
    <div className={`relative w-full ${className}`}>
      {/* Main container with glassmorphic background */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/2 to-white/5 backdrop-blur-xl p-6"
      >
        {/* Header */}
        <div className="mb-8 flex items-center gap-2">
          <div className="flex items-center gap-2 text-lg font-bold">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Activity Timeline
            </span>
          </div>
          {sortedItems.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">
              {sortedItems.length} recent activities
            </span>
          )}
        </div>

        {/* Timeline Container */}
        <div className="relative">
          {/* Animated connector line */}
          <TimelineConnectorLine itemCount={sortedItems.length} />

          {/* Timeline items with stagger animation */}
          <AnimatedContainer stagger className="space-y-0">
            {sortedItems.map((item, index) => (
              <TimelineItem key={item.id} item={item} index={index} />
            ))}
          </AnimatedContainer>

          {/* Empty state */}
          {sortedItems.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <Clock className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">
                No activities yet. Stay tuned for updates!
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Export sample data for demos
 */
export { SAMPLE_TIMELINE_DATA };
export type { TimelineItemData, ActivityTimelineProps };
