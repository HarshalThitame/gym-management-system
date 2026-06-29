"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Filter, X } from "lucide-react";
import { MemberCard, MemberCardProps } from "./MemberCard";
import {
  staggerContainer,
  staggerItem,
} from "@/components/motion/animation-presets";

export interface MembersGridProps {
  members: MemberCardProps[];
  onMemberMessage?: (memberId: string) => void;
  onMemberView?: (memberId: string) => void;
  onMemberEdit?: (memberId: string) => void;
  isLoading?: boolean;
}

type TierFilter = "all" | "bronze" | "silver" | "gold" | "platinum";
type StatusFilter = "all" | "active" | "inactive" | "paused";

export function MembersGrid({
  members,
  onMemberMessage,
  onMemberView,
  onMemberEdit,
  isLoading = false,
}: MembersGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<TierFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTier =
        selectedTier === "all" || member.tier === selectedTier;

      const matchesStatus =
        selectedStatus === "all" || member.status === selectedStatus;

      return matchesSearch && matchesTier && matchesStatus;
    });
  }, [members, searchQuery, selectedTier, selectedStatus]);

  const activeFilterCount = [
    selectedTier !== "all" ? 1 : 0,
    selectedStatus !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header with search */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search members by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-all"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
              showFilters
                ? "bg-purple-600/40 border border-purple-500/40 text-purple-300"
                : "bg-white/5 border border-white/20 text-white hover:bg-white/10"
            } ${activeFilterCount > 0 ? "ring-2 ring-purple-500/40" : ""}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-purple-500/40 text-xs font-semibold">
                {activeFilterCount}
              </span>
            )}
          </motion.button>
        </div>

        {/* Filter panel */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{
            opacity: showFilters ? 1 : 0,
            height: showFilters ? "auto" : 0,
          }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="bg-white/5 border border-white/20 rounded-lg p-4 space-y-4">
            {/* Tier filter */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">
                Membership Tier
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {["all", "bronze", "silver", "gold", "platinum"].map(
                  (tier) => (
                    <motion.button
                      key={tier}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        setSelectedTier(tier as TierFilter)
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                        selectedTier === tier
                          ? "bg-purple-600/40 border border-purple-500/40 text-purple-300"
                          : "bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {tier === "all" ? "All Tiers" : tier}
                    </motion.button>
                  )
                )}
              </div>
            </div>

            {/* Status filter */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["all", "active", "inactive", "paused"].map((status) => (
                  <motion.button
                    key={status}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setSelectedStatus(status as StatusFilter)
                    }
                    className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                      selectedStatus === status
                        ? "bg-purple-600/40 border border-purple-500/40 text-purple-300"
                        : "bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {status === "all" ? "All Status" : status}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Clear filters button */}
            {(selectedTier !== "all" || selectedStatus !== "all" || searchQuery) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedTier("all");
                  setSelectedStatus("all");
                  setSearchQuery("");
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-400/10 hover:bg-slate-400/20 border border-slate-400/30 text-xs font-medium text-slate-300 transition-all"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Showing{" "}
          <span className="font-semibold text-white">
            {filteredMembers.length}
          </span>
          {" of "}
          <span className="font-semibold text-white">{members.length}</span>{" "}
          members
        </p>
        {filteredMembers.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-slate-400"
          >
            No members match your filters
          </motion.div>
        )}
      </div>

      {/* Members grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={`skeleton-${i}`}
              variants={staggerItem}
              className="h-80 bg-white/5 border border-white/20 rounded-2xl animate-pulse"
            />
          ))
        ) : filteredMembers.length > 0 ? (
          filteredMembers.map((member) => (
            <motion.div key={member.id} variants={staggerItem}>
              <MemberCard
                {...member}
                onMessage={onMemberMessage}
                onView={onMemberView}
                onEdit={onMemberEdit}
              />
            </motion.div>
          ))
        ) : (
          <motion.div
            variants={staggerItem}
            className="col-span-full flex items-center justify-center py-12"
          >
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/20 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No members found
              </h3>
              <p className="text-slate-400 text-sm">
                Try adjusting your search or filter criteria
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
