import type { PlanFeature } from "@/types/membership";

export const planFeatureCatalog = [
  { key: "gym_access", label: "Gym Access", unit: null },
  { key: "locker_access", label: "Locker Access", unit: null },
  { key: "personal_training", label: "Personal Training Sessions", unit: "sessions" },
  { key: "group_classes", label: "Group Classes", unit: "classes" },
  { key: "nutrition_consultation", label: "Nutrition Consultation", unit: "consultations" },
  { key: "guest_passes", label: "Guest Passes", unit: "passes" }
] as const;

export type PlanFeatureKey = (typeof planFeatureCatalog)[number]["key"];

export function buildPlanFeatures(enabledKeys: readonly string[], quantities: Record<string, number | null>) {
  return planFeatureCatalog.map((feature): PlanFeature => {
    const included = enabledKeys.includes(feature.key);
    const quantity = included ? quantities[feature.key] ?? null : null;

    return {
      key: feature.key,
      label: feature.label,
      included,
      quantity,
      unit: feature.unit
    };
  });
}

export function parsePlanFeatures(value: unknown): PlanFeature[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<PlanFeature>;

    if (typeof candidate.key !== "string" || typeof candidate.label !== "string" || typeof candidate.included !== "boolean") {
      return [];
    }

    return [{
      key: candidate.key,
      label: candidate.label,
      included: candidate.included,
      quantity: typeof candidate.quantity === "number" ? candidate.quantity : null,
      unit: typeof candidate.unit === "string" ? candidate.unit : null
    }];
  });
}
