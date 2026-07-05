"use server";

import { getOrgOwnerContext, auditOrgAction, revalidateOrgModules } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";
import { writeAuditLog } from "@/lib/audit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateDeviceApiKey } from "@/lib/security/device-auth";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import type { Json } from "@/types/database";

const MODULE_PATH = "/organization/attendance";

export async function getDevices(
  organizationId: string,
  options?: { status?: string; deviceTypeId?: string; branchId?: string; page?: number; pageSize?: number }
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const client = getSupabaseAdminClient();
  const page = options?.page ?? 1;
  const pageSize = Math.min(Math.max(1, options?.pageSize ?? 20), 100);
  const offset = (page - 1) * pageSize;

  let query = client
    .from("attendance_devices")
    .select("*, device_types!inner(name, code, manufacturer, model)", { count: "exact" })
    .eq("organization_id", organizationId);

  if (options?.status) query = query.eq("status", options.status);
  if (options?.deviceTypeId) query = query.eq("device_type_id", options.deviceTypeId);
  if (options?.branchId) query = query.eq("branch_id", options.branchId);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(error.message);
  return { items: (data ?? []) as unknown as Record<string, unknown>[], total: count ?? 0 };
}

export async function getDeviceEventLogs(
  organizationId: string,
  deviceId: string,
  options?: { eventType?: string; page?: number; pageSize?: number }
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const client = getSupabaseAdminClient();
  const page = options?.page ?? 1;
  const pageSize = Math.min(Math.max(1, options?.pageSize ?? 20), 50);
  const offset = (page - 1) * pageSize;

  let query = client
    .from("device_event_logs")
    .select("*", { count: "exact" })
    .eq("device_id", deviceId);

  if (options?.eventType) query = query.eq("event_type", options.eventType);

  const { data, count, error } = await query
    .order("occurred_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw new Error(error.message);
  return { items: (data ?? []) as unknown as Record<string, unknown>[], total: count ?? 0 };
}

export async function getDeviceTypes(): Promise<Record<string, unknown>[]> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("device_types")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Record<string, unknown>[];
}

export async function registerDeviceAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext(MODULE_PATH);
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "attendance_api",
      actionName: "attendance.device.register",
    });

    const client = getSupabaseAdminClient();
    const deviceName = String(formData.get("device_name") ?? "");
    const deviceTypeId = String(formData.get("device_type_id") ?? "");
    const branchId = formData.get("branch_id") as string | null;
    const location = formData.get("location") as string | null;
    const ipAddress = formData.get("ip_address") as string | null;
    const serialNumber = formData.get("serial_number") as string | null;

    if (!deviceName || !deviceTypeId) {
      return { ...prevState, status: "error", message: "Device name and type are required." };
    }

    const { plaintext, hash } = generateDeviceApiKey();

    const { data: device, error } = await client
      .from("attendance_devices")
      .insert({
        device_name: deviceName,
        device_type_id: deviceTypeId,
        organization_id: ctx.organizationId,
        branch_id: branchId || null,
        api_key: hash,
        location: location || null,
        ip_address: ipAddress || null,
        serial_number: serialNumber || null,
        is_active: true,
        status: "offline",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await client.from("device_event_logs").insert({
      device_id: device.id,
      event_type: "config_change",
      payload: { action: "registered", registered_by: ctx.userId },
    });

    await auditOrgAction(ctx.userId, "device.registered", "attendance_device", device.id, {
      device_name: deviceName,
      device_type_id: deviceTypeId,
    });

    revalidateOrgModules([MODULE_PATH]);

    return {
      ...prevState,
      status: "success",
      message: `Device registered. Save this API key — it won't be shown again: ${plaintext}`,
      data: { api_key: plaintext } as unknown as Json,
    };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to register device.");
  }
}

export async function updateDeviceAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext(MODULE_PATH);
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "attendance_api",
      actionName: "attendance.device.update",
    });

    const client = getSupabaseAdminClient();
    const deviceId = String(formData.get("device_id") ?? "");
    const deviceName = formData.get("device_name") as string | null;
    const branchId = formData.get("branch_id") as string | null;
    const location = formData.get("location") as string | null;
    const isActive = formData.get("is_active");
    const regenerateKey = formData.get("regenerate_api_key") === "true";

    if (!deviceId) {
      return { ...prevState, status: "error", message: "Device ID is required." };
    }

    const updates: Record<string, unknown> = {};
    if (deviceName) updates.device_name = deviceName;
    updates.branch_id = branchId || null;
    updates.location = location || null;
    if (isActive !== null) updates.is_active = isActive === "true";

    let newPlaintextKey: string | undefined;
    if (regenerateKey) {
      const { plaintext, hash } = generateDeviceApiKey();
      updates.api_key = hash;
      newPlaintextKey = plaintext;
    }

    if (Object.keys(updates).length === 0) {
      return { ...prevState, status: "error", message: "No fields to update." };
    }

    const { data: device, error } = await client
      .from("attendance_devices")
      .update(updates)
      .eq("id", deviceId)
      .eq("organization_id", ctx.organizationId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await client.from("device_event_logs").insert({
      device_id: deviceId,
      event_type: "config_change",
      payload: { updates: Object.keys(updates) },
    });

    await auditOrgAction(ctx.userId, "device.updated", "attendance_device", deviceId, { updates: Object.keys(updates) });
    revalidateOrgModules([MODULE_PATH]);

    const message = newPlaintextKey
      ? `Device updated. New API key: ${newPlaintextKey}`
      : "Device updated.";

    return { ...prevState, status: "success", message };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to update device.");
  }
}

export async function decommissionDeviceAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext(MODULE_PATH);
    await requireOrganizationFeatureAccess({
      organizationId: ctx.organizationId,
      featureKey: "attendance_api",
      actionName: "attendance.device.decommission",
    });

    const client = getSupabaseAdminClient();
    const deviceId = String(formData.get("device_id") ?? "");

    if (!deviceId) {
      return { ...prevState, status: "error", message: "Device ID is required." };
    }

    const { error } = await client
      .from("attendance_devices")
      .update({ is_active: false, status: "decommissioned" })
      .eq("id", deviceId)
      .eq("organization_id", ctx.organizationId);

    if (error) throw new Error(error.message);

    await client.from("device_event_logs").insert({
      device_id: deviceId,
      event_type: "config_change",
      payload: { action: "decommissioned", decommissioned_by: ctx.userId },
    });

    await auditOrgAction(ctx.userId, "device.decommissioned", "attendance_device", deviceId);
    revalidateOrgModules([MODULE_PATH]);

    return { ...prevState, status: "success", message: "Device decommissioned." };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to decommission device.");
  }
}
