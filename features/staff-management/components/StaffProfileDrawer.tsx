"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CinematicCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StaffProfile {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  email: string;
  phone: string;
  status: "online" | "offline";
  department: string;
  joinDate: string;
  salary?: number;
  permissions: string[];
}

export interface StaffProfileDrawerProps {
  isOpen: boolean;
  profile: StaffProfile | null;
  onClose: () => void;
  onSave?: (profile: StaffProfile) => void;
}

export const StaffProfileDrawer = React.forwardRef<
  HTMLDivElement,
  StaffProfileDrawerProps
>(({ isOpen, profile, onClose, onSave }, ref) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<StaffProfile | null>(null);

  React.useEffect(() => {
    if (profile) {
      setEditedProfile(profile);
    }
  }, [profile]);

  if (!profile) return null;

  const displayProfile = isEditing && editedProfile ? editedProfile : profile;

  const handleSave = () => {
    if (editedProfile && onSave) {
      onSave(editedProfile);
      setIsEditing(false);
    }
  };

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
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Drawer */}
          <motion.div
            ref={ref}
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-gradient-to-b from-gray-950 to-gray-900 z-50 overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="sticky top-0 flex items-center justify-between p-6 border-b border-white/10 bg-gray-950/80 backdrop-blur-sm z-10"
            >
              <h2 className="text-xl font-bold text-white">Staff Profile</h2>
              <motion.button
                onClick={onClose}
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.2 }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </motion.button>
            </motion.div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Avatar Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  className={cn(
                    "w-24 h-24 rounded-full border-3 border-gradient-to-r from-purple-400 via-pink-500 to-purple-500",
                    "bg-gradient-to-br from-purple-400 to-pink-500",
                    "flex items-center justify-center text-white font-bold text-4xl"
                  )}
                  style={{
                    background: displayProfile.avatar
                      ? `url(${displayProfile.avatar}) center/cover`
                      : "linear-gradient(135deg, #a855f7, #ec4899)",
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  {!displayProfile.avatar &&
                    displayProfile.name.charAt(0).toUpperCase()}
                </motion.div>

                <div className="text-center">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedProfile?.name || ""}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile!,
                          name: e.target.value,
                        })
                      }
                      className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm w-full text-center"
                    />
                  ) : (
                    <h3 className="text-2xl font-bold text-white">
                      {displayProfile.name}
                    </h3>
                  )}
                  <p className="text-purple-300 text-sm mt-1">
                    {displayProfile.role}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {displayProfile.department}
                  </p>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
                    displayProfile.status === "online"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-gray-500/20 text-gray-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full animate-pulse",
                      displayProfile.status === "online"
                        ? "bg-green-500"
                        : "bg-gray-500"
                    )}
                  />
                  {displayProfile.status}
                </div>
              </motion.div>

              {/* Personal Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">
                  Personal Information
                </h4>
                <CinematicCard variant="default" className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Email
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editedProfile?.email || ""}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile!,
                            email: e.target.value,
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    ) : (
                      <p className="text-white text-sm">{displayProfile.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Phone
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editedProfile?.phone || ""}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile!,
                            phone: e.target.value,
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    ) : (
                      <p className="text-white text-sm">{displayProfile.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Join Date
                    </label>
                    <p className="text-white text-sm">{displayProfile.joinDate}</p>
                  </div>
                </CinematicCard>
              </motion.div>

              {/* Role & Permissions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
              >
                <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">
                  Role & Permissions
                </h4>
                <CinematicCard variant="default" className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Role
                    </label>
                    {isEditing ? (
                      <select
                        value={editedProfile?.role || ""}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile!,
                            role: e.target.value,
                          })
                        }
                        className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      >
                        <option className="bg-gray-900">Manager</option>
                        <option className="bg-gray-900">Trainer</option>
                        <option className="bg-gray-900">Staff</option>
                        <option className="bg-gray-900">Receptionist</option>
                      </select>
                    ) : (
                      <p className="text-white text-sm">{displayProfile.role}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-3">
                      Permissions
                    </label>
                    <div className="space-y-2">
                      {displayProfile.permissions.map((perm) => (
                        <motion.div
                          key={perm}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 p-2 bg-white/5 rounded"
                        >
                          <input
                            type="checkbox"
                            defaultChecked={true}
                            disabled={!isEditing}
                            className="w-4 h-4 rounded border-white/20 cursor-pointer"
                          />
                          <span className="text-xs text-gray-300">{perm}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </CinematicCard>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="flex gap-3 pt-6 border-t border-white/10"
              >
                {!isEditing ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsEditing(true)}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-lg font-medium text-sm",
                      "bg-purple-600 text-white hover:bg-purple-700",
                      "transition-all duration-300"
                    )}
                  >
                    Edit Profile
                  </motion.button>
                ) : (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsEditing(false);
                        setEditedProfile(profile);
                      }}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg font-medium text-sm",
                        "bg-white/10 text-white hover:bg-white/20",
                        "transition-all duration-300"
                      )}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSave}
                      className={cn(
                        "flex-1 px-4 py-2 rounded-lg font-medium text-sm",
                        "bg-green-600 text-white hover:bg-green-700",
                        "transition-all duration-300"
                      )}
                    >
                      Save Changes
                    </motion.button>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

StaffProfileDrawer.displayName = "StaffProfileDrawer";
