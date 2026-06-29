"use client";

import React from "react";
import { motion } from "framer-motion";
import { CinematicCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, DollarSign, MoreVertical } from "lucide-react";
import { useState } from "react";

interface BranchCardProps {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  revenue: number;
  status: "active" | "inactive" | "new";
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
}

const statusConfig = {
  active: { label: "Active", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  inactive: { label: "Inactive", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  new: { label: "New", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

export function BranchCard({
  id,
  name,
  location,
  memberCount,
  revenue,
  status,
  onEdit,
  onDelete,
  onView,
}: BranchCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      transition={{ duration: 0.3 }}
    >
      <CinematicCard
        variant="glow"
        className={`p-6 cursor-pointer group relative overflow-hidden transition-all duration-300 ${
          isHovered ? "border-purple-500/60" : "border-white/20"
        }`}
        onClick={onView}
      >
        {/* Animated gradient background on hover */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-br from-purple-500 to-pink-500 -z-10 rounded-2xl"
          animate={{ opacity: isHovered ? 0.1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        {/* Status Badge with Pulse */}
        <div className="absolute top-4 right-4 z-10">
          <motion.div
            animate={status === "new" ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Badge className={statusConfig[status].color}>
              {statusConfig[status].label}
            </Badge>
          </motion.div>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-4 pr-12">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">{name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {location}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Members */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors duration-300"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-muted-foreground">Members</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {memberCount.toLocaleString()}
            </div>
          </motion.div>

          {/* Revenue */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors duration-300"
            whileHover={{ scale: 1.02 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-lime-400" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              ${(revenue / 1000).toFixed(1)}K
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-sm font-medium text-foreground hover:bg-white/10 transition-all duration-300"
          >
            Edit
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-all duration-300"
          >
            Delete
          </motion.button>

          {/* More Options Menu */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-foreground hover:bg-white/10 transition-all duration-300"
            >
              <MoreVertical className="w-4 h-4" />
            </motion.button>

            {/* Dropdown Menu */}
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full right-0 mt-2 w-40 bg-surface border border-white/20 rounded-lg shadow-xl z-50"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onView?.();
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors duration-200"
                >
                  View Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-foreground hover:bg-white/5 transition-colors duration-200"
                >
                  Edit Branch
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </CinematicCard>
    </motion.div>
  );
}
