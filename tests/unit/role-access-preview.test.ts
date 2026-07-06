import { describe, expect, it } from "vitest";
import { buildRoleAccessPreview } from "@/features/super-admin/lib/role-access-preview";

describe("role access preview", () => {
  it("summarizes added and removed access", () => {
    const preview = buildRoleAccessPreview(
      {
        id: "role-1",
        name: "front_desk",
        display_name: "Front Desk",
        description: "",
        is_system: false,
        created_at: "2026-07-07T10:00:00.000Z",
        permissions: [
          { resource: "attendance", actions: ["read", "update"] },
          { resource: "members", actions: ["read"] },
        ],
        users: [],
      },
      [
        { resource: "attendance", actions: ["read", "delete"] },
        { resource: "members", actions: ["read"] },
      ]
    );

    expect(preview.summary.currentResourceCount).toBe(2);
    expect(preview.summary.proposedResourceCount).toBe(2);
    expect(preview.summary.addedActionCount).toBe(1);
    expect(preview.summary.removedActionCount).toBe(1);
    expect(preview.matrix.find((row) => row.resource === "attendance")?.addedActions).toEqual(["delete"]);
    expect(preview.matrix.find((row) => row.resource === "attendance")?.removedActions).toEqual(["update"]);
  });
});

