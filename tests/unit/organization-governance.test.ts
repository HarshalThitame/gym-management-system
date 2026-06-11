import { describe, expect, it } from "vitest";
import {
  buildOrganizationDiff,
  buildOrganizationSnapshot,
  getOrganizationLegalHoldState,
  getOrganizationPurgeEligibility,
  getOrganizationSoftDeleteState,
  isMfaFreshEnough,
  isRestoreWindowOpen,
  mergeLegalHoldSettings,
  mergePermanentPurgeRequestedSettings,
  mergeRestoredOrganizationSettings,
  mergeSoftDeleteSettings
} from "@/features/super-admin/lib/organization-governance";
import { fallbackCriticalSuperAdminEmail, getCriticalSuperAdminEmail } from "@/features/super-admin/lib/super-admin-governance-config";
import type { OrganizationRow } from "@/types/enterprise";

const baseOrganization: OrganizationRow = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Apex Fitness Group",
  slug: "apex-fitness-group",
  organization_type: "multi_branch",
  status: "active",
  primary_domain: "apexfit.com",
  billing_email: "billing@apexfit.com",
  owner_user_id: "00000000-0000-0000-0000-000000000002",
  settings: {},
  created_by: null,
  created_at: "2026-06-12T00:00:00.000Z",
  updated_at: "2026-06-12T00:00:00.000Z"
};

