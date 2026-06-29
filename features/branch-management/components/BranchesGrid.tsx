"use client";

import React, { useMemo } from "react";
import { AnimatedContainer, AnimatedItem } from "@/components/motion/animation-helpers";
import { BranchListHeader } from "./BranchListHeader";
import { BranchCard } from "./BranchCard";

interface BranchData {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  revenue: number;
  status: "active" | "inactive" | "new";
}

interface BranchesGridProps {
  branches: BranchData[];
  onSearch?: (query: string) => void;
  onFilterChange?: (filter: string) => void;
  onAddBranch?: () => void;
  onEditBranch?: (branch: BranchData) => void;
  onDeleteBranch?: (id: string) => void;
  onViewBranch?: (branch: BranchData) => void;
  isLoading?: boolean;
}

export function BranchesGrid({
  branches,
  onSearch,
  onFilterChange,
  onAddBranch,
  onEditBranch,
  onDeleteBranch,
  onViewBranch,
  isLoading = false,
}: BranchesGridProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("all");

  const filteredBranches = useMemo(() => {
    return branches.filter((branch) => {
      const matchesSearch =
        branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        filterStatus === "all" || branch.status === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [branches, searchQuery, filterStatus]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleFilterChange = (filter: string) => {
    setFilterStatus(filter);
    onFilterChange?.(filter);
  };

  return (
    <div className="w-full">
      {/* Header with Search and Filters */}
      <BranchListHeader
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onAddBranch={onAddBranch}
      />

      {/* Grid of Branches */}
      {filteredBranches.length > 0 ? (
        <AnimatedContainer
          stagger
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredBranches.map((branch, index) => (
            <AnimatedItem key={branch.id} index={index}>
              <BranchCard
                id={branch.id}
                name={branch.name}
                location={branch.location}
                memberCount={branch.memberCount}
                revenue={branch.revenue}
                status={branch.status}
                onEdit={() => onEditBranch?.(branch)}
                onDelete={() => onDeleteBranch?.(branch.id)}
                onView={() => onViewBranch?.(branch)}
              />
            </AnimatedItem>
          ))}
        </AnimatedContainer>
      ) : (
        <AnimatedContainer
          stagger={false}
          className="flex flex-col items-center justify-center py-16 rounded-lg border border-white/20 bg-white/5"
        >
          <div className="text-center">
            <div className="mb-4 text-5xl">🏢</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {isLoading ? "Loading branches..." : "No branches found"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {isLoading
                ? "Fetching your branch data..."
                : searchQuery || filterStatus !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first branch to get started"}
            </p>
            {!isLoading && !searchQuery && filterStatus === "all" && (
              <button
                onClick={onAddBranch}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
              >
                Create First Branch
              </button>
            )}
          </div>
        </AnimatedContainer>
      )}

      {/* Results count */}
      {filteredBranches.length > 0 && (
        <div className="mt-6 text-sm text-muted-foreground text-center">
          Showing {filteredBranches.length} of {branches.length} branches
        </div>
      )}
    </div>
  );
}
