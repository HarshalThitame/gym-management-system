export type UnauthorizedReason =
  | "tenant"
  | "feature_unavailable"
  | "subscription_suspended"
  | "subscription_cancelled"
  | "access_pending";

export function resolveUnauthorizedReason(
  reason: string | null | undefined,
  liveSubscriptionStatus: string | null | undefined,
): UnauthorizedReason {
  if (reason === "tenant" || reason === "feature_unavailable" || reason === "subscription_suspended" || reason === "subscription_cancelled") {
    return reason;
  }

  if (liveSubscriptionStatus === "cancelled") {
    return "subscription_cancelled";
  }

  if (liveSubscriptionStatus === "suspended") {
    return "subscription_suspended";
  }

  return "access_pending";
}
