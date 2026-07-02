"use server";

import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../services/notification-service";

/**
 * Get user notifications
 */
export async function getUserNotificationsAction(limit: number = 50, unreadOnly: boolean = false) {
  return getUserNotifications(limit, unreadOnly);
}

/**
 * Get unread notification count
 */
export async function getUnreadCountAction() {
  return getUnreadCount();
}

/**
 * Mark notification as read
 */
export async function markAsReadAction(notificationId: string) {
  return markAsRead(notificationId);
}

/**
 * Mark all notifications as read
 */
export async function markAllAsReadAction() {
  return markAllAsRead();
}

/**
 * Delete notification
 */
export async function deleteNotificationAction(notificationId: string) {
  return deleteNotification(notificationId);
}
