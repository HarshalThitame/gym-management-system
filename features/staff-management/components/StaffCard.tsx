"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { CinematicCard } from "@/components/ui/card";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StaffCardProps {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  email: string;
  phone: string;
  status: "online" | "offline";
  department: string;
  onViewProfile?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const StaffCard = React.forwardRef<HTMLDivElement, StaffCardProps>(
  (
    {
      id,
      name,
      role,
      avatar,
      email,
      phone,
      status,
      department,
      onViewProfile,
      onEdit,
      onDelete,
    },
    ref
  ) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);
    const [showMenu, setShowMenu] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotationX = ((y - centerY) / centerY) * -8;
      const rotationY = ((x - centerX) / centerX) * 8;

      setRotateX(rotationX);
      setRotateY(rotationY);
    };

    const handleMouseLeave = () => {
      setRotateX(0);
      setRotateY(0);
      setIsHovered(false);
    };

    const statusColor =
      status === "online"
        ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"
        : "bg-gray-500 shadow-[0_0_10px_rgba(107,114,128,0.8)]";

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="h-full"
      >
        <div
          ref={cardRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            perspective: "1000px",
            transformStyle: "preserve-3d",
          }}
          className="h-full"
        >
          <motion.div
            style={{
              transformStyle: "preserve-3d",
            }}
            animate={{
              rotateX,
              rotateY,
              y: isHovered ? -8 : 0,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <CinematicCard
              variant="glow"
              className={cn(
                "p-6 h-full flex flex-col transition-all duration-300 cursor-pointer",
                "relative overflow-hidden"
              )}
              onClick={() => onViewProfile?.(id)}
            >
              {/* Avatar Section */}
              <div className="flex items-center gap-4 mb-4">
                <motion.div
                  className={cn(
                    "relative w-16 h-16 rounded-full border-2 border-gradient-to-r from-purple-400 via-pink-500 to-purple-500",
                    "bg-gradient-to-br from-purple-400 to-pink-500",
                    "flex items-center justify-center text-white font-bold text-lg",
                    "overflow-hidden"
                  )}
                  whileHover={{
                    scale: 1.1,
                    boxShadow: "0 0 20px rgba(168, 85, 247, 0.6)",
                  }}
                  transition={{ duration: 0.3 }}
                  style={{
                    background: avatar
                      ? `url(${avatar}) center/cover`
                      : "linear-gradient(135deg, #a855f7, #ec4899)",
                  }}
                >
                  {!avatar && name.charAt(0).toUpperCase()}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 via-pink-500 to-purple-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">
                    {name}
                  </h3>
                  <p className="text-xs text-purple-300 truncate">{role}</p>
                  <p className="text-xs text-gray-400">{department}</p>
                </div>

                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="ml-auto p-2 hover:bg-white/10 rounded-lg transition-colors"
                  whileHover={{ rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </motion.button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full animate-pulse",
                    statusColor
                  )}
                />
                <span className="text-xs text-gray-300 capitalize">
                  {status}
                </span>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4 flex-1">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 mt-0.5">📧</span>
                  <p className="text-xs text-gray-300 truncate">{email}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 mt-0.5">📱</span>
                  <p className="text-xs text-gray-300 truncate">{phone}</p>
                </div>
              </div>

              {/* Action Menu */}
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={
                  showMenu ? { opacity: 1, height: "auto" } : { opacity: 0 }
                }
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-white/10 pt-3"
              >
                <div className="space-y-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewProfile?.(id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-purple-300 hover:bg-purple-500/20 rounded transition-colors"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-blue-300 hover:bg-blue-500/20 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(id);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/20 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </CinematicCard>
          </motion.div>
        </div>
      </motion.div>
    );
  }
);

StaffCard.displayName = "StaffCard";
