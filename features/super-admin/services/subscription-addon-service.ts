import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordSubscriptionEvent } from "./subscription-events-service";

type QueryRes = Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
type SingleRes = Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;

type Filter = {
  eq(c: string, v: unknown): Filter & QueryRes;
  order(c: string, o: { ascending: boolean }): QueryRes;
  maybeSingle(): SingleRes;
  single(): SingleRes;
  update(r: Record<string, unknown>): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
  delete(): { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
  insert(r: Record<string, unknown>): QueryRes & { eq(c: string, v: string): Promise<{ error: { message: string } | null }> };
};

type RawClient = {
  from(t: string): {
    select(c: string): Filter & QueryRes;
    insert(r: Record<string, unknown>): Filter & QueryRes;
    update(r: Record<string, unknown>): Filter & QueryRes;
    delete(): Filter & QueryRes;
  };
};

export type AddonDefinition = {
  id: string;
  packageId: string;
  name: string;
  description: string | null;
  type: "members" | "branches" | "storage_gb" | "feature" | "api_calls" | "support";
  unitPrice: number;
  maxQuantity: number;
  isActive: boolean;
};

function mapAddonDefinition(row: Record<string, unknown>): AddonDefinition {
  return {
    id: row.id as string,
    packageId: row.package_id as string,
    name: row.name as string,
    description: row.description as string | null,
    type: row.type as AddonDefinition["type"],
    unitPrice: Number(row.unit_price ?? 0),
    maxQuantity: Number(row.max_quantity ?? 1),
    isActive: Boolean(row.is_active),
  };
}

export type AssignedAddon = {
  id: string;
  addonId: string;
  name: string;
  type: AddonDefinition["type"];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export async function getAvailableAddons(packageId: string): Promise<AddonDefinition[]> {
  const supabase = await createSupabaseServerClient();
  const q = (supabase as never as RawClient).from("package_addons");
  const { data, error } = await q
    .select("")
    .eq("package_id", packageId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAddonDefinition);
}

export async function getAssignedAddons(subscriptionId: string): Promise<AssignedAddon[]> {
  const supabase = await createSupabaseServerClient();
  const q = (supabase as never as RawClient).from("subscription_addons");
  const { data, error } = await q
    .select("")
    .eq("subscription_id", subscriptionId);

  if (error) throw new Error(error.message);

  const { data: addonRows } = await (supabase as never as RawClient)
    .from("package_addons")
    .select("");
  const addonsById = new Map((addonRows ?? []).map((row) => [row.id as string, mapAddonDefinition(row)]));

  return (data ?? []).map((r: Record<string, unknown>) => {
    const addon = addonsById.get(r.addon_id as string);
    const unitPrice = Number(r.unit_price ?? addon?.unitPrice ?? 0);
    const quantity = Number(r.quantity ?? 0);
    return {
    id: r.id as string,
    addonId: r.addon_id as string,
    name: addon?.name ?? "Unknown add-on",
    type: addon?.type ?? "feature",
    quantity,
    unitPrice,
    totalPrice: quantity * unitPrice,
  };
  });
}

export async function assignAddon(
  subscriptionId: string,
  addonId: string,
  quantity: number,
  actorId: string,
  reason: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const q = (supabase as never as RawClient);

  const { data: addons } = await q.from("package_addons")
    .select("")
    .eq("id", addonId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const addonDef = addons?.[0] ? mapAddonDefinition(addons[0]) : null;
  if (!addonDef) throw new Error("Add-on not found or inactive.");

  if (quantity > addonDef.maxQuantity) {
    throw new Error(`Maximum quantity for "${addonDef.name}" is ${addonDef.maxQuantity}.`);
  }

  const orgId = await resolveOrgIdFromSubscription(subscriptionId);

  const assigned = await getAssignedAddons(subscriptionId);
  const alreadyAssigned = assigned.find((a) => a.addonId === addonId);
  const nextQuantity = (alreadyAssigned?.quantity ?? 0) + quantity;
  if (nextQuantity > addonDef.maxQuantity) {
    throw new Error(`Maximum quantity for "${addonDef.name}" is ${addonDef.maxQuantity}. Current quantity is ${alreadyAssigned?.quantity ?? 0}.`);
  }

  if (alreadyAssigned) {
    const { error } = await q.from("subscription_addons").update({ quantity: nextQuantity, unit_price: addonDef.unitPrice }).eq("id", alreadyAssigned.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await q.from("subscription_addons").insert({
      subscription_id: subscriptionId,
      addon_id: addonId,
      quantity,
      unit_price: addonDef.unitPrice,
    });
    if (error) throw new Error(error.message);
  }

  await recordSubscriptionEvent({
    organizationId: orgId,
    subscriptionId,
    eventType: alreadyAssigned ? "addon_quantity_changed" : "addon_added",
    previousState: alreadyAssigned ? { addonId, quantity: alreadyAssigned.quantity } : null,
    newState: { addonId, name: addonDef.name, quantity: nextQuantity, unitPrice: addonDef.unitPrice },
    actorId,
    reason,
  });
}

export async function removeAddon(assignedAddonId: string, actorId: string, reason: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const q = (supabase as never as RawClient);

  const { data: existing } = await q.from("subscription_addons").select("").eq("id", assignedAddonId).maybeSingle();
  if (!existing) throw new Error("Add-on assignment not found.");

  const subId = existing.subscription_id as string;
  const orgId = await resolveOrgIdFromSubscription(subId);
  const { data: addon } = await q.from("package_addons").select("").eq("id", existing.addon_id as string).maybeSingle();

  const { error } = await q.from("subscription_addons").delete().eq("id", assignedAddonId);
  if (error) throw new Error(error.message);

  await recordSubscriptionEvent({
    organizationId: orgId,
    subscriptionId: subId,
    eventType: "addon_removed",
    previousState: {
      addonId: existing.addon_id,
      name: addon?.name ?? "Unknown add-on",
      quantity: existing.quantity,
      unitPrice: existing.unit_price,
    },
    actorId,
    reason,
  });
}

async function resolveOrgIdFromSubscription(subscriptionId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as { from(t: string): { select(c: string): { eq(c: string, v: string): Promise<{ data: Record<string, unknown>[] | null }> } } };
  const { data } = await db.from("organization_subscriptions").select("organization_id").eq("id", subscriptionId);
  return (data?.[0]?.organization_id as string) ?? "";
}
