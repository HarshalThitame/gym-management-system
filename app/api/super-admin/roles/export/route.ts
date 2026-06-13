import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getRolesData } from "@/features/super-admin/services/role-management-service";

export async function GET() {
  try {
    await requireRole(["super_admin"], "/super-admin/roles");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getRolesData();

    const headerRow = "Role Name,Display Name,Description,System,User Count,Permission Count";
    const rows = data.roles.map((r) =>
      [
        r.name,
        `"${r.display_name.replace(/"/g, '""')}"`,
        `"${r.description.replace(/"/g, '""')}"`,
        r.is_system ? "Yes" : "No",
        r.userCount,
        r.permissionCount
      ].join(",")
    );
    const csv = [headerRow, ...rows].join("\n");

    const now = new Date().toISOString();
    const datePart = now.split("T")[0] ?? "unknown";
    const timePart = (now.split("T")[1] ?? "").split(".")[0]?.replace(/:/g, "") ?? "000000";

    return new NextResponse("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="roles-export-${datePart}-${timePart}.csv"`
      }
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Export failed." }, { status: 500 });
  }
}
