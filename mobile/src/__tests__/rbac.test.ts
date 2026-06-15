import { can, canAny, getPrimaryRole, hasRequiredRole, getRoleRedirect, ROLE_PERMISSIONS } from "@/rbac/permissions";
import { requireRole, requirePermission, requirePrimaryRole } from "@/rbac/guards";
import type { RoleName, AuthResource, PermissionAction } from "@/types";

describe("RBAC System", () => {
  describe("can()", () => {
    it("should grant members read access to their own data", () => {
      expect(can("member", "attendance", "read")).toBe(true);
      expect(can("member", "members", "read")).toBe(true);
    });

    it("should deny members admin access", () => {
      expect(can("member", "reports", "export")).toBe(false);
      expect(can("member", "settings", "approve")).toBe(false);
    });

    it("should grant super_admin all permissions", () => {
      const resources: AuthResource[] = ["users", "roles", "organizations", "branches", "payments", "attendance"];
      const actions: PermissionAction[] = ["read", "create", "update", "delete", "export", "approve"];

      for (const resource of resources) {
        for (const action of actions) {
          expect(can("super_admin", resource, action)).toBe(true);
        }
      }
    });

    it("should grant trainers limited create access", () => {
      expect(can("trainer", "attendance", "create")).toBe(true);
      expect(can("trainer", "notifications", "create")).toBe(true);
      expect(can("trainer", "payments", "create")).toBe(false);
    });
  });

  describe("canAny()", () => {
    it("should return true if any role has permission", () => {
      expect(canAny(["member", "gym_admin"], "members", "create")).toBe(true);
    });

    it("should return false if no role has permission", () => {
      expect(canAny(["member"], "reports", "export")).toBe(false);
    });
  });

  describe("getPrimaryRole()", () => {
    it("should return highest priority role", () => {
      expect(getPrimaryRole(["member", "trainer", "gym_admin"])).toBe("gym_admin");
    });

    it("should return null for empty roles", () => {
      expect(getPrimaryRole([])).toBeNull();
    });
  });

  describe("hasRequiredRole()", () => {
    it("should return true if user has any allowed role", () => {
      expect(hasRequiredRole(["trainer"], ["trainer", "admin"])).toBe(true);
    });

    it("should return false if user has no allowed role", () => {
      expect(hasRequiredRole(["member"], ["trainer", "admin"])).toBe(false);
    });
  });

  describe("getRoleRedirect()", () => {
    it("should route members to /member", () => {
      expect(getRoleRedirect(["member"])).toBe("/member");
    });

    it("should route trainers to /trainer", () => {
      expect(getRoleRedirect(["trainer"])).toBe("/trainer");
    });

    it("should route gym_admins to /admin", () => {
      expect(getRoleRedirect(["gym_admin"])).toBe("/admin");
    });
  });

  describe("requireRole()", () => {
    it("should pass for allowed roles", () => {
      const result = requireRole(["trainer"], ["trainer", "admin"]);
      expect(result.ok).toBe(true);
    });

    it("should fail for disallowed roles", () => {
      const result = requireRole(["member"], ["trainer", "admin"]);
      expect(result.ok).toBe(false);
    });
  });

  describe("requirePermission()", () => {
    it("should pass for authorized actions", () => {
      const result = requirePermission(["member"], "attendance", "read");
      expect(result.ok).toBe(true);
    });

    it("should fail for unauthorized actions", () => {
      const result = requirePermission(["member"], "reports", "export");
      expect(result.ok).toBe(false);
    });
  });

  describe("ROLE_PERMISSIONS completeness", () => {
    const roles: RoleName[] = ["super_admin", "organization_owner", "gym_admin", "reception_staff", "trainer", "member"];
    const resources: AuthResource[] = [
      "users", "roles", "profiles", "members", "trainers", "membership_plans",
      "memberships", "payments", "attendance", "classes", "class_bookings",
      "leads", "notifications", "reports", "settings", "organizations",
      "branches", "feature_flags", "licenses", "compliance", "backups",
      "system_health", "content", "audit_logs",
    ];

    it("should define permissions for all roles and resources", () => {
      for (const role of roles) {
        for (const resource of resources) {
          expect(ROLE_PERMISSIONS[role]).toHaveProperty(resource);
        }
      }
    });

    it("should have valid action values", () => {
      const validActions: PermissionAction[] = ["read", "create", "update", "delete", "export", "approve"];
      for (const role of roles) {
        for (const resource of resources) {
          const actions = ROLE_PERMISSIONS[role][resource];
          expect(actions).toBeDefined();
          for (const action of actions!) {
            expect(validActions).toContain(action);
          }
        }
      }
    });
  });
});
