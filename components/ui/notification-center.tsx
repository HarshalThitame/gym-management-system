"use client";

import { Bell, Check, CheckCheck, X, AlertCircle, Info, CheckCircle, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
  actionUrl?: string;
};

type NotificationCenterProps = {
  notifications: Notification[];
  onMarkAllRead?: () => void;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
};

const typeConfig = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
};

export function NotificationCenter({ notifications, onMarkAllRead, onMarkRead, onDismiss }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex size-10 items-center justify-center rounded-lg transition-all duration-300 hover:bg-surface-muted hover:scale-110",
          isOpen && "bg-surface-muted"
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="size-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <motion.span
            className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-[10px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            className="absolute right-0 top-12 z-50 w-96 rounded-2xl glass border border-accent/20 shadow-premium-lg overflow-hidden"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-accent to-purple-600 shadow-glow-sm">
                  <Bell className="size-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Notifications</h3>
                  <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && onMarkAllRead && (
                  <button
                    onClick={onMarkAllRead}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-accent hover:bg-accent/10 transition-all"
                    title="Mark all as read"
                  >
                    <CheckCheck className="size-3.5" />
                    Read all
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-surface-muted transition-all"
                  aria-label="Close notifications"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-surface-muted">
                    <Bell className="size-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">No notifications right now</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {notifications.map((notification, index) => {
                    const config = typeConfig[notification.type];
                    const Icon = config.icon;
                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "group relative rounded-xl p-3 transition-all duration-200 cursor-pointer",
                          notification.read
                            ? "hover:bg-surface-muted/80"
                            : `bg-gradient-to-r from-accent/5 to-purple-600/5 border ${config.border} hover:shadow-glow-sm`
                        )}
                        onClick={() => {
                          if (!notification.read && onMarkRead) onMarkRead(notification.id);
                          if (notification.actionUrl) window.location.href = notification.actionUrl;
                        }}
                      >
                        <div className="flex gap-3">
                          <div className={cn("shrink-0 p-1.5 rounded-lg", config.bg)}>
                            <Icon className={cn("size-4", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn("text-sm font-bold", !notification.read && "text-foreground")}>
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <span className="shrink-0 mt-1 size-2 rounded-full bg-accent animate-pulse" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
                            <p className="text-[10px] font-semibold text-muted-foreground/60 mt-1.5">{formatTime(notification.timestamp)}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss?.(notification.id);
                            }}
                            className="shrink-0 opacity-0 group-hover:opacity-100 flex size-6 items-center justify-center rounded-md hover:bg-destructive/10 transition-all"
                            aria-label="Dismiss notification"
                          >
                            <X className="size-3 text-muted-foreground" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="border-t border-border/50 px-5 py-3 text-center">
                <button className="text-xs font-bold text-accent hover:text-accent/80 transition-colors">
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
