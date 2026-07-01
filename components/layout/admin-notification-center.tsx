"use client";

import { NotificationCenter } from "@/components/ui/notification-center";
import type { Database } from "@/types/database";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function mapNotificationType(category: string): "info" | "success" | "warning" | "error" {
  if (category === "membership_expiry" || category === "payment_failed") return "warning";
  if (category === "payment_received" || category === "member_joined") return "success";
  if (category === "error" || category === "security") return "error";
  return "info";
}

export function AdminNotificationCenter({ notifications }: { notifications: NotificationRow[] }) {
  const mapped = notifications.map((n) => ({
    id: n.id,
    title: n.title ?? n.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    message: n.body ?? "",
    type: mapNotificationType(n.category),
    timestamp: n.created_at,
    read: n.read_at !== null,
  }));

  return <NotificationCenter notifications={mapped} />;
}
