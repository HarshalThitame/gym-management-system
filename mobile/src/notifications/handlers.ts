import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { validateDeepLinkRoute } from "@/navigation/deep-links";
import type { RoleName } from "@/types";
import type { NotificationCategory } from "./types";

interface NotificationData {
  type?: string;
  category?: NotificationCategory;
  screen?: string;
  id?: string;
  url?: string;
}

export function handleNotificationResponse(response: Notifications.NotificationResponse, userRoles?: RoleName[]): void {
  const data = response.notification.request.content.data as NotificationData;
  if (!data) return;

  const targetScreen = resolveNotificationScreen(data);
  if (!targetScreen) return;

  if (userRoles && userRoles.length > 0) {
    const validatedRoute = validateDeepLinkRoute(targetScreen, userRoles);
    if (validatedRoute) {
      setTimeout(() => { router.push(validatedRoute as never); }, 100);
    }
  } else {
    setTimeout(() => { router.push(targetScreen as never); }, 100);
  }
}

function resolveNotificationScreen(data: NotificationData): string | null {
  if (data.screen && isRoleAllowedScreen(data.screen)) return data.screen;
  if (data.url && isRoleAllowedScreen(data.url)) return data.url;

  switch (data.category) {
    case "attendance": return "/member/attendance";
    case "renewal": case "membership": return "/member/membership";
    case "payment": return "/member/payments";
    case "class": return "/member/classes";
    case "trainer": return "/trainer/communications";
    case "lead": return "/reception/leads";
    case "system": return "/member/notifications";
    default: return null;
  }
}

const ALLOWED_SCREEN_PREFIXES = [
  "/member", "/trainer", "/reception", "/admin", "/owner", "/auth",
];

function isRoleAllowedScreen(path: string): boolean {
  return ALLOWED_SCREEN_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function getNotificationCategoryTitle(category: NotificationCategory): string {
  const titles: Record<NotificationCategory, string> = {
    attendance: "Attendance",
    renewal: "Membership Renewal",
    payment: "Payment",
    class: "Class Update",
    trainer: "Trainer Message",
    lead: "Lead Update",
    membership: "Membership",
    system: "System Notice",
    promotion: "Promotion",
  };
  return titles[category] ?? "Notification";
}
