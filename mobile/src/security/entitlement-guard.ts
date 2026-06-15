import { getSupabaseClient } from "@/api/supabase";

type FeatureCode = 
  | "attendance" | "qr_attendance" | "biometric_attendance" | "rfid_attendance"
  | "class_scheduling" | "trainer_assignment" | "communications" | "ai"
  | "advanced_reports" | "custom_domain" | "api_access" | "razorpay"
  | "crm" | "white_label" | "bulk_sms" | "bulk_email";

export async function checkFeatureAccess(organizationId: string, featureCode: FeatureCode): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { data: sub } = await supabase
      .from("platform_subscriptions")
      .select("plan_tier")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!sub) return false;

    switch (featureCode) {
      case "attendance": case "qr_attendance": return true;
      case "biometric_attendance": return sub.plan_tier === "enterprise";
      case "rfid_attendance": return sub.plan_tier === "enterprise";
      case "class_scheduling": return true;
      case "trainer_assignment": return true;
      case "communications": return true;
      case "ai": return sub.plan_tier === "enterprise" || sub.plan_tier === "professional";
      case "advanced_reports": return sub.plan_tier === "enterprise";
      case "custom_domain": return sub.plan_tier === "enterprise";
      case "api_access": return sub.plan_tier === "enterprise";
      case "razorpay": return true;
      case "crm": return true;
      case "white_label": return sub.plan_tier === "enterprise";
      case "bulk_sms": return sub.plan_tier === "enterprise";
      case "bulk_email": return sub.plan_tier === "professional" || sub.plan_tier === "enterprise";
      default: return false;
    }
  } catch { return false; }
}

export async function requireFeatureAccess(organizationId: string, featureCode: FeatureCode): Promise<{ ok: boolean; error?: string }> {
  const hasAccess = await checkFeatureAccess(organizationId, featureCode);
  if (!hasAccess) {
    return { ok: false, error: `Feature "${featureCode}" is not available on your current plan.` };
  }
  return { ok: true };
}
