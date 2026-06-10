import type { Database, Json } from "./database";

export const membershipStatuses = ["pending", "active", "expired", "cancelled", "frozen", "suspended"] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const membershipPlanTypes = ["monthly", "quarterly", "half_yearly", "annual", "custom"] as const;
export type MembershipPlanType = (typeof membershipPlanTypes)[number];

export const membershipPlanStatuses = ["draft", "active", "archived"] as const;
export type MembershipPlanStatus = (typeof membershipPlanStatuses)[number];

export const membershipEvents = ["created", "renewed", "upgraded", "downgraded", "frozen", "suspended", "reactivated", "cancelled", "expired", "plan_changed", "dates_changed"] as const;
export type MembershipEvent = (typeof membershipEvents)[number];

export const accessLevels = ["basic", "standard", "premium", "elite", "custom"] as const;
export type AccessLevel = (typeof accessLevels)[number];

export const documentTypes = ["profile_photo", "identity_proof", "medical_declaration", "membership_agreement", "other"] as const;
export type MemberDocumentType = (typeof documentTypes)[number];

export type MembershipPlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];
export type MemberRow = Database["public"]["Tables"]["members"]["Row"];
export type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
export type MembershipHistoryRow = Database["public"]["Tables"]["membership_history"]["Row"];
export type MemberDocumentRow = Database["public"]["Tables"]["member_documents"]["Row"];

export type PlanFeature = {
  key: string;
  label: string;
  included: boolean;
  quantity?: number | null;
  unit?: string | null;
};

export type MemberDirectoryItem = MemberRow & {
  current_membership: MembershipRow | null;
  current_plan: MembershipPlanRow | null;
};

export type MemberProfile = {
  member: MemberRow;
  currentMembership: MembershipRow | null;
  currentPlan: MembershipPlanRow | null;
  memberships: MembershipRow[];
  plansById: Map<string, MembershipPlanRow>;
  history: MembershipHistoryRow[];
  documents: MemberDocumentRow[];
};

export type MembershipMetrics = {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  expiringToday: number;
  expiringThisWeek: number;
  expiringThisMonth: number;
  renewalsThisMonth: number;
  newMembersThisMonth: number;
};

export type JsonRecord = Record<string, Json>;
