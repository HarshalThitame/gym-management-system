import type { Json } from "@/types/database";
import type { OrganizationRow } from "@/types/enterprise";

export const criticalMfaFreshnessWindowMs = 10 * 60 * 1000;

export type OrganizationGovernanceSnapshot = {
  id: string;
  name: string;
  slug: string;
  status: string;
  organizationType: string;
  primaryDomain: string | null;
  billingEmail: string | null;
  ownerUserId: string | null;
  governance: Json | null;
};

export type OrganizationDiffItem = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type OrganizationSoftDeleteState = {
  deletedAt: string | null;
  restoreUntil: string | null;
  deletedBy: string | null;
  reason: string | null;
  approvalId: string | null;
  restoredAt: string | null;
  restoredBy: string | null;
};

export type OrganizationLegalHoldState = {
  active: boolean;
  reason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type OrganizationPurgeEligibility = {
  eligible: boolean;
  reasons: string[];
};

type OrganizationSnapshotSource = Pick<
  OrganizationRow,
  "id" | "name" | "slug" | "status" | "organization_type" | "primary_domain" | "billing_email" | "owner_user_id" | "settings"
>;

const diffLabels: Record<keyof Omit<OrganizationGovernanceSnapshot, "id">, string> = {
  name: "Name",
  slug: "Slug",
  status: "Status",
  organizationType: "Type",
  primaryDomain: "Primary domain",
  billingEmail: "Billing email",
  ownerUserId: "Owner",
  governance: "Governance metadata"
};

export function buildOrganizationSnapshot(organization: OrganizationSnapshotSource): OrganizationGovernanceSnapshot {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    organizationType: organization.organization_type,
    primaryDomain: organization.primary_domain,
    billingEmail: organization.billing_email,
    ownerUserId: organization.owner_user_id,
    governance: getGovernanceSettings(organization.settings)
  };
}

export function buildOrganizationDiff(
  before: OrganizationGovernanceSnapshot,
  after: OrganizationGovernanceSnapshot
): OrganizationDiffItem[] {
  const keys = Object.keys(diffLabels) as Array<keyof Omit<OrganizationGovernanceSnapshot, "id">>;

  return keys.flatMap((key) => {
    const beforeValue = stringifyDiffValue(before[key]);
    const afterValue = stringifyDiffValue(after[key]);
    if (beforeValue === afterValue) {
      return [];
    }

    return [{
      field: key,
      label: diffLabels[key],
      before: beforeValue,
      after: afterValue
    }];
  });
}

export function getOrganizationSoftDeleteState(settings: Json): OrganizationSoftDeleteState {
  const empty: OrganizationSoftDeleteState = {
    deletedAt: null,
    restoreUntil: null,
    deletedBy: null,
    reason: null,
    approvalId: null,
    restoredAt: null,
    restoredBy: null
  };

  const governance = getGovernanceSettings(settings);
  if (!governance || typeof governance !== "object" || Array.isArray(governance)) {
    return empty;
  }

  const softDelete = (governance as Record<string, Json | undefined>).softDelete;
  if (!softDelete || typeof softDelete !== "object" || Array.isArray(softDelete)) {
    return empty;
  }

  const value = softDelete as Record<string, Json | undefined>;
  return {
    deletedAt: stringOrNull(value.deletedAt),
    restoreUntil: stringOrNull(value.restoreUntil),
    deletedBy: stringOrNull(value.deletedBy),
    reason: stringOrNull(value.reason),
    approvalId: stringOrNull(value.approvalId),
    restoredAt: stringOrNull(value.restoredAt),
    restoredBy: stringOrNull(value.restoredBy)
  };
}

export function mergeSoftDeleteSettings(
  settings: Json,
  input: {
    deletedAt: string;
    restoreUntil: string;
    deletedBy: string | null;
    reason: string | null;
    approvalId: string | null;
  }
): Json {
  const base = jsonObject(settings);
  const governance = jsonObject(base.governance);

  return {
    ...base,
    governance: {
      ...governance,
      softDelete: {
        deletedAt: input.deletedAt,
        restoreUntil: input.restoreUntil,
        deletedBy: input.deletedBy,
        reason: input.reason,
        approvalId: input.approvalId,
        restoredAt: null,
        restoredBy: null
      }
    }
  };
}

