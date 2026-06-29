"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { CinematicCard } from "@/components/ui/card";
import { AnimatedButton } from "@/components/motion/animation-helpers";
import { Search, Plus, Filter } from "lucide-react";

interface BranchListHeaderProps {
  onSearch?: (query: string) => void;
  onFilterChange?: (filter: string) => void;
  onAddBranch?: () => void;
}

export function BranchListHeader({
  onSearch,
  onFilterChange,
  onAddBranch,
}: BranchListHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleFilterClick = (filter: string) => {
    setActiveFilter(filter);
    onFilterChange?.(filter);
  };

  return (
    <CinematicCard variant="default" className="p-6 mb-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search Input with Focus Glow */}
          <motion.div
            className="flex-1 relative"
            animate={{
              boxShadow: isFocused
                ? "0 0 30px rgba(168, 85, 247, 0.3)"
                : "0 0 0px rgba(168, 85, 247, 0)",
            }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search branches by name or location..."
                value={searchQuery}
                onChange={handleSearch}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-white/5 border border-white/20 text-foreground placeholder-muted-foreground focus:outline-none focus:border-purple-500/50 transition-all duration-300"
              />
            </div>
          </motion.div>

          {/* Add Branch Button */}
          <AnimatedButton
            onClick={onAddBranch}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 w-full md:w-auto"
          >
            <Plus className="inline-block w-5 h-5 mr-2" />
            Add Branch
          </AnimatedButton>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap gap-2">
          {["all", "active", "inactive", "new"].map((filter) => (
            <motion.button
              key={filter}
              onClick={() => handleFilterClick(filter)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                activeFilter === filter
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30"
                  : "bg-white/5 border border-white/20 text-foreground hover:bg-white/10"
              }`}
            >
              <Filter className="w-4 h-4" />
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </motion.button>
          ))}
        </div>
      </div>
    </CinematicCard>
  );
}
