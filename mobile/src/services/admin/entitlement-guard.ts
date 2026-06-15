import { getSupabaseClient } from "@/api/supabase";

export async function checkSubscriptionActive(organizationId: string): Promise<{ ok: boolean; status: string; message?: string }> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("platform_subscriptions")
      .select("status")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!data) {
      const { data: sub } = await supabase
        .from("organization_subscriptions")
        .select("status")
        .eq("organization_id", organizationId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) return { ok: false, status: "none", message: "No subscription found." };
      if (sub.status === "suspended" || sub.status === "cancelled") {
        return { ok: false, status: sub.status, message: `Subscription is ${sub.status}. Contact support.` };
      }
      return { ok: true, status: sub.status };
    }

    if (data.status === "suspended" || data.status === "cancelled") {
      return { ok: false, status: data.status, message: `Subscription is ${data.status}.` };
    }
    return { ok: true, status: data.status };
  } catch {
    return { ok: false, status: "error", message: "Could not verify subscription." };
  }
}

export async function requireActiveSubscription(organizationId: string): Promise<void> {
  const result = await checkSubscriptionActive(organizationId);
  if (!result.ok) {
    throw new Error(result.message ?? "Subscription is not active.");
  }
}
