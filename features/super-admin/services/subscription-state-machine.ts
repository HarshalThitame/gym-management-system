export type SubscriptionStatus = "active" | "trial" | "expired" | "suspended" | "cancelled";

type Transition = {
  from: SubscriptionStatus[];
  to: SubscriptionStatus[];
  requireMfa: boolean;
  requireReason: boolean;
  label: string;
};

const TRANSITIONS: Record<string, Transition> = {
  "trial→active": { from: ["trial"], to: ["active"], requireMfa: false, requireReason: false, label: "Trial conversion" },
  "trial→expired": { from: ["trial"], to: ["expired"], requireMfa: false, requireReason: false, label: "Trial expiry" },
  "trial→suspended": { from: ["trial"], to: ["suspended"], requireMfa: true, requireReason: true, label: "Suspend trial" },
  "active→suspended": { from: ["active"], to: ["suspended"], requireMfa: true, requireReason: true, label: "Suspend" },
  "active→expired": { from: ["active"], to: ["expired"], requireMfa: false, requireReason: false, label: "Expire" },
  "active→cancelled": { from: ["active", "trial"], to: ["cancelled"], requireMfa: true, requireReason: true, label: "Cancel" },
  "suspended→active": { from: ["suspended"], to: ["active"], requireMfa: true, requireReason: true, label: "Reactivate" },
  "suspended→expired": { from: ["suspended"], to: ["expired"], requireMfa: false, requireReason: false, label: "Auto-expire after suspension" },
  "suspended→cancelled": { from: ["suspended"], to: ["cancelled"], requireMfa: true, requireReason: true, label: "Cancel while suspended" },
  "expired→active": { from: ["expired"], to: ["active"], requireMfa: true, requireReason: true, label: "Reactivate expired" },
  "cancelled→expired": { from: ["cancelled"], to: ["expired"], requireMfa: false, requireReason: false, label: "Final expiry after data retention" },
};

export function isValidTransition(from: SubscriptionStatus, to: SubscriptionStatus): Transition | null {
  const key = `${from}→${to}`;
  return TRANSITIONS[key] ?? null;
}

export function getValidTransitions(from: SubscriptionStatus): Array<{ to: SubscriptionStatus; transition: Transition }> {
  return Object.entries(TRANSITIONS)
    .filter(([, t]) => t.from.includes(from))
    .map(([, t]) => ({
      to: (t.to.find((s) => s !== from) ?? t.to[0]) as SubscriptionStatus,
      transition: t,
    }));
}

export function validateTransition(from: SubscriptionStatus, to: SubscriptionStatus): { valid: boolean; error?: string } {
  if (from === to) {
    return { valid: false, error: `Subscription is already ${from}.` };
  }
  const transition = isValidTransition(from, to);
  if (!transition) {
    return { valid: false, error: `Cannot transition from '${from}' to '${to}'.` };
  }
  return { valid: true };
}
