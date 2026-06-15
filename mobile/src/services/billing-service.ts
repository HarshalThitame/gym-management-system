import { apiClient } from "@/api/client";
import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";
import type { Invoice, Payment } from "@/types";

export const billingService = {
  async getInvoices(memberId: string): Promise<Invoice[]> {
    const cacheKey = offlineCache.memberKey(memberId, "invoices");
    const cached = await offlineCache.get<Invoice[]>(cacheKey);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("member_id", memberId)
        .order("issued_at", { ascending: false });

      const invoices = (data ?? []) as Invoice[];
      await offlineCache.set(cacheKey, invoices, { ttlMs: 10 * 60 * 1000 });
      return invoices;
    } catch {
      if (cached) return cached.data;
      return [];
    }
  },

  async getInvoiceDetail(invoiceId: string): Promise<Invoice | null> {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    return data as Invoice | null;
  },

  async getPayments(memberId: string): Promise<Payment[]> {
    const cacheKey = offlineCache.memberKey(memberId, "payments");
    const cached = await offlineCache.get<Payment[]>(cacheKey);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });

      const payments = (data ?? []) as Payment[];
      await offlineCache.set(cacheKey, payments, { ttlMs: 10 * 60 * 1000 });
      return payments;
    } catch {
      if (cached) return cached.data;
      return [];
    }
  },

  async getOutstandingDues(memberId: string): Promise<number> {
    const invoices = await this.getInvoices(memberId);
    return invoices
      .filter((inv) => inv.status === "sent" || inv.status === "overdue")
      .reduce((sum, inv) => sum + (inv.due_amount ?? 0), 0);
  },

  async downloadInvoice(invoiceId: string): Promise<string | null> {
    const { data, ok } = await apiClient.get<{ url: string }>(
      `/invoices/${invoiceId}/download`
    );
    if (ok && data) return data.url;
    return null;
  },
};