describe("super admin organization governance rules", () => {
  it("builds readable organization diffs", () => {
    const before = buildOrganizationSnapshot(baseOrganization);
    const after = buildOrganizationSnapshot({
      ...baseOrganization,
      status: "suspended",
      owner_user_id: "00000000-0000-0000-0000-000000000003"
    });

    expect(buildOrganizationDiff(before, after)).toEqual([
      { field: "status", label: "Status", before: "active", after: "suspended" },
      {
        field: "ownerUserId",
        label: "Owner",
        before: "00000000-0000-0000-0000-000000000002",
        after: "00000000-0000-0000-0000-000000000003"
      }
    ]);
  });

  it("stores and reads soft-delete governance metadata", () => {
    const settings = mergeSoftDeleteSettings({}, {
      deletedAt: "2026-06-12T00:00:00.000Z",
      restoreUntil: "2026-07-12T00:00:00.000Z",
      deletedBy: "00000000-0000-0000-0000-000000000004",
      reason: "customer requested closure",
      approvalId: "00000000-0000-0000-0000-000000000005"
    });

    expect(getOrganizationSoftDeleteState(settings)).toMatchObject({
      deletedAt: "2026-06-12T00:00:00.000Z",
      restoreUntil: "2026-07-12T00:00:00.000Z",
      deletedBy: "00000000-0000-0000-0000-000000000004",
      reason: "customer requested closure",
      approvalId: "00000000-0000-0000-0000-000000000005"
    });
  });

  it("marks restored organizations without deleting the audit history metadata", () => {
    const deletedSettings = mergeSoftDeleteSettings({}, {
      deletedAt: "2026-06-12T00:00:00.000Z",
      restoreUntil: "2026-07-12T00:00:00.000Z",
      deletedBy: "00000000-0000-0000-0000-000000000004",
      reason: "mistaken closure",
      approvalId: "00000000-0000-0000-0000-000000000005"
    });
    const restoredSettings = mergeRestoredOrganizationSettings(deletedSettings, {
      restoredAt: "2026-06-13T00:00:00.000Z",
      restoredBy: "00000000-0000-0000-0000-000000000006"
    });

    expect(getOrganizationSoftDeleteState(restoredSettings)).toMatchObject({
      deletedAt: "2026-06-12T00:00:00.000Z",
      restoredAt: "2026-06-13T00:00:00.000Z",
      restoredBy: "00000000-0000-0000-0000-000000000006"
    });
  });

  it("evaluates restore windows and MFA freshness", () => {
    const now = Date.parse("2026-06-12T00:00:00.000Z");

    expect(isRestoreWindowOpen("2026-06-12T00:10:00.000Z", now)).toBe(true);
    expect(isRestoreWindowOpen("2026-06-11T23:59:59.000Z", now)).toBe(false);
    expect(isRestoreWindowOpen(null, now)).toBe(false);

    expect(isMfaFreshEnough(String(now - 9 * 60 * 1000), now)).toBe(true);
    expect(isMfaFreshEnough(String(now - 11 * 60 * 1000), now)).toBe(false);
    expect(isMfaFreshEnough(String(now + 1000), now)).toBe(false);
    expect(isMfaFreshEnough(null, now)).toBe(false);
  });

  it("stores legal hold metadata and blocks permanent purge while active", () => {
    const settings = mergeLegalHoldSettings({}, {
      active: true,
      reason: "litigation hold",
      updatedAt: "2026-06-12T00:00:00.000Z",
      updatedBy: "00000000-0000-0000-0000-000000000007"
    });
    const legalHold = getOrganizationLegalHoldState(settings);

    expect(legalHold).toEqual({
      active: true,
      reason: "litigation hold",
      updatedAt: "2026-06-12T00:00:00.000Z",
      updatedBy: "00000000-0000-0000-0000-000000000007"
    });
    expect(getOrganizationPurgeEligibility({
      status: "archived",
      softDelete: getOrganizationSoftDeleteState({}),
      legalHold,
      operationalBlockers: []
    })).toMatchObject({
      eligible: false,
      reasons: ["Legal hold is active."]
    });
  });

  it("allows permanent purge request only after archive, restore-window closure, and dependency cleanup", () => {
    const now = Date.parse("2026-06-12T00:00:00.000Z");
    const softDelete = getOrganizationSoftDeleteState(mergeSoftDeleteSettings({}, {
      deletedAt: "2026-05-01T00:00:00.000Z",
      restoreUntil: "2026-06-01T00:00:00.000Z",
      deletedBy: null,
      reason: "closure",
      approvalId: null
    }));
    const legalHold = getOrganizationLegalHoldState({});

    expect(getOrganizationPurgeEligibility({
      status: "archived",
      softDelete,
      legalHold,
      operationalBlockers: [],
      nowMs: now
    })).toMatchObject({
      eligible: true,
      reasons: ["Eligible for tombstone purge after approval."]
    });

    expect(getOrganizationPurgeEligibility({
      status: "archived",
      softDelete,
      legalHold,
      operationalBlockers: ["1 payment records remain"],
      nowMs: now
    })).toMatchObject({
      eligible: false,
      reasons: ["1 payment records remain"]
    });
  });

  it("captures permanent purge request metadata before maker-checker review", () => {
    const settings = mergePermanentPurgeRequestedSettings({}, {
      requestedAt: "2026-06-12T00:00:00.000Z",
      requestedBy: "00000000-0000-0000-0000-000000000008",
      reason: "retention period complete",
      approvalId: null
    });
    const snapshot = buildOrganizationSnapshot({ ...baseOrganization, settings });

    expect(JSON.stringify(snapshot.governance)).toContain("permanentPurge");
    expect(JSON.stringify(snapshot.governance)).toContain("retention period complete");
  });

  it("uses the configured critical Super Admin email with a safe fallback", () => {
    const previous = process.env.SUPER_ADMIN_CRITICAL_EMAIL;
    const previousPublic = process.env.NEXT_PUBLIC_SUPER_ADMIN_CRITICAL_EMAIL;
    delete process.env.SUPER_ADMIN_CRITICAL_EMAIL;
    delete process.env.NEXT_PUBLIC_SUPER_ADMIN_CRITICAL_EMAIL;

    expect(getCriticalSuperAdminEmail()).toBe(fallbackCriticalSuperAdminEmail);

    process.env.SUPER_ADMIN_CRITICAL_EMAIL = " Admin@Example.com ";
    expect(getCriticalSuperAdminEmail()).toBe("admin@example.com");

    if (previous) {
      process.env.SUPER_ADMIN_CRITICAL_EMAIL = previous;
    } else {
      delete process.env.SUPER_ADMIN_CRITICAL_EMAIL;
    }

    if (previousPublic) {
      process.env.NEXT_PUBLIC_SUPER_ADMIN_CRITICAL_EMAIL = previousPublic;
    } else {
      delete process.env.NEXT_PUBLIC_SUPER_ADMIN_CRITICAL_EMAIL;
    }
  });
});
