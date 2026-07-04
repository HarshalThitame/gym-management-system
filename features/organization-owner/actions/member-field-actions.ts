"use server";

import { writeAuditLog } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { getOrgOwnerContext, revalidateOrgModules } from "./action-utils";
import { requireOrgFeatureAccess, entitlementActionCatch } from "@/features/entitlement";

export type CustomField = {
  id: string;
  organization_id: string;
  field_name: string;
  field_type: "text" | "number" | "date" | "select";
  options: string[];
  required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MemberCustomFieldValue = {
  field: CustomField;
  value: string;
};

function toCustomField(row: unknown): CustomField {
  const r = row as Record<string, unknown>;
  const raw = r.options;
  const options: string[] = Array.isArray(raw) ? raw as string[] : [];
  return {
    id: r.id as string,
    organization_id: r.organization_id as string,
    field_name: r.field_name as string,
    field_type: (r.field_type as string) as CustomField["field_type"],
    options,
    required: Boolean(r.required),
    sort_order: (r.sort_order as number) ?? 0,
    is_active: Boolean(r.is_active),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

export async function getCustomFields(organizationId: string): Promise<CustomField[]> {
  const ctx = await getOrgOwnerContext("/organization/members");
  const { organizationId: scopedOrganizationId } = await requireOrgFeatureAccess(ctx.organizationId, "custom_member_fields");
  if (organizationId !== scopedOrganizationId) {
    throw new Error("Organization scope mismatch.");
  }

  const supabase = await createSupabaseServerClient();
  const query = supabase.from("custom_member_fields" as never) as unknown as {
    select(s: string): {
      eq(k: string, v: string): { eq(k2: string, v2: boolean): { order(c: string, o: { ascending: boolean }): Promise<{ data: unknown[] | null; error: Error | null }> } };
    };
  };
  const { data, error } = await query.select("*").eq("organization_id", scopedOrganizationId).eq("is_active", true).order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toCustomField);
}

export async function createCustomField(
  organizationId: string,
  data: { field_name: string; field_type: string; options?: string[] | null; required?: boolean; sort_order?: number },
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    const { organizationId: scopedOrganizationId } = await requireOrgFeatureAccess(ctx.organizationId, "custom_member_fields");
    if (organizationId !== scopedOrganizationId) {
      return { status: "error", message: "Organization scope mismatch." };
    }

    if (!data.field_name || !data.field_type) {
      return { status: "error", message: "Field name and type are required." };
    }

    const supabase = await createSupabaseServerClient();
    const query = supabase.from("custom_member_fields" as never) as unknown as {
      insert(obj: Record<string, unknown>): { select(s: string): { single(): Promise<{ data: { id: string } | null; error: Error | null }> } };
    };
    const { data: created, error } = await query.insert({
      organization_id: scopedOrganizationId,
      field_name: data.field_name,
      field_type: data.field_type,
      options: data.options ?? [],
      required: data.required ?? false,
      sort_order: data.sort_order ?? 0,
    }).select("id").single();

    if (error) throw new Error(error.message);
    const createdId = created?.id ?? "";
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.create_custom_field", entityType: "custom_member_field", entityId: createdId });
    revalidateOrgModules(["/organization/members"]);
    return { status: "success", message: "Custom field created." };
  } catch (e) {
    return entitlementActionCatch({ status: "idle", message: "" }, e, "Failed to create custom field.");
  }
}

export async function updateCustomField(
  organizationId: string,
  fieldId: string,
  data: { field_name?: string; field_type?: string; options?: string[] | null; required?: boolean; sort_order?: number; is_active?: boolean },
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    const { organizationId: scopedOrganizationId } = await requireOrgFeatureAccess(ctx.organizationId, "custom_member_fields");
    if (organizationId !== scopedOrganizationId) {
      return { status: "error", message: "Organization scope mismatch." };
    }

    const supabase = await createSupabaseServerClient();
    const updateObj: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.field_name !== undefined) updateObj.field_name = data.field_name;
    if (data.field_type !== undefined) updateObj.field_type = data.field_type;
    if (data.options !== undefined) updateObj.options = data.options ?? [];
    if (data.required !== undefined) updateObj.required = data.required;
    if (data.sort_order !== undefined) updateObj.sort_order = data.sort_order;
    if (data.is_active !== undefined) updateObj.is_active = data.is_active;

    const query = supabase.from("custom_member_fields" as never) as unknown as {
      update(obj: Record<string, unknown>): { eq(k: string, v: string): { eq(k2: string, v2: string): Promise<{ error: Error | null }> } };
    };
    const { error } = await query.update(updateObj).eq("id", fieldId).eq("organization_id", scopedOrganizationId);

    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.update_custom_field", entityType: "custom_member_field", entityId: fieldId });
    revalidateOrgModules(["/organization/members"]);
    return { status: "success", message: "Custom field updated." };
  } catch (e) {
    return entitlementActionCatch({ status: "idle", message: "" }, e, "Failed to update custom field.");
  }
}

