"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Award, Zap, TrendingUp } from "lucide-react";
import { CinematicCard } from "@/components/ui/card";
import { fadeInUp } from "@/components/motion/animation-presets";

export interface MemberDetailsModalProps {
  isOpen: boolean;
  member?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    tier: "bronze" | "silver" | "gold" | "platinum";
    status: "active" | "inactive" | "paused";
    joinDate: Date;
    membershipExpiry: Date;
    classesBooked: number;
    classesAttended: number;
    progress: number;
    lastVisit?: Date;
  };
  onClose: () => void;
  onEdit?: (memberId: string) => void;
  onRenew?: (memberId: string) => void;
  onUpgrade?: (memberId: string) => void;
}

const tierConfig = {
  bronze: { label: "Bronze", color: "text-amber-400", bgColor: "bg-amber-400/20" },
  silver: {
    label: "Silver",
    color: "text-slate-300",
    bgColor: "bg-slate-400/20",
  },
  gold: { label: "Gold", color: "text-yellow-400", bgColor: "bg-yellow-400/20" },
  platinum: {
    label: "Platinum",
    color: "text-blue-400",
    bgColor: "bg-blue-400/20",
  },
};

const statusConfig = {
  active: { label: "Active", color: "text-emerald-400", bgColor: "bg-emerald-400/20" },
  inactive: { label: "Inactive", color: "text-slate-400", bgColor: "bg-slate-400/20" },
  paused: { label: "Paused", color: "text-orange-400", bgColor: "bg-orange-400/20" },
};

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  initial: { scale: 0.8, opacity: 0, y: 20 },
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    y: 20,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
} as const;

const sectionVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export function MemberDetailsModal({
  isOpen,
  member,
  onClose,
  onEdit,
  onRenew,
  onUpgrade,
}: MemberDetailsModalProps) {
  if (!member) return null;

  const tierInfo = tierConfig[member.tier];
  const statusInfo = statusConfig[member.status];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50"
          >
            <CinematicCard
              variant="default"
              className="rounded-2xl border-white/20 shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/10 bg-white/2.5 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-white">Member Details</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Member header */}
                <motion.div
                  variants={sectionVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ delay: 0.1 }}
                  className="flex gap-4"
                >
                  {member.avatar && (
                    <div className="h-24 w-24 rounded-xl bg-white/10 border border-white/20 overflow-hidden flex-shrink-0">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white">
                      {member.name}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{member.email}</p>
                    {member.phone && (
                      <p className="text-slate-400 text-sm">{member.phone}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border ${tierInfo.bgColor} ${tierInfo.color}`}
                      >
                        {tierInfo.label} Member
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border ${statusInfo.bgColor} ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                {/* Membership details */}
                <motion.div
                  variants={sectionVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ delay: 0.2 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
                >
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-400" />
                    Membership Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Join Date</p>
                      <p className="text-sm font-semibold text-white">
                        {member.joinDate.toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Expiry Date</p>
                      <p className={`text-sm font-semibold ${
                        new Date(member.membershipExpiry) < new Date()
                          ? "text-red-400"
                          : "text-white"
                      }`}>
                        {member.membershipExpiry.toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Classes Booked
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {member.classesBooked}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Classes Attended
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {member.classesAttended}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Progress section */}
                <motion.div
                  variants={sectionVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ delay: 0.3 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
                >
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Fitness Progress
                  </h4>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-slate-400">Overall Progress</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {member.progress}%
                      </p>
                    </div>
                    <div className="w-full bg-white/5 border border-white/10 rounded-full h-3 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${member.progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Activity section */}
                {member.lastVisit && (
                  <motion.div
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    transition={{ delay: 0.4 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
                  >
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      Recent Activity
                    </h4>
                    <p className="text-sm text-slate-400">
                      Last visited{" "}
                      <span className="font-semibold text-white">
                        {formatRelativeDate(member.lastVisit)}
                      </span>
                    </p>
                  </motion.div>
                )}

                {/* Timeline example */}
                <motion.div
                  variants={sectionVariants}
                  initial="initial"
                  animate="animate"
                  transition={{ delay: 0.5 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
                >
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Activity Timeline
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-white font-medium">Completed Advanced Yoga</p>
                        <p className="text-xs text-slate-400">2 days ago</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-white font-medium">Attended Strength Training</p>
                        <p className="text-xs text-slate-400">5 days ago</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-white font-medium">Upgraded to Gold Membership</p>
                        <p className="text-xs text-slate-400">1 month ago</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Footer - Action buttons */}
              <div className="sticky bottom-0 border-t border-white/10 px-6 py-4 bg-white/2.5 backdrop-blur-sm flex gap-2">
                {onEdit && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onEdit(member.id);
                      onClose();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/20 text-white font-medium transition-colors"
                  >
                    Edit Member
                  </motion.button>
                )}
                {onRenew && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onRenew(member.id);
                      onClose();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600/40 hover:bg-blue-600/60 border border-blue-500/40 text-blue-300 font-medium transition-colors"
                  >
                    Renew Membership
                  </motion.button>
                )}
                {onUpgrade && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onUpgrade(member.id);
                      onClose();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium transition-colors"
                  >
                    Upgrade Tier
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/20 text-white font-medium transition-colors"
                >
                  Close
                </motion.button>
              </div>
            </CinematicCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
