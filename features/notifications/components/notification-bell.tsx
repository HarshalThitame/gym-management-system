"use client";

import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getUserNotificationsAction,
  getUnreadCountAction,
  markAsReadAction,
  markAllAsReadAction,
  deleteNotificationAction,
} from "../actions/notification-actions";
import { useNotificationRealtime } from "@/features/realtime/hooks/use-realtime";
import type { Notification } from "../services/notification-service";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Listen for real-time notifications
  useNotificationRealtime((event) => {
    // Refresh notifications when new one arrives
    loadNotifications();
    loadUnreadCount();
  });

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, []);

  const loadNotifications = async () => {
    const data = await getUserNotificationsAction(20);
    setNotifications(data);
  };

  const loadUnreadCount = async () => {
    const count = await getUnreadCountAction();
    setUnreadCount(count);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsReadAction(notificationId);
    await loadNotifications();
    await loadUnreadCount();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsReadAction();
    await loadNotifications();
    await loadUnreadCount();
  };

  const handleDelete = async (notificationId: string) => {
    await deleteNotificationAction(notificationId);
    await loadNotifications();
    await loadUnreadCount();
  };

  const handleActionClick = (notification: Notification) => {
    if (notification.action_url) {
      window.open(notification.action_url, "_blank");
    }
    if (!notification.read_at) {
      handleMarkAsRead(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400";
      case "warning":
        return "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "error":
        return "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400";
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-4 transition-colors hover:bg-muted/50",
                    !notification.read_at && "bg-muted/30"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      getNotificationIcon(notification.type)
                    )}
                  >
                    <Bell className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        {!notification.read_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        {notification.action_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleActionClick(notification)}
                            className="h-6 w-6 p-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(notification.id)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
