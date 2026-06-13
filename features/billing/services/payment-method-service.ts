import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrgPaymentMethod } from "../types/billing-extended";

type DbResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type SelectWithFilter = {
  eq(c: string, v: unknown): SelectWithFilter;
  maybeSingle(): DbResult<Record<string, unknown>>;
  order(c: string, o: { ascending: boolean }): { limit(n: number): DbResult<Array<Record<string, unknown>>> };
};
type UpdateResult = Promise<{ error: { message: string } | null }>;
type UpdateWithEq = {
  eq(c: string, v: unknown): UpdateWithEq2;
};
type UpdateWithEq2 = {
  eq(c: string, v: unknown): UpdateResult;
};
type DeleteWithEq = {
  eq(c: string, v: unknown): DeleteWithEq2;
};
type DeleteWithEq2 = {
  eq(c: string, v: unknown): UpdateResult;
};
type DB = {
  from(t: string): {
    select(c: string): SelectWithFilter;
    insert(r: Record<string, unknown>): {
      select(c: string): DbResult<Array<Record<string, unknown>>>;
    };
    update(r: Record<string, unknown>): UpdateWithEq;
    delete(): DeleteWithEq;
  };
};

async function getDb() {
  const supabase = await createSupabaseServerClient();
  return supabase as never as DB;
}

export async function getPaymentMethods(organizationId: string): Promise<OrgPaymentMethod[]> {
  const db = await getDb();
  const { data } = await db
    .from("org_payment_methods")
    .select("")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as OrgPaymentMethod[];
}

export async function getDefaultPaymentMethod(organizationId: string): Promise<OrgPaymentMethod | null> {
  const db = await getDb();
  const { data } = await db
    .from("org_payment_methods")
    .select("")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  return (data ?? null) as unknown as OrgPaymentMethod | null;
}

export async function savePaymentMethod(
  organizationId: string,
  input: {
    provider: string;
    provider_customer_id?: string;
    payment_type: "card" | "upi" | "net_banking" | "emandate";
    display_name: string;
    last_four?: string;
    expiry_month?: number;
    expiry_year?: number;
    card_network?: string;
    is_default?: boolean;
  },
): Promise<OrgPaymentMethod> {
  const db = await getDb();

  if (input.is_default) {
    await db
      .from("org_payment_methods")
      .update({ is_default: false })
      .eq("organization_id", organizationId)
      .eq("is_default", true);
  }

  const { data } = await db
    .from("org_payment_methods")
    .insert({
      organization_id: organizationId,
      provider: input.provider,
      provider_customer_id: input.provider_customer_id ?? null,
      payment_type: input.payment_type,
      display_name: input.display_name,
      last_four: input.last_four ?? null,
      expiry_month: input.expiry_month ?? null,
      expiry_year: input.expiry_year ?? null,
      card_network: input.card_network ?? null,
      is_default: input.is_default ?? false,
      is_active: true,
    })
    .select("");
  if (!data || data.length === 0) throw new Error("Failed to save payment method");
  return data[0] as unknown as OrgPaymentMethod;
}

export async function deletePaymentMethod(organizationId: string, paymentMethodId: string): Promise<void> {
  const db = await getDb();
  const { error } = await db
    .from("org_payment_methods")
    .delete()
    .eq("id", paymentMethodId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}

export async function setDefaultPaymentMethod(organizationId: string, paymentMethodId: string): Promise<void> {
  const db = await getDb();

  await db
    .from("org_payment_methods")
    .update({ is_default: false })
    .eq("organization_id", organizationId)
    .eq("is_default", true);

  const { error } = await db
    .from("org_payment_methods")
    .update({ is_default: true })
    .eq("id", paymentMethodId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}
