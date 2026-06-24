Continue from docs/Phase2.3.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 2.3 — Custom Roles & Granular Permissions Builder for Organization Owner panel.

What this phase is about:
  The app currently has 6 fixed roles (super_admin, organization_owner, gym_admin, reception_staff,
  trainer, member) with hardcoded permission sets in lib/rbac.ts. The Enterprise plan promises
  custom_roles_granular_permissions — the ability for Org Owners to create custom roles with
  per-resource granular permissions. This feature is registered in the entitlement system but has
  zero implementation. This phase builds a role builder UI where Org Owners define custom roles
  with a permission matrix (checkbox grid), and assigns those roles to staff. The existing
  ROLE_PERMISSIONS system is extended to merge custom roles at runtime.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 2 Session 8.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand the current RBAC system.
  - lib/rbac.ts (ROLE_PERMISSIONS, can(), canAny(), getRoleRedirect() — full file)
  - types/auth.ts (RoleName, AuthResource, PermissionAction, AuthContext — full file)
  - features/organization-owner/components/modules/StaffModule.tsx (how roles are displayed/assigned)
  - features/organization-owner/actions/staff-actions.ts (how staff are invited with roles)
  - supabase/migrations/ (look for roles table, user_roles table)
  - types/database.ts (Database type for roles, user_roles, profiles tables)
  - features/entitlement/feature-registry.ts (custom_roles_granular_permissions in FEATURE_KEYS)

Step 2: Understand the current role assignment flow.
  Roles are stored in a "roles" table with columns: id, name (text), description, etc.
  Staff are assigned roles via a "user_roles" junction table: user_id, role_id, gym_id.
  The can() function in rbac.ts takes AuthContext and checks context.roles against ROLE_PERMISSIONS.
  
  The plan: custom roles live in a separate "custom_roles" table. They have a custom name and
  a jsonb permissions field. When checking permissions, can() merges built-in ROLE_PERMISSIONS
  with the user's custom role permissions. Custom roles are organization-scoped.

Supabase connection — reference .env.local:
  URL:  https://bobqiyhljubfrzmhqnqq.supabase.co
  Key:  SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY
  Use createSupabaseServerClient() for server actions and getSupabaseAdminClient() for admin ops.
  When querying, always batch independent reads into Promise.all for parallel execution.

Step 3: Create migration for custom_roles table.
  File: supabase/migrations/YYYYMMDD_create_custom_roles.sql

  Table: custom_roles
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    name text NOT NULL
    description text
    permissions jsonb NOT NULL DEFAULT '{}'::jsonb
      -- Format: { "members": ["read","create","update"], "payments": ["read","export"], ... }
      -- Only includes resources where at least one action is granted
    is_active boolean DEFAULT true
    created_by uuid REFERENCES profiles(id)
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()
    UNIQUE (organization_id, name)

  Index: on organization_id.
  Enable RLS.

  Table: user_custom_roles (junction table)
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
    custom_role_id uuid NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    created_at timestamptz DEFAULT now()
    UNIQUE (user_id, custom_role_id)

  Index: on user_id, on custom_role_id, on organization_id.
  Enable RLS.

