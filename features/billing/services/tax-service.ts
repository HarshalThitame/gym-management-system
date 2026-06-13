import type { DbClient } from "./db-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidGstinFormat, parseGstin, getStateName, getGstTaxSlab } from "../lib/gstin";


function getDb(supabase: any): DbClient { return supabase as never as DbClient; }

export type TaxCalculationInput = {
  subtotal: number;
  organizationId: string;
  gymId?: string | null;
  hsnCode?: string;
  isInterState?: boolean;
};

export type TaxLineResult = {
  taxName: string;
  taxRatePercent: number;
  taxableAmount: number;
  taxAmount: number;
  isCompound: boolean;
  taxRateId: string | null;
};

export type TaxCalculationResult = {
  totalTax: number;
  taxLines: TaxLineResult[];
  isGstRegistered: boolean;
  gstin: string | null;
};

export async function calculateTax(input: TaxCalculationInput): Promise<TaxCalculationResult> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  try {
    const { data: org } = await db.from("organizations").select("*").eq("id", input.organizationId).single();
    if (!org) return { totalTax: 0, taxLines: [], isGstRegistered: false, gstin: null };

    const gstin = (org.gstin as string) || null;
    const gstRegistered = !!gstin;

    const { data: settings } = await db.from("org_tax_settings").select("*").eq("organization_id", input.organizationId).maybeSingle();
    const taxEnabled = settings ? (settings.tax_calculation_enabled as boolean) : false;
    if (!taxEnabled) return { totalTax: 0, taxLines: [], isGstRegistered: gstRegistered, gstin };

    const autoCalculate = settings ? (settings.auto_calculate_tax as boolean) : true;
    if (!autoCalculate) return { totalTax: 0, taxLines: [], isGstRegistered: gstRegistered, gstin };

    const gstSlab = getGstTaxSlab(input.subtotal, input.hsnCode);
    const isInterState = input.isInterState ?? false;
    const lines: TaxLineResult[] = [];

    if (isInterState) {
      lines.push({
        taxName: `IGST @ ${gstSlab.igstRate}%`,
        taxRatePercent: gstSlab.igstRate,
        taxableAmount: input.subtotal,
        taxAmount: Math.round((input.subtotal * gstSlab.igstRate) / 100),
        isCompound: false,
        taxRateId: null,
      });
    } else {
      lines.push({
        taxName: `CGST @ ${gstSlab.cgstRate}%`,
        taxRatePercent: gstSlab.cgstRate,
        taxableAmount: input.subtotal,
        taxAmount: Math.round((input.subtotal * gstSlab.cgstRate) / 100),
        isCompound: false,
        taxRateId: null,
      });
      lines.push({
        taxName: `SGST @ ${gstSlab.sgstRate}%`,
        taxRatePercent: gstSlab.sgstRate,
        taxableAmount: input.subtotal,
        taxAmount: Math.round((input.subtotal * gstSlab.sgstRate) / 100),
        isCompound: false,
        taxRateId: null,
      });
    }

    const totalTax = lines.reduce((s, l) => s + l.taxAmount, 0);
    return { totalTax, taxLines: lines, isGstRegistered: gstRegistered, gstin };
  } catch {
    return { totalTax: 0, taxLines: [], isGstRegistered: false, gstin: null };
  }
}

export async function validateAndSetGstin(organizationId: string, gstin: string): Promise<{
  valid: boolean;
  message: string;
  parsed?: ReturnType<typeof parseGstin>;
}> {
  if (!isValidGstinFormat(gstin)) {
    return { valid: false, message: "Invalid GSTIN format. Must be 15 characters: 2 state code + 10 PAN + 2 entity + 1 Z + 1 check." };
  }

  const parsed = parseGstin(gstin);
  if (!parsed) return { valid: false, message: "Could not parse GSTIN." };

  const stateName = getStateName(parsed.stateCode);

  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { error } = await db.from("organizations").update({
    gstin,
    gst_registered_name: undefined,
  }).eq("id", organizationId);

  if (error) return { valid: false, message: error.message };

  await db.from("org_tax_settings").insert({
    organization_id: organizationId,
    tax_calculation_enabled: true,
    auto_calculate_tax: true,
    is_gst_registered: true,
    gstin_verified_at: new Date().toISOString(),
  });

  return {
    valid: true,
    message: `GSTIN validated. State: ${stateName ?? "Unknown"}, PAN: ${parsed.pan}`,
    parsed,
  };
}

export async function getTaxRates(gymId?: string | null): Promise<Array<Record<string, unknown>>> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: global } = await db.from("tax_rates").select("*").eq("gym_id", null).order("rate_percent", { ascending: true }).limit(1000);
  if (!gymId) return global ?? [];

  const { data: gymRates } = await db.from("tax_rates").select("*").eq("gym_id", gymId).order("rate_percent", { ascending: true }).limit(1000);
  return [...(global ?? []), ...(gymRates ?? [])];
}

export async function getOrgTaxSettings(organizationId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);
  const { data } = await db.from("org_tax_settings").select("*").eq("organization_id", organizationId).maybeSingle();
  return data;
}

export async function upsertOrgTaxSettings(
  organizationId: string,
  settings: {
    taxCalculationEnabled?: boolean;
    autoCalculateTax?: boolean;
    defaultTaxRateId?: string | null;
    taxInclusivePricing?: boolean;
  }
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  const { data: existing } = await db.from("org_tax_settings").select("*").eq("organization_id", organizationId).maybeSingle();

  const payload: Record<string, unknown> = { organization_id: organizationId };
  if (settings.taxCalculationEnabled !== undefined) payload.tax_calculation_enabled = settings.taxCalculationEnabled;
  if (settings.autoCalculateTax !== undefined) payload.auto_calculate_tax = settings.autoCalculateTax;
  if (settings.defaultTaxRateId !== undefined) payload.default_tax_rate_id = settings.defaultTaxRateId;
  if (settings.taxInclusivePricing !== undefined) payload.tax_inclusive_pricing = settings.taxInclusivePricing;

  if (existing) {
    const { error } = await db.from("org_tax_settings").update(payload).eq("organization_id", organizationId);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await db.from("org_tax_settings").insert(payload);
    if (error) return { ok: false, message: error.message };
  }

  return { ok: true, message: "Tax settings updated." };
}

export async function saveInvoiceTaxLines(
  invoiceId: string,
  taxLines: Array<{ taxName: string; taxRatePercent: number; taxableAmount: number; taxAmount: number; isCompound: boolean; taxRateId?: string | null }>
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  for (const line of taxLines) {
    await db.from("invoice_tax_lines").insert({
      invoice_id: invoiceId,
      tax_rate_id: line.taxRateId ?? null,
      tax_name: line.taxName,
      tax_rate_percent: line.taxRatePercent,
      taxable_amount: line.taxableAmount,
      tax_amount: line.taxAmount,
      is_compound: line.isCompound,
    });
  }
}
