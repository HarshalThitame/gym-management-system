import { describe, expect, it } from "vitest";
import { can, canAny, getPrimaryRole, getRoleRedirect, hasRequiredRole } from "@/lib/rbac";

describe("RBAC permission matrix", () => {
  it("gives super admin full operational access", () => {
    expect(can("super_admin", "payments", "approve")).toBe(true);
    expect(can("super_admin", "roles", "delete")).toBe(true);
    expect(getRoleRedirect(["super_admin"])).toBe("/super-admin");
  });

  it("prevents reception staff from sensitive exports and settings updates", () => {
    expect(can("reception_staff", "payments", "export")).toBe(false);
    expect(canAny(["reception_staff"], "reports", "export")).toBe(false);
    expect(canAny(["gym_admin"], "reports", "export")).toBe(true);
    expect(can("reception_staff", "settings", "update")).toBe(false);
    expect(can("reception_staff", "leads", "update")).toBe(true);
  });

  it("keeps trainer access scoped away from payment details", () => {
    expect(can("trainer", "payments", "read")).toBe(false);
    expect(can("trainer", "members", "update")).toBe(true);
  });

  it("supports multi-role checks with deterministic priority", () => {
    expect(getPrimaryRole(["gym_admin", "organization_owner"])).toBe("organization_owner");
    expect(getPrimaryRole(["member", "trainer"])).toBe("trainer");
    expect(canAny(["member", "trainer"], "classes", "update")).toBe(true);
    expect(hasRequiredRole(["member"], ["gym_admin", "member"])).toBe(true);
  });

  it("redirects authenticated users without roles away from protected portal loops", () => {
    expect(getPrimaryRole([])).toBeNull();
    expect(getRoleRedirect([])).toBe("/unauthorized");
  });

  it("separates enterprise administration permissions by role", () => {
    expect(can("super_admin", "organizations", "delete")).toBe(true);
    expect(can("organization_owner", "organizations", "update")).toBe(true);
    expect(can("organization_owner", "organizations", "delete")).toBe(false);
    expect(getRoleRedirect(["organization_owner"])).toBe("/organization");
    expect(can("gym_admin", "branches", "create")).toBe(true);
    expect(can("gym_admin", "licenses", "update")).toBe(false);
    expect(can("reception_staff", "feature_flags", "update")).toBe(false);
    expect(getRoleRedirect(["reception_staff"])).toBe("/reception");
  });
});
