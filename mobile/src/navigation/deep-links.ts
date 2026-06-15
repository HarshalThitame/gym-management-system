import * as Linking from "expo-linking";
import { getPrimaryRole } from "@/rbac/permissions";
import type { RoleName } from "@/types";

const ROLE_SCREEN_MAP: Record<string, RoleName[]> = {
  "member": ["member"],
  "member/attendance": ["member"],
  "member/membership": ["member"],
  "member/payments": ["member"],
  "member/workouts": ["member"],
  "member/notifications": ["member"],
  "member/profile": ["member"],
  "trainer": ["trainer"],
  "trainer/members": ["trainer"],
  "trainer/schedule": ["trainer"],
  "trainer/programs": ["trainer"],
  "reception": ["reception_staff"],
  "reception/attendance": ["reception_staff"],
  "reception/leads": ["reception_staff"],
  "admin": ["gym_admin"],
  "admin/members": ["gym_admin"],
  "admin/payments": ["gym_admin"],
  "admin/attendance": ["gym_admin"],
  "owner": ["organization_owner"],
  "owner/billing": ["organization_owner"],
  "owner/crm": ["organization_owner"],
  "owner/analytics": ["organization_owner"],
};

export function validateDeepLinkRoute(path: string, userRoles: RoleName[]): string | null {
  if (userRoles.length === 0) return null;

  const primaryRole = getPrimaryRole(userRoles);
  if (!primaryRole) return null;

  const normalizedPath = path.replace(/^\//, "").split("/").slice(0, 2).join("/");
  const allowedRoles = ROLE_SCREEN_MAP[normalizedPath] ?? ROLE_SCREEN_MAP[normalizedPath.split("/")[0]];

  if (!allowedRoles) {
    return getDefaultRouteForRole(primaryRole);
  }

  if (allowedRoles.includes(primaryRole)) {
    return `/${normalizedPath}`;
  }

  return getDefaultRouteForRole(primaryRole);
}

function getDefaultRouteForRole(role: RoleName): string {
  const routes: Record<RoleName, string> = {
    super_admin: "/super-admin",
    organization_owner: "/owner",
    gym_admin: "/admin",
    reception_staff: "/reception",
    trainer: "/trainer",
    member: "/member",
  };
  return routes[role] ?? "/auth/login";
}

export const linkingConfig = {
  prefixes: [
    Linking.createURL("/"),
    "apex://",
    "https://apexperformance.club",
    "https://*.apexperformance.club",
  ],
  config: {
    screens: {
      auth: {
        screens: {
          login: "auth/login",
          register: "auth/register",
          "forgot-password": "auth/forgot-password",
          "reset-password": "auth/reset-password",
        },
      },
      member: {
        screens: {
          "(tabs)": {
            screens: {
              dashboard: "member",
              attendance: "member/attendance",
              classes: "member/classes",
              workouts: "member/workouts",
              profile: "member/profile",
            },
          },
          membership: "member/membership",
          payments: "member/payments",
          notifications: "member/notifications",
        },
      },
      trainer: {
        screens: {
          "(tabs)": {
            screens: {
              dashboard: "trainer",
              members: "trainer/members",
              schedule: "trainer/schedule",
              classes: "trainer/classes",
              communications: "trainer/communications",
            },
          },
        },
      },
      admin: {
        screens: {
          "(tabs)": {
            screens: {
              dashboard: "admin",
              members: "admin/members",
              payments: "admin/payments",
              attendance: "admin/attendance",
            },
          },
        },
      },
      reception: {
        screens: {
          "(tabs)": {
            screens: {
              dashboard: "reception",
              attendance: "reception/attendance",
              register: "reception/register",
              payments: "reception/payments",
            },
          },
        },
      },
      owner: {
        screens: {
          dashboard: "owner",
          billing: "owner/billing",
        },
      },
    },
  },
};

export function createDeepLink(screen: string, params?: Record<string, string>): string {
  const prefix = Linking.createURL("/");
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return `${prefix}${screen}${query}`;
}
