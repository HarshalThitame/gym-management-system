"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgOwnerContext } from "./action-utils";
import { requireOrgFeatureAccess } from "@/features/entitlement";

type ImportResult = {
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
};

type PreviewResult = {
  headers: string[];
  rows: string[][];
  errors: { row: number; message: string }[];
};

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.trim().split(/\r?\n/);
  for (const line of lines) {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          cells.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    cells.push(current.trim());
    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }
  return rows;
}

export async function previewMemberImport(
  organizationId: string,
  csvContent: string,
): Promise<PreviewResult> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    await requireOrgFeatureAccess(ctx.organizationId, "member_data_import_export");

    if (!csvContent.trim()) {
      return { headers: [], rows: [], errors: [] };
    }

    const parsed = parseCSV(csvContent);
    if (parsed.length === 0) {
      return { headers: [], rows: [], errors: [{ row: 0, message: "CSV file is empty." }] };
    }

    const firstRow = parsed[0];
    if (!firstRow) return { headers: [], rows: [], errors: [{ row: 0, message: "CSV file is empty." }] };

    const headers = firstRow.map((h: string) => h.replace(/^"|"$/g, "").trim());
    const dataRows = parsed.slice(1);
    const errors: { row: number; message: string }[] = [];
    const previewRows: string[][] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row && row.length !== headers.length) {
        errors.push({ row: i + 2, message: `Column count mismatch: expected ${headers.length}, got ${row.length}` });
      }
      if (previewRows.length < 5 && row) {
        previewRows.push(row);
      }
    }

    return { headers, rows: previewRows, errors };
  } catch (e) {
    if (e instanceof Error) {
      return { headers: [], rows: [], errors: [{ row: 0, message: e.message }] };
    }
    return { headers: [], rows: [], errors: [{ row: 0, message: "Failed to preview CSV." }] };
  }
}

const SYSTEM_FIELD_MAP: Record<string, string> = {
  "full name": "full_name",
  name: "full_name",
  phone: "phone",
  email: "email",
  "date of birth": "date_of_birth",
  dob: "date_of_birth",
  gender: "gender",
  address: "address",
  "emergency contact name": "emergency_contact_name",
  "emergency contact phone": "emergency_contact_phone",
  "joined at": "joined_at",
  "joined": "joined_at",
  notes: "notes",
};

function resolveSystemField(header: string): string | null {
  const lower = header.toLowerCase().trim();
  return SYSTEM_FIELD_MAP[lower] ?? null;
}

