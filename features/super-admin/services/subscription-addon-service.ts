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
    select(c: string): Filter;
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
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    packageId: r.package_id as string,
    name: r.name as string,
    description: r.description as string | null,
    type: r.type as AddonDefinition["type"],
    unitPrice: r.unit_price as number,
    maxQuantity: r.max_quantity as number,
    isActive: r.is_active as boolean,
  }));
}

export async function getAssignedAddons(subscriptionId: string): Promise<AssignedAddon[]> {
  const supabase = await createSupabaseServerClient();
  const q = (supabase as never as RawClient).from("subscription_addons");
  const { data, error } = await q
    .select("")
    .eq("subscription_id", subscriptionId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    addonId: r.addon_id as string,
    name: ((r.package_addons as Record<string, unknown> | null)?.name as string) ?? "",
    type: ((r.package_addons as Record<string, unknown> | null)?.type as AssignedAddon["type"]) ?? "feature",
    quantity: r.quantity as number,
    unitPrice: r.unit_price as number,
    totalPrice: (r.quantity as number) * (r.unit_price as number),
  }));
}

export async function assignAddon(
  subscriptionId: string,
  addonId: string,
  quantity: number,
  actorId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const q = (supabase as never as RawClient);

  const { data: addons } = await q.from("package_addons")
    .select("")
    .eq("id", addonId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const addonDef = (addons ?? [])[0] as AddonDefinition | undefined;
  if (!addonDef) throw new Error("Add-on not found or inactive.");

  if (quantity > addonDef.maxQuantity) {
    throw new Error(`Maximum quantity for "${addonDef.name}" is ${addonDef.maxQuantity}.`);
  }

  const orgId = await resolveOrgIdFromSubscription(subscriptionId);

  const assigned = await getAssignedAddons(subscriptionId);
  const alreadyAssigned = assigned.find((a) => a.addonId === addonId);
  if (alreadyAssigned) {
    const { error } = await q.from("subscription_addons").select("").update({ quantity: alreadyAssigned.quantity + quantity, unit_price: addonDef.unitPrice }).eq("id", alreadyAssigned.id);
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
    newState: { addonId, name: addonDef.name, quantity },
    actorId,
  });
}

export async function removeAddon(assignedAddonId: string, actorId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const q = (supabase as never as RawClient);

  const { data: existing } = await q.from("subscription_addons").select("").eq("id", assignedAddonId).maybeSingle();
  if (!existing) throw new Error("Add-on assignment not found.");

  const subId = existing.subscription_id as string;
  const orgId = await resolveOrgIdFromSubscription(subId);

  const { error } = await q.from("subscription_addons").delete().eq("id", assignedAddonId);
  if (error) throw new Error(error.message);

  await recordSubscriptionEvent({
    organizationId: orgId,
    subscriptionId: subId,
    eventType: "addon_removed",
    previousState: { addonId: existing.addon_id },
    actorId,
    reason: `Removed add-on: ${((existing.package_addons as Record<string, unknown>)?.name as string) ?? "Unknown"}`,
  });
}

async function resolveOrgIdFromSubscription(subscriptionId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as { from(t: string): { select(c: string): { eq(c: string, v: string): Promise<{ data: Record<string, unknown>[] | null }> } } };
  const { data } = await db.from("organization_subscriptions").select("organization_id").eq("id", subscriptionId);
  return (data?.[0]?.organization_id as string) ?? "";
}
