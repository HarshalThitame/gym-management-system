import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";

export async function GET(request: Request) {
  const auth = await requireApiRole(["super_admin"]);

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  const status = searchParams.get("status") ?? "all";
  const role = searchParams.get("role") ?? "all";

  const supabase = await createSupabaseServerClient();

  let profileQuery = supabase
    .from("profiles")
    .select("id, full_name, email, phone, status, created_at, updated_at");

  if (status !== "all") {
    profileQuery = profileQuery.eq("status", status as "active" | "suspended" | "archived" | "invited");
  }

  const { data: profiles, error } = await profileQuery.order("created_at", { ascending: false }).limit(10000);

  if (error) {
    console.error("[super-admin-users-export] Query failed.", error.message);
    return NextResponse.json({ error: "Export query failed." }, { status: 500 });
  }

  const profileIds = (profiles ?? []).map((p) => p.id);
  const { data: assignments } = profileIds.length > 0
    ? await supabase
        .from("branch_users")
        .select("user_id, organization_id, role_name, status")
        .in("user_id", profileIds)
        .limit(50000)
    : { data: [] };

  const rolesByUser = new Map<string, Set<string>>();
  for (const a of assignments ?? []) {
    const existing = rolesByUser.get(a.user_id) ?? new Set();
    existing.add(a.role_name);
    rolesByUser.set(a.user_id, existing);
  }

  if (role !== "all") {
    const filteredProfiles = (profiles ?? []).filter((p) => {
      const userRoles = rolesByUser.get(p.id);
      return userRoles && userRoles.has(role);
    });

    return buildExportResponse(filteredProfiles, rolesByUser, format);
  }

  return buildExportResponse(profiles ?? [], rolesByUser, format);
}

function buildExportResponse(
  profiles: Array<{ id: string; full_name: string; email: string | null; phone: string | null; status: string; created_at: string; updated_at: string }>,
  rolesByUser: Map<string, Set<string>>,
  format: string
) {
  const header = "User ID,Full Name,Email,Phone,Status,Roles,Created At,Updated At";
  const rows = profiles.map((p) => {
    const roles = Array.from(rolesByUser.get(p.id) ?? []).map(formatEnterpriseLabel).join("; ");
    return [
      p.id,
      csvEscape(p.full_name),
      csvEscape(p.email ?? ""),
      csvEscape(p.phone ?? ""),
      p.status,
      csvEscape(roles),
      p.created_at,
      p.updated_at
    ].join(",");
  });

  const content = [header, ...rows].join("\n");

  if (format === "csv") {
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="super-admin-users-export-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    });
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `inline; filename="users-export.txt"`
    }
  });
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
