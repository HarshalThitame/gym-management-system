import { getSupabaseClient } from "@/api/supabase";
import { offlineCache } from "@/offline/cache";

export interface Offer {
  id: string;
  title: string;
  description: string;
  discount_percentage: number | null;
  discount_amount: number | null;
  valid_from: string;
  valid_until: string;
  terms: string | null;
  image_url: string | null;
  offer_type: "membership" | "referral" | "seasonal" | "upgrade" | "general";
  status: "active" | "scheduled" | "expired";
}

export const offerService = {
  async getActiveOffers(organizationId: string): Promise<Offer[]> {
    const cacheKey = offlineCache.organizationKey(organizationId, "offers");
    const cached = await offlineCache.get<Offer[]>(cacheKey);

    try {
      const supabase = getSupabaseClient();
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("offers")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .lte("valid_from", now)
        .gte("valid_until", now)
        .order("created_at", { ascending: false });

      const offers = (data ?? []) as Offer[];
      await offlineCache.set(cacheKey, offers, { ttlMs: 30 * 60 * 1000 });
      return offers;
    } catch {
      if (cached) return cached.data;
      return [];
    }
  },

  async getPersonalizedOffers(memberId: string, organizationId: string): Promise<Offer[]> {
    const all = await this.getActiveOffers(organizationId);
    const supabase = getSupabaseClient();

    const { data: membership } = await supabase
      .from("memberships")
      .select("status, end_date")
      .eq("member_id", memberId)
      .in("status", ["active", "expiring_soon"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!membership) return all;

    const expiringSoon = membership.end_date &&
      new Date(membership.end_date).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

    return all.filter((offer) => {
      if (offer.offer_type === "upgrade" && !expiringSoon) return false;
      if (offer.offer_type === "membership" && membership.status !== "active") return false;
      return true;
    });
  },
};
