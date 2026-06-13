import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export type CreateContractInput = {
  organizationId: string;
  contractType: "annual_commit" | "custom_enterprise" | "mou" | "sla" | "amendment";
  title: string;
  description?: string | null;
  effectiveFrom: string;
  effectiveUntil?: string | null;
  autoRenew?: boolean;
  specialTerms?: Record<string, unknown>;
  documentUrl?: string | null;
  createdBy: string;
};

export async function createContract(input: CreateContractInput): Promise<{ ok: boolean; message: string; contractId?: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const year = new Date().getFullYear();
  const ts = String(Date.now()).slice(-6);
  const contractNumber = `CTR-${year}-${ts}`;

  const { data: contract } = await db.from("org_contracts").insert({
    organization_id: input.organizationId,
    contract_type: input.contractType,
    contract_number: contractNumber,
    title: input.title,
    description: input.description ?? null,
    effective_from: input.effectiveFrom,
    effective_until: input.effectiveUntil ?? null,
    auto_renew: input.autoRenew ?? false,
    special_terms: (input.specialTerms ?? {}) as Record<string, unknown>,
    document_url: input.documentUrl ?? null,
    status: "draft",
    created_by: input.createdBy,
  });

  if (!contract) return { ok: false, message: "Failed to create contract." };
  return { ok: true, message: "Contract created.", contractId: contract.id as string };
}

export async function signContract(contractId: string, signedBy: string, role: "org" | "provider"): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: contract } = await db.from("org_contracts").select("*").eq("id", contractId).single();
  if (!contract) return { ok: false, message: "Contract not found." };

  const field = role === "org" ? "signed_by_org" : "signed_by_provider";
  const update: Record<string, unknown> = { [field]: signedBy };

  const signedByOrg = role === "org" ? signedBy : (contract.signed_by_org as string | null);
  const signedByProvider = role === "provider" ? signedBy : (contract.signed_by_provider as string | null);

  if (signedByOrg && signedByProvider) {
    update.status = "active";
    update.signed_at = new Date().toISOString();
  }

  const { error } = await db.from("org_contracts").update(update).eq("id", contractId);
  if (error) return { ok: false, message: error.message };

  const status = signedByOrg && signedByProvider ? "active" : "pending_signature";
  return { ok: true, message: `Contract signed. Status: ${status}.` };
}

export async function terminateContract(contractId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { error } = await db.from("org_contracts").update({
    status: "terminated",
  }).eq("id", contractId);

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Contract terminated." };
}

export async function getActiveContracts(organizationId: string): Promise<Array<Record<string, unknown>>> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: contracts } = await db.from("org_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("effective_from", { ascending: false })
    .limit(10);

  return contracts ?? [];
}
