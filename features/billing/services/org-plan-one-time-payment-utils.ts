export const ORG_PLAN_ONE_TIME_CHECKOUT_TTL_MS = 30 * 60 * 1000;

export function getOrgPlanOneTimeCheckoutExpiresAt(createdAt: string | Date, ttlMs: number = ORG_PLAN_ONE_TIME_CHECKOUT_TTL_MS): Date {
  const startedAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return new Date(startedAt.getTime() + ttlMs);
}

export function isOrgPlanOneTimeCheckoutExpired(
  createdAt: string | Date,
  now: Date = new Date(),
  ttlMs: number = ORG_PLAN_ONE_TIME_CHECKOUT_TTL_MS,
): boolean {
  return now.getTime() >= getOrgPlanOneTimeCheckoutExpiresAt(createdAt, ttlMs).getTime();
}
