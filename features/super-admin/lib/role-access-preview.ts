import type { PermissionEntry, RoleDetailData } from "@/features/super-admin/services/role-management-service";
import { authResources } from "@/types/auth";

export type RoleAccessPreviewRow = {
  resource: string;
  label: string;
  currentActions: string[];
  proposedActions: string[];
  addedActions: string[];
  removedActions: string[];
  grantedBefore: boolean;
  grantedAfter: boolean;
};

export type RoleAccessPreviewSummary = {
  currentResourceCount: number;
  proposedResourceCount: number;
  currentActionCount: number;
  proposedActionCount: number;
  addedResourceCount: number;
  removedResourceCount: number;
  addedActionCount: number;
  removedActionCount: number;
};

export type RoleAccessPreview = {
  role: {
    id: string;
    name: string;
    displayName: string;
    isSystem: boolean;
  };
  summary: RoleAccessPreviewSummary;
  matrix: RoleAccessPreviewRow[];
  warnings: string[];
};

function normalizePermissions(entries: PermissionEntry[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const entry of entries) {
    const resource = entry.resource.trim();
    if (!resource) continue;
    const actions = Array.from(new Set((entry.actions ?? []).map((action) => action.trim()).filter(Boolean)));
    if (actions.length === 0) continue;
    map[resource] = actions;
  }
  return map;
}

function labelForResource(resource: string): string {
  return resource.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function buildRoleAccessPreview(role: RoleDetailData, proposedPermissions: PermissionEntry[]): RoleAccessPreview {
  const currentMap = normalizePermissions(role.permissions);
  const proposedMap = normalizePermissions(proposedPermissions);
  const resources = Array.from(new Set([...authResources, ...Object.keys(currentMap), ...Object.keys(proposedMap)])).sort();

  const matrix = resources.map((resource) => {
    const currentActions = currentMap[resource] ?? [];
    const proposedActions = proposedMap[resource] ?? [];
    const addedActions = proposedActions.filter((action) => !currentActions.includes(action));
    const removedActions = currentActions.filter((action) => !proposedActions.includes(action));
    return {
      resource,
      label: labelForResource(resource),
      currentActions,
      proposedActions,
      addedActions,
      removedActions,
      grantedBefore: currentActions.length > 0,
      grantedAfter: proposedActions.length > 0,
    };
  });

  const currentResourceCount = matrix.filter((row) => row.grantedBefore).length;
  const proposedResourceCount = matrix.filter((row) => row.grantedAfter).length;
  const currentActionCount = matrix.reduce((sum, row) => sum + row.currentActions.length, 0);
  const proposedActionCount = matrix.reduce((sum, row) => sum + row.proposedActions.length, 0);

  const addedResourceCount = matrix.filter((row) => !row.grantedBefore && row.grantedAfter).length;
  const removedResourceCount = matrix.filter((row) => row.grantedBefore && !row.grantedAfter).length;
  const addedActionCount = matrix.reduce((sum, row) => sum + row.addedActions.length, 0);
  const removedActionCount = matrix.reduce((sum, row) => sum + row.removedActions.length, 0);

  const warnings: string[] = [];
  if (currentResourceCount === 0 && proposedResourceCount === 0) {
    warnings.push("This role has no effective resource permissions.");
  }
  if (addedActionCount === 0 && removedActionCount === 0 && addedResourceCount === 0 && removedResourceCount === 0) {
    warnings.push("The proposed permission set matches the current effective access.");
  }
  if (role.isSystem) {
    warnings.push("System roles should not be edited without confirming the downstream access impact.");
  }

  return {
    role: {
      id: role.id,
      name: role.name,
      displayName: role.display_name,
      isSystem: role.is_system,
    },
    summary: {
      currentResourceCount,
      proposedResourceCount,
      currentActionCount,
      proposedActionCount,
      addedResourceCount,
      removedResourceCount,
      addedActionCount,
      removedActionCount,
    },
    matrix,
    warnings,
  };
}

