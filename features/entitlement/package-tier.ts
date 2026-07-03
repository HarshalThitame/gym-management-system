export const CANONICAL_PACKAGE_TIERS = ["starter", "growth", "enterprise"] as const;

export type CanonicalPackageTier = (typeof CANONICAL_PACKAGE_TIERS)[number];

const PACKAGE_TIER_ALIASES: Record<string, CanonicalPackageTier> = {
  lite: "starter",
  starter: "starter",
  standard: "growth",
  professional: "growth",
  growth: "growth",
  premium: "enterprise",
  enterprise: "enterprise",
};

export function normalizePackageTier(value: string | null | undefined): CanonicalPackageTier | null {
  if (!value) return null;
  return PACKAGE_TIER_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function normalizePackageTierOrFallback(
  value: string | null | undefined,
  fallback: CanonicalPackageTier = "starter",
): CanonicalPackageTier {
  return normalizePackageTier(value) ?? fallback;
}
