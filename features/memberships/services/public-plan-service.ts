import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MembershipPlan } from "@/types/content";

type DbPlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  plan_type: string;
  duration_days: number;
  price_amount: number;
  joining_fee_amount: number;
  currency: string;
  access_level: string;
  features: Array<{ key: string; label: string; included: boolean }>;
  status: string;
  is_public: boolean;
  display_order: number;
};

const DURATION_LABELS: Record<string, string> = {
  monthly: "30 days",
  quarterly: "90 days",
  half_yearly: "180 days",
  annual: "365 days",
  custom: "",
};

const HIGHLIGHTED_PLAN_TYPES = new Set(["quarterly"]);

function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

function formatDuration(planType: string, durationDays: number): string {
  return DURATION_LABELS[planType] || `${durationDays} days`;
}

function buildFeaturesList(dbFeatures: Array<{ key: string; label: string; included: boolean }>): string[] {
  if (!dbFeatures || dbFeatures.length === 0) return [];
  return dbFeatures
    .filter((f) => f.included)
    .map((f) => f.label || f.key);
}

function deriveBestFor(planType: string): string {
  const map: Record<string, string> = {
    monthly: "Flexible starts",
    quarterly: "Routine building",
    half_yearly: "Visible progress",
    annual: "Long-term performance",
    custom: "Tailored plan",
  };
  return map[planType] || "Custom plan";
}

export async function getPublicMembershipPlans(): Promise<MembershipPlan[]> {
  const supabase = await createSupabaseServerClient();

  const { data: rows } = await supabase
    .from("membership_plans")
    .select("name, slug, description, plan_type, duration_days, price_amount, joining_fee_amount, currency, access_level, features, status, is_public, display_order")
    .eq("status", "active")
    .eq("is_public", true)
    .order("display_order", { ascending: true })
    .limit(20) as never as {
    data: DbPlanRow[] | null;
    error: { message: string } | null;
  };

  if (!rows || rows.length === 0) return [];

  return rows.map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    duration: formatDuration(plan.plan_type, plan.duration_days),
    price: formatPrice(plan.price_amount),
    bestFor: deriveBestFor(plan.plan_type),
    description: plan.description,
    features: buildFeaturesList(plan.features as never),
    highlighted: HIGHLIGHTED_PLAN_TYPES.has(plan.plan_type),
  }));
}
