"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Filter } from "lucide-react";
import { StaffCard, StaffCardProps } from "./StaffCard";
import { cn } from "@/lib/utils";

export interface StaffListProps {
  staff: StaffCardProps[];
  onViewProfile?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddStaff?: () => void;
}

export const StaffList = React.forwardRef<HTMLDivElement, StaffListProps>(
  ({ staff, onViewProfile, onEdit, onDelete, onAddStaff }, ref) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
      null
    );
    const [searchFocused, setSearchFocused] = useState(false);

    // Extract unique values for filters
    const roles = useMemo(() => {
      return Array.from(new Set(staff.map((s) => s.role)));
    }, [staff]);

    const departments = useMemo(() => {
      return Array.from(new Set(staff.map((s) => s.department)));
    }, [staff]);

    const statuses = useMemo(() => {
      return Array.from(new Set(staff.map((s) => s.status)));
    }, [staff]);

    // Filter staff based on search and filters
    const filteredStaff = useMemo(() => {
      return staff.filter((s) => {
        const matchesSearch =
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.phone.includes(searchQuery);

        const matchesRole = !selectedRole || s.role === selectedRole;
        const matchesStatus = !selectedStatus || s.status === selectedStatus;
        const matchesDepartment =
          !selectedDepartment || s.department === selectedDepartment;

        return (
          matchesSearch && matchesRole && matchesStatus && matchesDepartment
        );
      });
    }, [staff, searchQuery, selectedRole, selectedStatus, selectedDepartment]);

    return (
      <div ref={ref} className="space-y-6">
        {/* Search and Filter Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          {/* Search Input */}
          <motion.div
            className="relative"
            animate={{
              boxShadow: searchFocused
                ? "0 0 30px rgba(168, 85, 247, 0.3)"
                : "none",
            }}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={cn(
                "w-full pl-12 pr-4 py-3 rounded-lg",
                "bg-white/5 border border-white/20",
                "text-white placeholder:text-gray-500",
                "focus:outline-none focus:border-purple-500/50 focus:bg-white/10",
                "transition-all duration-300"
              )}
            />
          </motion.div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    setSelectedRole(selectedRole === null ? null : null)
                  }
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all duration-300",
                    selectedRole === null
                      ? "bg-purple-500/30 border border-purple-500/50 text-purple-300"
                      : "bg-white/5 border border-white/20 text-gray-400 hover:border-white/40"
                  )}
                >
                  All Roles
                </button>
                {roles.map((role) => (
                  <motion.button
                    key={role}
                    onClick={() =>
                      setSelectedRole(selectedRole === role ? null : role)
                    }
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-all duration-300",
                      selectedRole === role
                        ? "bg-purple-500/30 border border-purple-500/50 text-purple-300"
                        : "bg-white/5 border border-white/20 text-gray-400 hover:border-white/40"
                    )}
                  >
                    {role}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-2 flex-1">
              {statuses.map((status) => (
                <motion.button
                  key={status}
                  onClick={() =>
                    setSelectedStatus(selectedStatus === status ? null : status)
                  }
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all duration-300",
                    selectedStatus === status
                      ? "bg-green-500/30 border border-green-500/50 text-green-300"
                      : "bg-white/5 border border-white/20 text-gray-400 hover:border-white/40"
                  )}
                >
                  {status === "online" ? "🟢" : "⚫"} {status}
                </motion.button>
              ))}
            </div>

            {/* Department Filter */}
            <div className="flex flex-wrap gap-2 flex-1">
              {departments.map((dept) => (
                <motion.button
                  key={dept}
                  onClick={() =>
                    setSelectedDepartment(
                      selectedDepartment === dept ? null : dept
                    )
                  }
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all duration-300",
                    selectedDepartment === dept
                      ? "bg-blue-500/30 border border-blue-500/50 text-blue-300"
                      : "bg-white/5 border border-white/20 text-gray-400 hover:border-white/40"
                  )}
                >
                  {dept}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Results Count */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-gray-400"
        >
          Showing {filteredStaff.length} staff member
          {filteredStaff.length !== 1 ? "s" : ""}
        </motion.div>

        {/* Staff Grid */}
        {filteredStaff.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                  delayChildren: 0.1,
                },
              },
            }}
          >
            {filteredStaff.map((staffMember) => (
              <StaffCard
                key={staffMember.id}
                {...staffMember}
                onViewProfile={onViewProfile}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-12 px-4"
          >
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              No staff found
            </h3>
            <p className="text-gray-400 text-center">
              Try adjusting your search or filter criteria
            </p>
          </motion.div>
        )}
      </div>
    );
  }
);

StaffList.displayName = "StaffList";