export async function deleteCustomField(
  organizationId: string,
  fieldId: string,
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    const { organizationId: scopedOrganizationId } = await requireOrgFeatureAccess(ctx.organizationId, "custom_member_fields");
    if (organizationId !== scopedOrganizationId) {
      return { status: "error", message: "Organization scope mismatch." };
    }

    const supabase = await createSupabaseServerClient();
    const query = supabase.from("custom_member_fields" as never) as unknown as {
      delete(): { eq(k: string, v: string): { eq(k2: string, v2: string): Promise<{ error: Error | null }> } };
    };
    const { error } = await query.delete().eq("id", fieldId).eq("organization_id", scopedOrganizationId);

    if (error) throw new Error(error.message);
    await writeAuditLog({ actorId: ctx.userId, action: "organization_owner.delete_custom_field", entityType: "custom_member_field", entityId: fieldId });
    revalidateOrgModules(["/organization/members"]);
    return { status: "success", message: "Custom field deleted." };
  } catch (e) {
    return entitlementActionCatch({ status: "idle", message: "" }, e, "Failed to delete custom field.");
  }
}

export async function getMemberCustomFieldValues(memberId: string): Promise<MemberCustomFieldValue[]> {
  const ctx = await getOrgOwnerContext("/organization/members");
  const { organizationId } = await requireOrgFeatureAccess(ctx.organizationId, "custom_member_fields");
  const supabase = await createSupabaseServerClient();
  await assertMemberBelongsToOrganization(supabase, memberId, organizationId);

  const valuesQuery = supabase.from("member_custom_field_values" as never) as unknown as {
    select(s: string): { eq(k: string, v: string): Promise<{ data: { field_id: string; value: string | null }[] | null; error: Error | null }> };
  };
  const { data: values, error } = await valuesQuery.select("field_id, value").eq("member_id", memberId);

  if (error) throw new Error(error.message);
  if (!values || values.length === 0) return [];

  const fieldIds = values.map((v) => v.field_id);

  const fieldsQuery = supabase.from("custom_member_fields" as never) as unknown as {
    select(s: string): { in(k: string, vals: string[]): { eq(k2: string, v2: boolean): Promise<{ data: unknown[] | null; error: Error | null }> } };
  };
  const { data: fields } = await fieldsQuery.select("*").in("id", fieldIds).eq("is_active", true);

  const fieldMap = new Map<string, CustomField>();
  for (const f of fields ?? []) {
    const cf = toCustomField(f);
    fieldMap.set(cf.id, cf);
  }

  return values.map((v) => ({
    field: fieldMap.get(v.field_id) ?? ({
      id: v.field_id, field_name: "Unknown", field_type: "text" as const,
      options: [], required: false, sort_order: 0, is_active: false,
      organization_id: "", created_at: "", updated_at: "",
    }),
    value: v.value ?? "",
  }));
}

export async function saveMemberCustomFieldValues(
  memberId: string,
  values: { fieldId: string; value: string }[],
): Promise<void> {
  const ctx = await getOrgOwnerContext("/organization/members");
  const { organizationId } = await requireOrgFeatureAccess(ctx.organizationId, "custom_member_fields");
  const supabase = await createSupabaseServerClient();
  await assertMemberBelongsToOrganization(supabase, memberId, organizationId);
  await assertFieldsBelongToOrganization(supabase, values.map((value) => value.fieldId), organizationId);
  const query = supabase.from("member_custom_field_values" as never) as unknown as {
    upsert(objs: { member_id: string; field_id: string; value: string; updated_at: string }[], opts: { onConflict: string }): Promise<{ error: Error | null }>;
  };

  const rows = values.map((v) => ({
    member_id: memberId,
    field_id: v.fieldId,
    value: v.value,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await query.upsert(rows, { onConflict: "member_id, field_id" });
  if (error) throw new Error(error.message);
}

async function assertMemberBelongsToOrganization(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  memberId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("members")
    .select("id, gyms!inner(organization_id)")
    .eq("id", memberId)
    .eq("gyms.organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Member is not available in your organization.");
}

async function assertFieldsBelongToOrganization(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  fieldIds: string[],
  organizationId: string,
) {
  const uniqueFieldIds = Array.from(new Set(fieldIds.filter((fieldId) => fieldId.length > 0)));
  if (uniqueFieldIds.length === 0) return;

  const fieldsQuery = supabase.from("custom_member_fields" as never) as unknown as {
    select(s: string): { in(k: string, vals: string[]): { eq(k2: string, v2: string): Promise<{ data: Array<{ id: string }> | null; error: Error | null }> } };
  };
  const { data, error } = await fieldsQuery.select("id").in("id", uniqueFieldIds).eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
  if ((data ?? []).length !== uniqueFieldIds.length) {
    throw new Error("One or more custom fields are outside your organization scope.");
  }
}