Step 4: Create custom roles server actions.
  File: features/organization-owner/actions/custom-roles-actions.ts
  Mark as "use server".

  Export:
  - getCustomRoles(organizationId) → CustomRole[]
    Gate: requireOrgFeatureAccess(organizationId, "custom_roles_granular_permissions")

  - getCustomRole(organizationId, roleId) → CustomRole
    Gate: requireOrgFeatureAccess(organizationId, "custom_roles_granular_permissions")

  - createCustomRole(organizationId, data: { name, description?, permissions: Record<string, string[]> })
    Returns CustomRole
    Gate: requireOrgFeatureAccess(organizationId, "custom_roles_granular_permissions")
    Validation: name must be unique within org, permissions must have valid resource keys

  - updateCustomRole(organizationId, roleId, data: { name?, description?, permissions? })
    Returns CustomRole
    Gate: requireOrgFeatureAccess(organizationId, "custom_roles_granular_permissions")

  - deleteCustomRole(organizationId, roleId) → void
    Gate: requireOrgFeatureAccess(organizationId, "custom_roles_granular_permissions")
    Also removes all user_custom_roles entries for this role.

  - assignCustomRoleToUser(organizationId, userId, customRoleId) → void
    Gate: requireOrgFeatureAccess(organizationId, "custom_roles_granular_permissions")

  - removeCustomRoleFromUser(organizationId, userId, customRoleId) → void
    Gate: requireOrgFeatureAccess(organizationId, "custom_roles_granular_permissions")

  - getUserCustomRoles(organizationId, userId) → CustomRole[]
    Gate: no feature gate (reading user's roles is a general operation)

  Import: requireOrgFeatureAccess from @/features/entitlement.
  Import: createSupabaseServerClient from @/lib/supabase/server.

  Parallel DB pattern — always batch independent Supabase calls in Promise.all:

    // Inside getCustomRoles — fetch roles and user counts in parallel
    const [rolesResult, countsResult] = await Promise.all([
      supabase.from("custom_roles").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("user_custom_roles").select("custom_role_id").eq("organization_id", orgId),
    ]);
    // Then combine in JS — far faster than two sequential queries.

    // Inside deleteCustomRole — delete role and user assignments in parallel
    await Promise.all([
      supabase.from("user_custom_roles").delete().eq("custom_role_id", roleId),
      supabase.from("custom_roles").delete().eq("id", roleId).eq("organization_id", orgId),
    ]);

    // Inside assignCustomRoleToUser — check existing + insert in sequence (unique constraint),
    // but can batch validation reads:
    const [existing, roles] = await Promise.all([
      supabase.from("user_custom_roles").select("id").eq("user_id", userId).eq("custom_role_id", customRoleId).maybeSingle(),
      supabase.from("custom_roles").select("id").eq("organization_id", orgId).eq("id", customRoleId).maybeSingle(),
    ]);
    if (existing.data) throw new Error("User already has this custom role.");
    if (!roles.data) throw new Error("Custom role not found in your organization.");
    await supabase.from("user_custom_roles").insert({ user_id: userId, custom_role_id: customRoleId, organization_id: orgId });

  Use this pattern for ALL Supabase queries in this file.

Step 5: Extend the RBAC system to support custom roles.
  File: lib/rbac.ts

  The current can() function signature is:
    export function can(roles: RoleName[], resource: AuthResource, action: PermissionAction): boolean

  Update to also accept custom role permissions:
    export function can(
      roles: RoleName[],
      resource: AuthResource,
      action: PermissionAction,
      customPermissions?: Record<string, string[]>[]  // array of permission objects from custom roles
    ): boolean

  Logic:
  - First check built-in ROLE_PERMISSIONS for each of the user's built-in roles
  - Then check each customPermissions object: if customPermissions[resource]?.includes(action), return true
  - Return false if neither matches

  Also update canAny() similarly.
  Also update the exports/types at the bottom of the file.

  Important: keep backward compatibility. If customPermissions is not passed, existing behavior is unchanged.
  The new parameter is optional. Update all callers that need it (org-owner actions, API guards)
  to fetch and pass custom permissions.

Step 6: Create the custom roles UI component.
  File: features/organization-owner/components/modules/CustomRolesModule.tsx
  "use client" component.

  Props: { dashboard: OrganizationOwnerDashboard; moduleFilters?: ModuleSearchParams; hasFeature: boolean }

  Layout:
  - If !hasFeature: show locked message "Custom roles require Enterprise plan upgrade."
  - List view: table of custom roles — Name, Description, # of Users Assigned, Created Date, Actions (Edit, Delete)
  - "Create Role" button → opens modal/drawer with permission matrix
  - Permission matrix: a grid with resources as rows and actions as columns
    Resources: members, trainers, membership_plans, memberships, payments, attendance, classes, 
              class_bookings, leads, notifications, reports, settings, branches, compliance
    Actions: read, create, update, delete, export, approve
    Each cell is a checkbox. Checked = granted. Unchecked = denied.
    "Select All" and "Deselect All" buttons per row and per column.
  - Role Name input at top of modal
  - Description textarea
  - Edit opens same modal pre-filled
  - Delete shows confirmation dialog
  - "Assign to User" button on each role row → opens modal with staff selector + assign/remove

  Use existing UI patterns: DataList for table, OrgOwnerDrawer for create/edit form, Button.

Step 7: Create the custom role assignment panel (embedded in Staff module).
  File: features/organization-owner/components/modules/CustomRoleAssignmentPanel.tsx
  "use client" component.

  This is embedded as a section inside the existing StaffModule or as part of the
  CustomRolesModule. It allows assigning custom roles to specific staff members.

  Layout:
  - Staff selector dropdown
  - Current custom roles assigned to selected staff (table with remove button)
  - "Assign Role" button → dropdown of available custom roles → confirm
  - Shows built-in role alongside custom roles

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

Step 8: Add custom roles as a sidebar module.
  File: features/organization-owner/lib/organization-owner-modules.tsx

  Add module entry:
    {
      slug: "custom-roles",
      href: "/organization/custom-roles",
      label: "Custom Roles",
      title: "Custom Roles & Permissions",
      description: "Create custom roles with granular permissions for staff members.",
      icon: <ShieldCheck className="size-5" />,
      iconKey: "shield",
      featureKey: "custom_roles_granular_permissions" as FeatureKey,
    }

  File: features/entitlement/feature-registry.ts
  Add to MODULE_FEATURE_MAP:
    "custom-roles": "custom_roles_granular_permissions",

Step 9: Add custom roles to workspace router and data resolver.
  File: features/organization-owner/components/organization-owner-workspace.tsx
  Import CustomRolesModule and add case "custom-roles" to the switch.
  The StaffModule case is separate (custom roles gets its own route, not embedded in Staff).

  File: features/organization-owner/services/module-data-resolver.ts
  Add case for "custom-roles" that fetches custom roles from the server action.

Step 10: Update staff assignment to include custom roles.
  File: features/organization-owner/actions/staff-actions.ts

  In inviteStaffAction, after creating branch_users rows, also check if custom role IDs
  are passed and insert into user_custom_roles.

  File: features/organization-owner/components/modules/StaffModule.tsx
  In the staff invite drawer, if org has custom_roles_granular_permissions:
  - Fetch custom roles list
  - Add a multi-select for custom roles below the built-in role select
  - Pass selected custom role IDs to the invite action

Step 11: Add permission check to existing server actions.
  Several existing org-owner server actions use permission checks (via requireOrganizationFeatureAccess
  or manually checking roles). Audit these to ensure custom role permissions are respected.
  
  Key files to check:
  - features/organization-owner/actions/member-actions.ts
  - features/organization-owner/actions/staff-actions.ts
  - features/organization-owner/actions/trainer-actions.ts
  - features/organization-owner/actions/class-actions.ts
  - features/organization-owner/actions/branch-actions.ts

  For each action that does a permission check, fetch the user's custom role permissions
  from getUserCustomRoles and pass to the can() function.

  This is a cross-cutting concern. The simplest approach: create a helper function
  in lib/rbac.ts or a new file that takes AuthContext and returns the merged permissions:
    export async function getEffectivePermissions(auth: AuthContext): Promise<Record<string, string[]>>
  This fetches built-in + custom roles and merges them. Server actions call this once.

  Implementation of getEffectivePermissions (add to lib/rbac.ts):
    import { createSupabaseServerClient } from "@/lib/supabase/server";
    export async function getEffectivePermissions(userId: string, orgId: string): Promise<Record<string, string[]>> {
      const supabase = await createSupabaseServerClient();
      // Fetch custom role permissions in parallel with other needed data
      const { data: userCustomRoles } = await supabase
        .from("user_custom_roles")
        .select("custom_role_id, custom_roles!inner(permissions)")
        .eq("user_id", userId)
        .eq("organization_id", orgId);
      const merged: Record<string, string[]> = {};
      for (const ucr of (userCustomRoles ?? [])) {
        const perms = (ucr.custom_roles as any)?.permissions ?? {};
        for (const [resource, actions] of Object.entries(perms)) {
          merged[resource] = [...new Set([...(merged[resource] ?? []), ...(actions as string[])])];
        }
      }
      return merged;
    }

Step 12: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Role builder:
  - "Custom Roles" visible in sidebar for Enterprise plan only
  - "Custom Roles" locked/hidden for Growth and Starter plans
  - Create role opens permission matrix modal
  - All resources and actions shown as checkboxes
  - "Select All" / "Deselect All" work per row and column
  - Save creates role and shows in list
  - Edit opens same modal pre-filled
  - Delete removes role and user assignments
  - Role name unique within org enforced
  Permission enforcement:
  - Assign custom role to a staff member
  - Staff with custom role can access permitted resources
  - Staff with custom role is blocked from unpermitted resources
  - Built-in roles still work alongside custom roles (union of permissions)
  - Removing custom role from user removes access
  - can() function works correctly with and without custom permissions
  Integration:
  - Staff invite drawer shows custom role multi-select (if feature enabled)
  - Staff list shows custom roles alongside built-in roles
  - typecheck/lint/build all pass
  - No regression in existing RBAC for built-in roles

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_custom_roles.sql
  features/organization-owner/actions/custom-roles-actions.ts
  features/organization-owner/components/modules/CustomRolesModule.tsx
  features/organization-owner/components/modules/CustomRoleAssignmentPanel.tsx

Files to Modify:
  lib/rbac.ts (extend can/canAny to accept custom permissions)
  features/organization-owner/lib/organization-owner-modules.tsx (add custom-roles module)
  features/entitlement/feature-registry.ts (add "custom-roles" to MODULE_FEATURE_MAP)
  features/organization-owner/components/organization-owner-workspace.tsx (add custom-roles case)
  features/organization-owner/services/module-data-resolver.ts (add custom-roles resolver)
  features/organization-owner/actions/staff-actions.ts (pass custom role IDs in invite)
  features/organization-owner/components/modules/StaffModule.tsx (show custom roles in invite)

Key design decisions:
  - Custom roles use their own table (custom_roles), not extending the built-in roles table.
    This avoids conflicts with system roles and keeps the scope org-specific.
  - User assignment uses user_custom_roles junction table, separate from user_roles.
  - Permission merging: built-in ROLE_PERMISSIONS + custom role permissions = effective permissions.
    Union logic — if ANY role (built-in or custom) grants the action, access is allowed.
  - The RoleName type in types/auth.ts is NOT extended. Custom role names are just strings.
  - can() function is backward-compatible: customPermissions is optional.
  - All server actions gated with requireOrgFeatureAccess(orgId, "custom_roles_granular_permissions").
