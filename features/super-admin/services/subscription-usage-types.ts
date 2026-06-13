export type OrgUsage = {
  memberCount: number;
  memberLimit: number;
  memberPercent: number;
  isOverMemberLimit: boolean;
  branchCount: number;
  branchLimit: number;
  branchPercent: number;
  isOverBranchLimit: boolean;
};

export type UsageWarning = {
  type: "member" | "branch";
  level: "over_limit" | "critical" | "warning";
  current: number;
  limit: number;
  percent: number;
  message: string;
};

export function getUsageWarnings(usage: OrgUsage): UsageWarning[] {
  const warnings: UsageWarning[] = [];

  if (usage.memberLimit !== -1) {
    if (usage.isOverMemberLimit) {
      warnings.push({
        type: "member",
        level: "over_limit",
        current: usage.memberCount,
        limit: usage.memberLimit,
        percent: usage.memberPercent,
        message: `Member limit exceeded (${usage.memberCount}/${usage.memberLimit}). Upgrade your plan or remove inactive members.`,
      });
    } else if (usage.memberPercent >= 90) {
      warnings.push({
        type: "member",
        level: "critical",
        current: usage.memberCount,
        limit: usage.memberLimit,
        percent: usage.memberPercent,
        message: `Member capacity nearly full (${usage.memberCount}/${usage.memberLimit}). Consider upgrading soon.`,
      });
    } else if (usage.memberPercent >= 80) {
      warnings.push({
        type: "member",
        level: "warning",
        current: usage.memberCount,
        limit: usage.memberLimit,
        percent: usage.memberPercent,
        message: `Member usage at ${usage.memberPercent}% (${usage.memberCount}/${usage.memberLimit}).`,
      });
    }
  }

  if (usage.branchLimit !== -1) {
    if (usage.isOverBranchLimit) {
      warnings.push({
        type: "branch",
        level: "over_limit",
        current: usage.branchCount,
        limit: usage.branchLimit,
        percent: usage.branchPercent,
        message: `Branch limit exceeded (${usage.branchCount}/${usage.branchLimit}). Upgrade your plan or consolidate locations.`,
      });
    } else if (usage.branchPercent >= 90) {
      warnings.push({
        type: "branch",
        level: "critical",
        current: usage.branchCount,
        limit: usage.branchLimit,
        percent: usage.branchPercent,
        message: `Branch capacity nearly full (${usage.branchCount}/${usage.branchLimit}). Consider upgrading soon.`,
      });
    } else if (usage.branchPercent >= 80) {
      warnings.push({
        type: "branch",
        level: "warning",
        current: usage.branchCount,
        limit: usage.branchLimit,
        percent: usage.branchPercent,
        message: `Branch usage at ${usage.branchPercent}% (${usage.branchCount}/${usage.branchLimit}).`,
      });
    }
  }

  return warnings;
}
