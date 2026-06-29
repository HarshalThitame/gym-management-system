"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CinematicCard } from "@/components/ui/card";
import { X, MapPin, Users, DollarSign, Phone, Mail, Globe } from "lucide-react";
import { slideDrawer } from "@/components/motion/animation-presets";

interface BranchDetails {
  id: string;
  name: string;
  location: string;
  memberCount: number;
  revenue: number;
  status: "active" | "inactive" | "new";
  phone?: string;
  email?: string;
  website?: string;
  managerName?: string;
  classCount?: number;
  equipmentCount?: number;
}

interface BranchDetailsDrawerProps {
  isOpen: boolean;
  branch?: BranchDetails | null;
  onClose: () => void;
  onSave?: (branch: BranchDetails) => void;
  onDelete?: (id: string) => void;
}

export function BranchDetailsDrawer({
  isOpen,
  branch,
  onClose,
  onSave,
  onDelete,
}: BranchDetailsDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<BranchDetails | null>(branch || null);

  React.useEffect(() => {
    setFormData(branch || null);
    setIsEditing(false);
  }, [branch]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) =>
      prev
        ? {
            ...prev,
            [name]: name.includes("Count") || name === "revenue" ? Number(value) : value,
          }
        : null
    );
  };

  const handleSave = () => {
    if (formData) {
      onSave?.(formData);
      setIsEditing(false);
    }
  };

  if (!branch || !formData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            variants={slideDrawer}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-white/20 shadow-2xl z-50 overflow-y-auto"
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-white/10 p-6 flex items-center justify-between"
            >
              <h2 className="text-2xl font-bold text-foreground">
                {isEditing ? "Edit Branch" : branch.name}
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-300"
              >
                <X className="w-6 h-6 text-foreground" />
              </motion.button>
            </motion.div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
              >
                <span
                  className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                    branch.status === "active"
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : branch.status === "inactive"
                        ? "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  }`}
                >
                  {branch.status.charAt(0).toUpperCase() + branch.status.slice(1)}
                </span>
              </motion.div>

              {isEditing ? (
                /* Edit Form */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-foreground focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-foreground focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Members
                      </label>
                      <input
                        type="number"
                        name="memberCount"
                        value={formData.memberCount}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-foreground focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Revenue
                      </label>
                      <input
                        type="number"
                        name="revenue"
                        value={formData.revenue}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-foreground focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone || ""}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-foreground focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ""}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-foreground focus:outline-none focus:border-purple-500/50 transition-all duration-300"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSave}
                      className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
                    >
                      Save Changes
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsEditing(false)}
                      className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-foreground font-semibold hover:bg-white/10 transition-all duration-300"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                /* View Details */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <CinematicCard variant="default" className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs text-muted-foreground">Members</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {branch.memberCount.toLocaleString()}
                      </div>
                    </CinematicCard>

                    <CinematicCard variant="default" className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-lime-400" />
                        <span className="text-xs text-muted-foreground">Revenue</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        ${(branch.revenue / 1000).toFixed(1)}K
                      </div>
                    </CinematicCard>

                    {branch.classCount !== undefined && (
                      <CinematicCard variant="default" className="p-4">
                        <div className="text-xs text-muted-foreground mb-2">Classes</div>
                        <div className="text-2xl font-bold text-foreground">
                          {branch.classCount}
                        </div>
                      </CinematicCard>
                    )}

                    {branch.equipmentCount !== undefined && (
                      <CinematicCard variant="default" className="p-4">
                        <div className="text-xs text-muted-foreground mb-2">Equipment</div>
                        <div className="text-2xl font-bold text-foreground">
                          {branch.equipmentCount}
                        </div>
                      </CinematicCard>
                    )}
                  </div>

                  {/* Details */}
                  <CinematicCard variant="default" className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-muted-foreground">Location</div>
                        <div className="text-foreground">{branch.location}</div>
                      </div>
                    </div>

                    {branch.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground">Phone</div>
                          <div className="text-foreground">{branch.phone}</div>
                        </div>
                      </div>
                    )}

                    {branch.email && (
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground">Email</div>
                          <div className="text-foreground">{branch.email}</div>
                        </div>
                      </div>
                    )}

                    {branch.website && (
                      <div className="flex items-start gap-3">
                        <Globe className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-foreground">Website</div>
                          <div className="text-foreground">{branch.website}</div>
                        </div>
                      </div>
                    )}
                  </CinematicCard>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsEditing(true)}
                      className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
                    >
                      Edit Branch
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onDelete?.(branch.id)}
                      className="flex-1 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/20 transition-all duration-300"
                    >
                      Delete
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
