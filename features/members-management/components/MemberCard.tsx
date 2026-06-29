"use client";

import { motion } from "framer-motion";
import { MessageSquare, Eye, Edit2 } from "lucide-react";
import { CinematicCard } from "@/components/ui/card";
import { fadeInUp } from "@/components/motion/animation-presets";

export interface MemberCardProps {
  id: string;
  name: string;
  avatar?: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  status: "active" | "inactive" | "paused";
  classesBooked: number;
  progress: number;
  joinDate: Date;
  onMessage?: (id: string) => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
}

const tierConfig = {
  bronze: {
    label: "Bronze",
    gradient: "from-amber-600 to-amber-700",
    textGradient: "bg-gradient-to-r from-amber-400 to-amber-600",
    glow: "rgba(180, 83, 9, 0.4)",
  },
  silver: {
    label: "Silver",
    gradient: "from-slate-400 to-slate-500",
    textGradient: "bg-gradient-to-r from-slate-300 to-slate-500",
    glow: "rgba(148, 163, 184, 0.4)",
  },
  gold: {
    label: "Gold",
    gradient: "from-yellow-400 to-yellow-600",
    textGradient: "bg-gradient-to-r from-yellow-300 to-yellow-500",
    glow: "rgba(250, 204, 21, 0.4)",
  },
  platinum: {
    label: "Platinum",
    gradient: "from-blue-400 to-purple-600",
    textGradient: "bg-gradient-to-r from-blue-300 to-purple-500",
    glow: "rgba(139, 92, 246, 0.4)",
  },
};

const statusConfig = {
  active: {
    label: "Active",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/30",
  },
  inactive: {
    label: "Inactive",
    color: "text-slate-400",
    bgColor: "bg-slate-400/10",
    borderColor: "border-slate-400/30",
  },
  paused: {
    label: "Paused",
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    borderColor: "border-orange-400/30",
  },
};

export function MemberCard({
  id,
  name,
  avatar,
  tier,
  status,
  classesBooked,
  progress,
  joinDate,
  onMessage,
  onView,
  onEdit,
}: MemberCardProps) {
  const tierInfo = tierConfig[tier];
  const statusInfo = statusConfig[status];

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <CinematicCard
        variant="default"
        className="group h-full overflow-hidden transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_40px_rgba(139,92,246,0.4)]"
      >
        {/* Header with tier badge */}
        <div className="relative h-24 bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-4">
          <div
            className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${tierInfo.textGradient} bg-clip-text text-transparent border ${tierInfo.gradient.split(" ")[0]} border-white/10`}
          >
            {tierInfo.label}
          </div>
          {avatar && (
            <div className="h-16 w-16 rounded-lg bg-white/10 border border-white/20 overflow-hidden">
              <img
                src={avatar}
                alt={name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Body content */}
        <div className="space-y-4 p-4">
          {/* Member info */}
          <div>
            <h3 className="font-semibold text-white text-lg line-clamp-1">
              {name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.bgColor} ${statusInfo.borderColor}`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${statusInfo.color}`}
                />
                <span className={statusInfo.color}>{statusInfo.label}</span>
              </div>
              <span className="text-xs text-slate-400">
                Joined {formatDate(joinDate)}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-lg p-2">
              <div className="text-xs text-slate-400 mb-1">Classes Booked</div>
              <div className="text-lg font-bold text-white">{classesBooked}</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-2">
              <div className="text-xs text-slate-400 mb-1">Progress</div>
              <div className="text-lg font-bold text-white">{progress}%</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/5 border border-white/10 rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${tierInfo.gradient} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Footer - Action buttons */}
        <div className="border-t border-white/10 px-4 py-3 bg-white/2.5 flex gap-2">
          {onMessage && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onMessage(id)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors"
              title="Message member"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Message</span>
            </motion.button>
          )}
          {onView && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onView(id)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors"
              title="View member details"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">View</span>
            </motion.button>
          )}
          {onEdit && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onEdit(id)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/40 text-xs font-medium text-purple-300 transition-colors"
              title="Edit member"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </motion.button>
          )}
        </div>
      </CinematicCard>
    </motion.div>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
