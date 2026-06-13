import { createSupabaseServerClient } from "@/lib/supabase/server";
import { billingLogger } from "../lib/logger";

type DbExec = {
  from(t: string): {
    select(c: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
  };
};

function getDb(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): DbExec {
  return supabase as never as DbExec;
}

export type Gstr1LineItem = {
  supplierGstin: string | null;
  supplierAddress: string | null;
  supplierCity: string | null;
  supplierState: string | null;
  supplierZip: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  totalTax: number;
  customerName: string | null;
  customerGstin: string | null;
  taxRate: number | null;
  taxableAmount: number | null;
  lineTax: number | null;
};

export async function getGstr1Report(gymId?: string | null): Promise<Gstr1LineItem[]> {
  const supabase = await createSupabaseServerClient();
  const db = getDb(supabase);

  try {
    const { data: rows } = await db.from("gstr1_report").select("*");
    if (!rows) return [];

    let filtered = rows;
    if (gymId) {
      filtered = rows.filter((r) => (r.supplier_gstin as string) != null);
    }

    return filtered.map((r) => ({
      supplierGstin: r.supplier_gstin as string | null,
      supplierAddress: r.supplier_address as string | null,
      supplierCity: r.supplier_city as string | null,
      supplierState: r.supplier_state as string | null,
      supplierZip: r.supplier_zip as string | null,
      invoiceNumber: r.invoice_number as string,
      invoiceDate: r.invoice_date as string,
      invoiceValue: (r.invoice_value as number) ?? 0,
      totalTax: (r.total_tax as number) ?? 0,
      customerName: r.customer_name as string | null,
      customerGstin: r.customer_gstin as string | null,
      taxRate: r.tax_rate != null ? Number(r.tax_rate) : null,
      taxableAmount: r.taxable_amount != null ? Number(r.taxable_amount) : null,
      lineTax: r.line_tax != null ? Number(r.line_tax) : null,
    }));
  } catch (err) {
    billingLogger.error("getGstr1Report", "Failed to fetch GSTR-1 report", { error: err instanceof Error ? err.message : "unknown" });
    return [];
  }
}

export async function getTaxSummary(organizationId: string, fromDate: string, toDate: string): Promise<{
  totalInvoiced: number;
  totalTax: number;
  totalGst: number;
  invoiceCount: number;
  byRate: Record<string, { count: number; taxableAmount: number; taxAmount: number }>;
}> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as never as {
    from(t: string): {
      select(c: string): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;
    };
  };

  try {
    const { data: invoices } = await db.from("invoices").select("*");

    const filtered = (invoices ?? []).filter((inv: Record<string, unknown>) => {
      const issuedAt = inv.issued_at as string | null;
      if (!issuedAt) return false;
      return issuedAt >= fromDate && issuedAt <= toDate;
    });

    const totalInvoiced = filtered.reduce((s: number, inv: Record<string, unknown>) => s + ((inv.total_amount as number) || 0), 0);
    const totalTax = filtered.reduce((s: number, inv: Record<string, unknown>) => s + ((inv.tax_amount as number) || 0), 0);
    const invoiceCount = filtered.length;

    const byRate: Record<string, { count: number; taxableAmount: number; taxAmount: number }> = {};
    const { data: taxLines } = await db.from("invoice_tax_lines").select("*");

    for (const line of taxLines ?? []) {
      const invId = line.invoice_id as string;
      if (!filtered.some((inv: Record<string, unknown>) => inv.id === invId)) continue;
      const rate = String(line.tax_rate_percent ?? "0");
      if (!byRate[rate]) byRate[rate] = { count: 0, taxableAmount: 0, taxAmount: 0 };
      byRate[rate].count++;
      byRate[rate].taxableAmount += (line.taxable_amount as number) || 0;
      byRate[rate].taxAmount += (line.tax_amount as number) || 0;
    }

    return { totalInvoiced, totalTax, totalGst: totalTax, invoiceCount, byRate };
  } catch (err) {
    billingLogger.error("getTaxSummary", "Failed to fetch tax summary", { error: err instanceof Error ? err.message : "unknown" });
    return { totalInvoiced: 0, totalTax: 0, totalGst: 0, invoiceCount: 0, byRate: {} };
  }
}