export function mergeRestoredOrganizationSettings(
  settings: Json,
  input: {
    restoredAt: string;
    restoredBy: string | null;
  }
): Json {
  const base = jsonObject(settings);
  const governance = jsonObject(base.governance);
  const softDelete = jsonObject(governance.softDelete);

  return {
    ...base,
    governance: {
      ...governance,
      softDelete: {
        ...softDelete,
        restoredAt: input.restoredAt,
        restoredBy: input.restoredBy
      }
    }
  };
}

export function getOrganizationLegalHoldState(settings: Json): OrganizationLegalHoldState {
  const empty: OrganizationLegalHoldState = {
    active: false,
    reason: null,
    updatedAt: null,
    updatedBy: null
  };

  const governance = getGovernanceSettings(settings);
  if (!governance || typeof governance !== "object" || Array.isArray(governance)) {
    return empty;
  }

  const legalHold = (governance as Record<string, Json | undefined>).legalHold;
  if (!legalHold || typeof legalHold !== "object" || Array.isArray(legalHold)) {
    return empty;
  }

  const value = legalHold as Record<string, Json | undefined>;
  return {
    active: booleanValue(value.active),
    reason: stringOrNull(value.reason),
    updatedAt: stringOrNull(value.updatedAt),
    updatedBy: stringOrNull(value.updatedBy)
  };
}

export function mergeLegalHoldSettings(
  settings: Json,
  input: {
    active: boolean;
    reason: string | null;
    updatedAt: string;
    updatedBy: string | null;
  }
): Json {
  const base = jsonObject(settings);
  const governance = jsonObject(base.governance);

  return {
    ...base,
    governance: {
      ...governance,
      legalHold: {
        active: input.active,
        reason: input.reason,
        updatedAt: input.updatedAt,
        updatedBy: input.updatedBy
      }
    }
  };
}

export function mergePermanentPurgeRequestedSettings(
  settings: Json,
  input: {
    requestedAt: string;
    requestedBy: string | null;
    reason: string | null;
    approvalId: string | null;
  }
): Json {
  const base = jsonObject(settings);
  const governance = jsonObject(base.governance);

  return {
    ...base,
    governance: {
      ...governance,
      permanentPurge: {
        requestedAt: input.requestedAt,
        requestedBy: input.requestedBy,
        reason: input.reason,
        approvalId: input.approvalId,
        completedAt: null
      }
    }
  };
}

export function getOrganizationPurgeEligibility(input: {
  status: string;
  softDelete: OrganizationSoftDeleteState;
  legalHold: OrganizationLegalHoldState;
  operationalBlockers: string[];
  nowMs?: number;
}): OrganizationPurgeEligibility {
  const reasons = [
    input.status !== "archived" ? "Organization must be soft-deleted before permanent purge." : null,
    input.softDelete.restoreUntil && isRestoreWindowOpen(input.softDelete.restoreUntil, input.nowMs) ? "Restore window is still open." : null,
    input.legalHold.active ? "Legal hold is active." : null,
    ...input.operationalBlockers
  ].filter((reason): reason is string => Boolean(reason));

  return {
    eligible: reasons.length === 0,
    reasons: reasons.length > 0 ? reasons : ["Eligible for tombstone purge after approval."]
  };
}

export function isRestoreWindowOpen(restoreUntil: string | null, nowMs = Date.now()) {
  return Boolean(restoreUntil && new Date(restoreUntil).getTime() > nowMs);
}

export function isMfaFreshEnough(verifiedAt: string | null, nowMs = Date.now(), maxAgeMs = criticalMfaFreshnessWindowMs) {
  if (!verifiedAt) {
    return false;
  }

  const timestamp = Number(verifiedAt);
  return Number.isFinite(timestamp) && timestamp <= nowMs && nowMs - timestamp <= maxAgeMs;
}

function getGovernanceSettings(settings: Json): Json | null {
  const base = jsonObject(settings);
  return base.governance ?? null;
}

function jsonObject(value: Json | undefined): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, Json>;
}

function stringOrNull(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: Json | undefined) {
  return value === true;
}

function stringifyDiffValue(value: Json | string | null): string {
  if (value === null || typeof value === "undefined") {
    return "Not set";
  }

  if (typeof value === "string") {
    return value || "Not set";
  }

  return JSON.stringify(value);
}
