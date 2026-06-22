import { NextResponse } from "next/server";
import { requireApiFeatureAccess } from "@/features/entitlement/api-guards";
import { previewMemberImport, executeMemberImport } from "@/features/organization-owner/actions/member-import-actions";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const organizationId = body.organizationId as string;
    const csvContent = body.csvContent as string | undefined;
    const fieldMapping = body.fieldMapping as Record<string, string> | undefined;

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required." }, { status: 400 });
    }

    const denied = await requireApiFeatureAccess(organizationId, "member_data_import_export");
    if (denied) return denied;

    if (!csvContent) {
      return NextResponse.json({ error: "csvContent is required." }, { status: 400 });
    }

    if (!fieldMapping) {
      const preview = await previewMemberImport(organizationId, csvContent);
      return NextResponse.json(preview);
    }

    const lines = csvContent.trim().split(/\r?\n/);
    if (lines.length <= 1) {
      return NextResponse.json({ imported: 0, failed: 0, errors: [] });
    }

    const headers = (lines[0] ?? "").split(",").map((h) => h.replace(/^"|"$/g, "").trim());
    const dataRows = lines.slice(1);
    const mappedRows: Record<string, string>[] = [];

    for (const line of dataRows) {
      const cells: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
          } else { current += ch; }
        } else {
          if (ch === '"') { inQuotes = true; } else if (ch === ",") { cells.push(current.trim()); current = ""; } else { current += ch; }
        }
      }
      cells.push(current.trim());
      if (cells.some((c) => c.length > 0)) {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
        mappedRows.push(obj);
      }
    }

    const result = await executeMemberImport(organizationId, mappedRows, fieldMapping);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error." }, { status: 500 });
  }
}