export async function executeMemberImport(
  organizationId: string,
  rows: Record<string, string>[],
  fieldMapping: Record<string, string>,
): Promise<ImportResult> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    await requireOrgFeatureAccess(ctx.organizationId, "member_data_import_export");

    if (!rows.length) {
      return { imported: 0, failed: 0, errors: [] };
    }

    const supabase = await createSupabaseServerClient();

    const { data: gyms } = await supabase
      .from("gyms")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(1);

    const gymId = gyms?.[0]?.id;
    if (!gymId) {
      return { imported: 0, failed: rows.length, errors: [{ row: 0, message: "No gym found for this organization." }] };
    }

    type CFSelectResult = { data: { id: string; field_name: string; field_type: string; required: boolean }[] | null; error: Error | null };
    const cfQuery = supabase.from("custom_member_fields" as never) as unknown as {
      select(s: string): {
        eq(k: string, v: string): { eq(k2: string, v2: boolean): { order(c: string, o: { ascending: boolean }): Promise<CFSelectResult> } };
      };
    };
    const { data: customFields } = await cfQuery.select("id, field_name, field_type, required")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const customFieldByName = new Map<string, { id: string; field_name: string; field_type: string; required: boolean }>();
    for (const f of customFields ?? []) {
      customFieldByName.set(f.field_name.toLowerCase(), {
        id: f.id, field_name: f.field_name, field_type: f.field_type, required: f.required,
      });
    }

    let imported = 0;
    let failed = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const rowNum = i + 2;
      try {
        const memberData: Record<string, unknown> = {
          gym_id: gymId,
          status: "active",
          joined_at: new Date().toISOString(),
        };
        const customValues: { fieldId: string; value: string }[] = [];

        for (const [csvHeader, mappedField] of Object.entries(fieldMapping)) {
          if (mappedField === "skip" || !mappedField) continue;
          const rawValue = row[csvHeader];
          if (rawValue === undefined) continue;

          const systemField = resolveSystemField(mappedField);
          if (systemField) {
            memberData[systemField] = rawValue || null;
            continue;
          }

          const cf = customFieldByName.get(mappedField.toLowerCase());
          if (cf) {
            customValues.push({ fieldId: cf.id, value: rawValue });
          }
        }

        if (!memberData.full_name && !memberData.phone) {
          failed++;
          errors.push({ row: rowNum, message: "Missing full name and phone." });
          continue;
        }

        const fullName = (memberData.full_name as string) || "Unknown";
        const phone = (memberData.phone as string) || "N/A";
        memberData.full_name = fullName;
        memberData.phone = phone;
        memberData.member_code = `MEM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const { data: created, error: insertErr } = await supabase
          .from("members")
          .insert(memberData as never)
          .select("id")
          .single();

        if (insertErr) {
          failed++;
          errors.push({ row: rowNum, message: insertErr.message });
          continue;
        }

        if (created && customValues.length > 0) {
          const cvRows = customValues.map((cv) => ({
            member_id: created.id,
            field_id: cv.fieldId,
            value: cv.value,
          }));
          const cvQuery = supabase.from("member_custom_field_values" as never) as unknown as {
            upsert(objs: { member_id: string; field_id: string; value: string }[], opts: { onConflict: string }): Promise<{ error: Error | null }>;
          };
          const { error: cvErr } = await cvQuery.upsert(cvRows, { onConflict: "member_id, field_id" });
          if (cvErr) {
            errors.push({ row: rowNum, message: `Member created but custom field values failed: ${cvErr.message}` });
          }
        }

        imported++;
      } catch (rowErr) {
        failed++;
        errors.push({ row: rowNum, message: rowErr instanceof Error ? rowErr.message : "Unknown error." });
      }
    }

    await writeAuditLog({
      actorId: ctx.userId,
      action: "organization_owner.import_members",
      entityType: "member",
      entityId: null,
      metadata: { imported, failed, total: rows.length } as unknown as never,
    });

    return { imported, failed, errors };
  } catch (e) {
    if (e instanceof Error) {
      return { imported: 0, failed: rows.length, errors: [{ row: 0, message: e.message }] };
    }
    return { imported: 0, failed: rows.length, errors: [{ row: 0, message: "Import failed." }] };
  }
}

export async function exportMembers(
  organizationId: string,
  filters?: { status?: string; gymId?: string },
): Promise<string> {
  const ctx = await getOrgOwnerContext("/organization/members");
  await requireOrgFeatureAccess(ctx.organizationId, "member_data_import_export");

  const supabase = await createSupabaseServerClient();

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1000);

  if (!gyms || gyms.length === 0) return "";

  let gymIds = gyms.map((g) => g.id);
  if (filters?.gymId && gymIds.includes(filters.gymId)) {
    gymIds = [filters.gymId];
  }

  let memberQuery = supabase
    .from("members")
    .select("*")
    .in("gym_id", gymIds);

  if (filters?.status && filters.status !== "all") {
    memberQuery = memberQuery.eq("status", filters.status as "active" | "inactive" | "archived");
  }

  const { data: members, error } = await memberQuery.order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!members || members.length === 0) return "";

  const memberIds = members.map((m) => m.id);

  type FVResult = { data: { member_id: string; field_id: string; value: string | null }[] | null; error: Error | null };
  const fvQuery = supabase.from("member_custom_field_values" as never) as unknown as {
    select(s: string): { in(k: string, vals: string[]): Promise<FVResult> };
  };
  const { data: fieldValues } = await fvQuery.select("member_id, field_id, value").in("member_id", memberIds);

  type CFResult = { data: { id: string; field_name: string }[] | null; error: Error | null };
  const cfExpQuery = supabase.from("custom_member_fields" as never) as unknown as {
    select(s: string): { eq(k: string, v: string): { eq(k2: string, v2: boolean): { order(c: string, o: { ascending: boolean }): Promise<CFResult> } } };
  };
  const { data: customFields } = await cfExpQuery.select("id, field_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const customFieldMap = new Map<string, string>();
  for (const f of customFields ?? []) {
    customFieldMap.set(f.id, f.field_name);
  }

  const valuesByMember = new Map<string, Record<string, string>>();
  for (const fv of fieldValues ?? []) {
    const mid = fv.member_id;
    if (!valuesByMember.has(mid)) valuesByMember.set(mid, {});
    const fieldName = customFieldMap.get(fv.field_id) ?? fv.field_id;
    valuesByMember.get(mid)![fieldName] = fv.value ?? "";
  }

  const systemHeaders = ["member_code", "full_name", "phone", "email", "date_of_birth", "gender", "address",
    "emergency_contact_name", "emergency_contact_phone", "status", "joined_at", "notes"];
  const customHeaders = (customFields ?? []).map((f) => f.field_name);
  const allHeaders = [...systemHeaders, ...customHeaders];

  const csvRows = [allHeaders.map((h) => `"${h}"`).join(",")];

  for (const member of members) {
    const row = systemHeaders.map((h) => `"${String((member as Record<string, unknown>)[h] ?? "")}"`);
    const customVals = valuesByMember.get(member.id) ?? {};
    for (const ch of customHeaders) {
      row.push(`"${String(customVals[ch] ?? "")}"`);
    }
    csvRows.push(row.join(","));
  }

  return csvRows.join("\n");
}
