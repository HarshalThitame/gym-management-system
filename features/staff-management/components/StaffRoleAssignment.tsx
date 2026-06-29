"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { CinematicCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface RolePermissions {
  role: string;
  permissions: string[];
}

export interface StaffRoleAssignmentProps {
  staffId: string;
  currentRole: string;
  availableRoles: RolePermissions[];
  onAssignRole?: (staffId: string, role: string, permissions: string[]) => void;
  onCancel?: () => void;
}

export const StaffRoleAssignment = React.forwardRef<
  HTMLDivElement,
  StaffRoleAssignmentProps
>(({ staffId, currentRole, availableRoles, onAssignRole, onCancel }, ref) => {
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    availableRoles
      .find((r) => r.role === currentRole)
      ?.permissions.slice() || []
  );
  const [isLoading, setIsLoading] = useState(false);

  const currentRoleData = availableRoles.find((r) => r.role === selectedRole);
  const previousRole = currentRole;
  const roleChanged = selectedRole !== currentRole;

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    const roleData = availableRoles.find((r) => r.role === role);
    setSelectedPermissions(roleData?.permissions.slice() || []);
  };

  const handlePermissionToggle = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
      onAssignRole?.(staffId, selectedRole, selectedPermissions);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={ref} className="space-y-6">
      {/* Role Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h3 className="text-lg font-bold text-white mb-4">Select Role</h3>

        <div className="grid grid-cols-2 gap-4">
          {availableRoles.map((roleOption) => {
            const isSelected = selectedRole === roleOption.role;
            const isCurrent = roleOption.role === previousRole;

            return (
              <motion.button
                key={roleOption.role}
                onClick={() => handleRoleChange(roleOption.role)}
                className={cn(
                  "relative p-4 rounded-lg border-2 transition-all duration-300",
                  "flex flex-col items-start gap-2",
                  isSelected
                    ? "bg-purple-500/20 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                    : "bg-white/5 border-white/20 hover:border-white/40"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isCurrent && !isSelected && (
                  <span className="absolute top-2 right-2 text-xs bg-blue-500/30 text-blue-300 px-2 py-1 rounded">
                    Current
                  </span>
                )}

                {isSelected && roleChanged && (
                  <motion.span
                    className="absolute top-2 right-2 text-xs bg-yellow-500/30 text-yellow-300 px-2 py-1 rounded"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    Changing
                  </motion.span>
                )}

                <span className="font-semibold text-white">
                  {roleOption.role}
                </span>

                <div className="flex gap-1 flex-wrap">
                  {roleOption.permissions.slice(0, 2).map((perm) => (
                    <span
                      key={perm}
                      className="text-xs bg-white/10 text-gray-300 px-2 py-1 rounded"
                    >
                      {perm}
                    </span>
                  ))}
                  {roleOption.permissions.length > 2 && (
                    <span className="text-xs text-gray-400">
                      +{roleOption.permissions.length - 2}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <motion.div
                    layoutId="selected-role"
                    className="absolute inset-0 rounded-lg border-2 border-purple-400"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Permissions Section */}
      {currentRoleData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h3 className="text-lg font-bold text-white mb-4">Permissions</h3>

          <CinematicCard variant="glow" className="p-6 space-y-3">
            {currentRoleData.permissions.map((permission, index) => (
              <motion.label
                key={permission}
                className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <motion.input
                  type="checkbox"
                  checked={selectedPermissions.includes(permission)}
                  onChange={() => handlePermissionToggle(permission)}
                  className="w-5 h-5 rounded border-2 border-purple-500 bg-white/10 cursor-pointer accent-purple-500"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                />
                <span className="flex-1 text-sm text-white font-medium">
                  {permission}
                </span>

                <motion.div
                  className="w-2 h-2 rounded-full bg-purple-500"
                  animate={
                    selectedPermissions.includes(permission)
                      ? { scale: 1 }
                      : { scale: 0 }
                  }
                  transition={{ duration: 0.2 }}
                />
              </motion.label>
            ))}
          </CinematicCard>

          <p className="text-xs text-gray-400 mt-3">
            {selectedPermissions.length} of {currentRoleData.permissions.length}{" "}
            permissions selected
          </p>
        </motion.div>
      )}

      {/* Role Change Summary */}
      {roleChanged && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
        >
          <p className="text-sm text-yellow-300">
            <span className="font-semibold">Role will change:</span> {previousRole}{" "}
            → {selectedRole}
          </p>
          <p className="text-xs text-yellow-200/70 mt-1">
            This user's permissions will be updated accordingly.
          </p>
        </motion.div>
      )}

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex gap-3 pt-6 border-t border-white/10"
      >
        <motion.button
          onClick={onCancel}
          disabled={isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "flex-1 px-4 py-3 rounded-lg font-medium",
            "bg-white/10 text-white hover:bg-white/20",
            "transition-all duration-300",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          Cancel
        </motion.button>

        <motion.button
          onClick={handleSave}
          disabled={isLoading || !roleChanged}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={roleChanged && !isLoading ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
          className={cn(
            "flex-1 px-4 py-3 rounded-lg font-medium",
            "bg-gradient-to-r from-purple-600 to-pink-600 text-white",
            "hover:from-purple-700 hover:to-pink-700",
            "transition-all duration-300",
            (!roleChanged || isLoading) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="inline-block"
            >
              ⏳
            </motion.span>
          ) : (
            "Assign Role"
          )}
        </motion.button>
      </motion.div>
    </div>
  );
});

StaffRoleAssignment.displayName = "StaffRoleAssignment";
