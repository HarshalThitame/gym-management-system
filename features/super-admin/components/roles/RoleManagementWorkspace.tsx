"use client";

import { useActionState, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  ClipboardCopy,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { authResources, permissionActions } from "@/types/auth";
import type { PermissionAction } from "@/types/auth";
import {
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
  updateRolePermissionsAction,
  assignUserRoleAction,
  cloneRoleAction
} from "../../actions/role-management-actions";
import type { RoleManagementData, RoleManagementRecord, RoleDetailData, RoleManagementFilters } from "../../services/role-management-service";

type DrawerState =
  | { type: "closed" }
  | { type: "create" }
  | { type: "create_clone"; sourceRole: RoleManagementRecord }
  | { type: "detail"; role: RoleManagementRecord }
  | { type: "edit"; role: RoleManagementRecord }
  | { type: "delete"; role: RoleManagementRecord }
  | { type: "permissions"; role: RoleManagementRecord }
  | { type: "assign"; role: RoleManagementRecord };

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

function buildPageUrl(filters: RoleManagementFilters, page: number, pageSize: number, sort: string) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.roleType !== "all") params.set("type", filters.roleType);
  params.set("sort", sort);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return `/super-admin/roles?${params.toString()}`;
}

export function RoleManagementWorkspace({
  criticalSuperAdminEmail,
  data
}: {
  criticalSuperAdminEmail: string;
  data: RoleManagementData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawer, setDrawer] = useState<DrawerState>({ type: "closed" });

  const currentSort = data.filters.sort;
  const currentPage = data.filters.page;
  const pageSize = data.filters.pageSize;

  function setSort(sort: RoleManagementFilters["sort"]) {
    router.push(buildPageUrl(data.filters, 1, pageSize, sort), { scroll: false });
  }

  function setPage(page: number) {
    router.push(buildPageUrl(data.filters, page, pageSize, currentSort), { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-black md:text-4xl">Roles & Permissions</h1>
          <p className="max-w-3xl font-semibold text-muted-foreground">
            Define custom roles, configure resource-level permissions, and manage role-to-user assignments.
          </p>
        </div>
        <a
          href={`/api/super-admin/roles/export?format=csv`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-black hover:bg-surface-muted transition-all"
          target="_blank"
        >
          <Download className="size-3.5" />
          CSV
        </a>
        <Button onClick={() => setDrawer({ type: "create" })}>
          <Plus className="mr-2 size-4" />
          Create Role
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<ShieldCheck className="size-5" />} label="Total Roles" value={data.summary.totalRoles} />
        <SummaryCard icon={<ShieldCheck className="size-5" />} label="System Roles" value={data.summary.systemRoles} />
        <SummaryCard icon={<Plus className="size-5" />} label="Custom Roles" value={data.summary.customRoles} />
        <SummaryCard icon={<UserPlus className="size-5" />} label="Assignments" value={data.summary.totalAssignments} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={data.filters.query}
              onChange={(v) => { const params = new URLSearchParams(searchParams.toString()); if (v) params.set("q", v); else params.delete("q"); params.set("page", "1"); router.push(`/super-admin/roles?${params.toString()}`, { scroll: false }); }}
              placeholder="Search roles by name, display name, or description..."
              className="min-w-0 flex-1"
            />
            <select
              className={selectClass}
              aria-label="Filter by role type"
              defaultValue={data.filters.roleType}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("type", e.target.value);
                params.set("page", "1");
                router.push(`/super-admin/roles?${params.toString()}`, { scroll: false });
              }}
            >
              <option value="all">All Roles</option>
              <option value="system">System Only</option>
              <option value="custom">Custom Only</option>
            </select>
            <select
              className={selectClass}
              aria-label="Sort roles"
              defaultValue={currentSort}
              onChange={(e) => setSort(e.target.value as RoleManagementFilters["sort"])}
            >
              <option value="created_desc">Newest First</option>
              <option value="created_asc">Oldest First</option>
              <option value="name_asc">A-Z</option>
              <option value="name_desc">Z-A</option>
              <option value="users_desc">Most Users</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="whitespace-nowrap px-5 py-4">Role</th>
                  <th className="whitespace-nowrap px-5 py-4">Users</th>
                  <th className="whitespace-nowrap px-5 py-4">Permissions</th>
                  <th className="whitespace-nowrap px-5 py-4">Type</th>
                  <th className="whitespace-nowrap px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.roles.length === 0 ? (
                  <tr>
                    <td className="px-5 py-12 text-center" colSpan={5}>
                      <p className="font-bold text-muted-foreground">No roles match these filters.</p>
                      <Button className="mt-3" variant="secondary" onClick={() => router.push("/super-admin/roles")}>Clear Filters</Button>
                    </td>
                  </tr>
                ) : (
                  data.roles.map((role) => (
                    <tr key={role.id} className="border-b border-border last:border-b-0 hover:bg-surface-muted/50">
                      <td className="px-5 py-4">
                        <p className="font-black whitespace-nowrap">{role.display_name}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{role.name}</p>
                        {role.description && (
                          <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{role.description}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-bold">{role.userCount}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-bold">{role.permissionCount}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {role.is_system ? (
                          <Badge variant="premium">System</Badge>
                        ) : (
                          <Badge variant="neutral">Custom</Badge>
                        )}
                        {role.userCount === 0 && !role.is_system && (
                          <span className="ml-2 text-[10px] font-bold uppercase text-amber-600">Unused</span>
                        )}
                        {role.permissionCount === 0 && (
                          <span className="ml-2 text-[10px] font-bold uppercase text-red-600">No perms</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1 overflow-x-auto">
                          <Button onClick={() => setDrawer({ type: "detail", role })} size="sm" variant="ghost" title="View details"><ShieldCheck className="size-4 shrink-0" /></Button>
                          {!role.is_system && (
                            <Button onClick={() => setDrawer({ type: "edit", role })} size="sm" variant="ghost" title="Edit"><Pencil className="size-4 shrink-0" /></Button>
                          )}
                          <Button onClick={() => setDrawer({ type: "permissions", role })} size="sm" variant="ghost" title="Manage permissions"><Check className="size-4 shrink-0" /></Button>
                          <Button onClick={() => setDrawer({ type: "create_clone", sourceRole: role })} size="sm" variant="ghost" title="Clone role"><ClipboardCopy className="size-4 shrink-0" /></Button>
                          <Button onClick={() => setDrawer({ type: "assign", role })} size="sm" variant="ghost" title="Assign to user"><UserPlus className="size-4 shrink-0" /></Button>
                          {!role.is_system && (
                            <Button onClick={() => setDrawer({ type: "delete", role })} size="sm" variant="ghost" title="Delete"><Trash2 className="size-4 shrink-0 text-red-600" /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted-foreground" role="status" aria-live="polite">
            Page {currentPage} of {data.totalPages} · {data.roles.length} roles shown
          </p>
          <div className="flex gap-2">
            <Button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              variant="secondary"
              size="sm"
            >
              Previous
            </Button>
            <Button
              disabled={currentPage >= data.totalPages}
              onClick={() => setPage(currentPage + 1)}
              variant="secondary"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <DrawerModal drawer={drawer} onClose={() => setDrawer({ type: "closed" })} criticalSuperAdminEmail={criticalSuperAdminEmail} />
      <ToastContainer />
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs transition-all hover:shadow-sm hover:border-border-strong">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

function drawerTitle(drawer: DrawerState): string {
  switch (drawer.type) {
    case "create": return "Create Role";
    case "create_clone": return `Clone: ${drawer.sourceRole.display_name}`;
    case "detail": return `Role: ${drawer.role.display_name}`;
    case "edit": return `Edit: ${drawer.role.display_name}`;
    case "delete": return `Delete: ${drawer.role.display_name}`;
    case "permissions": return `Permissions: ${drawer.role.display_name}`;
    case "assign": return `Assign Role: ${drawer.role.display_name}`;
    default: return "";
  }
}

function DrawerModal({
  drawer,
  onClose,
  criticalSuperAdminEmail
}: {
  drawer: DrawerState;
  onClose: () => void;
  criticalSuperAdminEmail: string;
}) {
  useEffect(() => {
    if (drawer.type === "closed") return;
    const panel = document.querySelector("[data-drawer-panel]") as HTMLElement | null;
    panel?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [drawer.type, onClose]);

  if (drawer.type === "closed") return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        data-drawer-panel
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={drawerTitle(drawer)}
        className="relative flex w-full max-w-xl flex-col overflow-y-auto bg-background p-4 shadow-xl outline-none sm:p-6 md:max-w-2xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black">{drawerTitle(drawer)}</h2>
          <Button onClick={onClose} size="sm" variant="ghost" aria-label="Close drawer"><XCircle className="size-5" /></Button>
        </div>

        {drawer.type === "create" && (
          <CreateRoleForm onClose={onClose} />
        )}
        {drawer.type === "create_clone" && (
          <CloneRoleForm sourceRole={drawer.sourceRole} onClose={onClose} />
        )}
        {drawer.type === "edit" && (
          <EditRoleForm role={drawer.role} onClose={onClose} />
        )}
        {drawer.type === "delete" && (
          <DeleteRoleForm role={drawer.role} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "permissions" && (
          <PermissionsForm role={drawer.role} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
        {drawer.type === "assign" && (
          <AssignRoleForm role={drawer.role} onClose={onClose} criticalSuperAdminEmail={criticalSuperAdminEmail} />
        )}
      </div>
    </div>
  );
}

function CreateRoleForm({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(createRoleAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Role created.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <FormField label="System name" error={state.fieldErrors?.name}>
        <Input name="name" placeholder="custom_role_name" required />
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Lowercase letters and underscores only. Cannot be changed later.</p>
      </FormField>

      <FormField label="Display name" error={state.fieldErrors?.displayName}>
        <Input name="displayName" placeholder="Custom Role Name" required />
      </FormField>

      <FormField label="Description (optional)" error={state.fieldErrors?.description}>
        <Textarea name="description" placeholder="What does this role do?" rows={3} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Create Role" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function CloneRoleForm({ sourceRole, onClose }: { sourceRole: RoleManagementRecord; onClose: () => void }) {
  const [state, formAction] = useActionState(cloneRoleAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Role cloned.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="sourceRoleId" type="hidden" value={sourceRole.id} />

      <div className="rounded-md border border-border bg-surface-muted p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Source Role</p>
        <p className="mt-1 font-bold">{sourceRole.display_name} ({sourceRole.name})</p>
        <p className="text-xs font-semibold text-muted-foreground">{sourceRole.permissionCount} permissions · {sourceRole.userCount} users</p>
      </div>

      <FormField label="New system name" error={state.fieldErrors?.name}>
        <Input name="name" placeholder="cloned_role_name" required />
        <p className="mt-1 text-xs font-semibold text-muted-foreground">Lowercase letters and underscores only.</p>
      </FormField>

      <FormField label="Display name" error={state.fieldErrors?.displayName}>
        <Input name="displayName" placeholder={sourceRole.display_name + " (Copy)"} required />
      </FormField>

      <FormField label="Description (optional)" error={state.fieldErrors?.description}>
        <Textarea name="description" placeholder={`Cloned from ${sourceRole.display_name}`} rows={3} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Clone Role" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function EditRoleForm({ role, onClose }: { role: RoleManagementRecord; onClose: () => void }) {
  const [state, formAction] = useActionState(updateRoleAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Role updated.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  return (
    <form action={formAction} className="space-y-5">
      <input name="roleId" type="hidden" value={role.id} />

      <div className="rounded-md border border-border bg-surface-muted p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">System name</p>
        <p className="mt-1 font-mono text-sm font-bold">{role.name}</p>
      </div>

      <FormField label="Display name" error={state.fieldErrors?.displayName}>
        <Input name="displayName" defaultValue={role.display_name} required />
      </FormField>

      <FormField label="Description" error={state.fieldErrors?.description}>
        <Textarea name="description" defaultValue={role.description} rows={3} />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Save Changes" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function DeleteRoleForm({ role, onClose, criticalSuperAdminEmail }: { role: RoleManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(deleteRoleAction, initialAuthActionState);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Role deleted.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  if (role.is_system) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
        System roles cannot be deleted. Create a custom role instead.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="roleId" type="hidden" value={role.id} />

      <Card className="border-red-300 bg-red-50">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Trash2 className="size-5 text-red-600" />
            <p className="font-black text-red-800">Permanent Deletion</p>
          </div>
          <p className="text-sm leading-6 text-red-700">
            This will permanently delete <strong>{role.display_name}</strong> ({role.name}). Any users assigned to this role will lose their associated permissions. <strong>This cannot be undone.</strong>
          </p>
          {role.userCount > 0 && (
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">
              {role.userCount} user{role.userCount !== 1 ? "s" : ""} currently assigned to this role.
            </p>
          )}
        </CardContent>
      </Card>

      <FormField label="Type DELETE to confirm" error={state.fieldErrors?.confirmation}>
        <Input name="confirmation" placeholder="DELETE" required />
      </FormField>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (required)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why is this role being deleted?" rows={2} required />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Permanently Delete" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function PermissionsForm({ role, onClose, criticalSuperAdminEmail }: { role: RoleManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(updateRolePermissionsAction, initialAuthActionState);
  const [detail, setDetail] = useState<RoleDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [originalPerms, setOriginalPerms] = useState<Record<string, string[]>>({});
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [permSearch, setPermSearch] = useState("");

  useEffect(() => {
    fetch(`/api/super-admin/roles/${role.id}`)
      .then(async (res) => { if (!res.ok) throw new Error(await res.text()); return res.json(); })
      .then((d: RoleDetailData | null) => {
        if (d) {
          setDetail(d);
          const map: Record<string, string[]> = {};
          for (const p of d.permissions) map[p.resource] = p.actions;
          setPerms(map);
          setOriginalPerms(JSON.parse(JSON.stringify(map)));
        }
        setLoading(false);
      })
      .catch((e: Error) => {
        setLoadError(e.message);
        setLoading(false);
      });
  }, [role.id]);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Permissions updated.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  function toggleAction(resource: string, action: PermissionAction) {
    setPerms((prev) => {
      const current = prev[resource] ?? [];
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, [resource]: next };
    });
  }

  const resourcesJson = JSON.stringify(
    Object.entries(perms)
      .filter(([, actions]) => actions.length > 0)
      .map(([resource, actions]) => ({ resource, actions }))
  );

  const filteredResources = authResources.filter(
    (r) => !permSearch || r.includes(permSearch.toLowerCase()) || formatEnterpriseLabel(r).toLowerCase().includes(permSearch.toLowerCase())
  );

  const diffEntries = authResources.reduce<{ added: number; removed: number; modified: string[] }>(
    (acc, resource) => {
      const orig = originalPerms[resource] ?? [];
      const curr = perms[resource] ?? [];
      const added = curr.filter((a) => !orig.includes(a));
      const removed = orig.filter((a) => !curr.includes(a));
      if (added.length > 0 || removed.length > 0) {
        acc.modified.push(formatEnterpriseLabel(resource));
        acc.added += added.length;
        acc.removed += removed.length;
      }
      return acc;
    },
    { added: 0, removed: 0, modified: [] }
  );

  const hasChanges = diffEntries.added > 0 || diffEntries.removed > 0;
  const affectedUserCount = detail?.users.length ?? 0;

  if (loading) {
    return <div className="flex items-center justify-center py-12" role="status" aria-live="polite"><Loader2 className="size-6 animate-spin" aria-hidden="true" /><span className="sr-only">Loading permissions...</span></div>;
  }

  if (loadError) {
    return (
      <div className="space-y-4" role="alert">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{loadError}</div>
        <Button variant="secondary" onClick={() => {
          setLoading(true);
          setLoadError(null);
          fetch(`/api/super-admin/roles/${role.id}`)
            .then(async (res) => { if (!res.ok) throw new Error(await res.text()); return res.json(); })
            .then((d: RoleDetailData | null) => {
              if (d) {
                setDetail(d);
                const map: Record<string, string[]> = {};
                for (const p of d.permissions) map[p.resource] = p.actions;
                setPerms(map);
                setOriginalPerms(JSON.parse(JSON.stringify(map)));
              }
              setLoading(false);
            })
            .catch((e: Error) => { setLoadError(e.message); setLoading(false); });
        }}>Retry</Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="roleId" type="hidden" value={role.id} />
      <input name="resources" type="hidden" value={resourcesJson} />

      <div className="rounded-md border border-border bg-surface-muted p-4">
        <p className="text-sm font-bold">{role.display_name}</p>
        <p className="text-xs font-semibold text-muted-foreground">{role.name}</p>
      </div>

      {affectedUserCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          {affectedUserCount} user{affectedUserCount !== 1 ? "s" : ""} currently assigned to this role. Permission changes affect all of them.
        </div>
      )}

      {hasChanges && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="font-bold text-blue-800">Permission changes preview</p>
          <div className="mt-1 space-y-0.5 text-blue-700">
            {diffEntries.added > 0 && <p>+ {diffEntries.added} action{diffEntries.added !== 1 ? "s" : ""} added across {diffEntries.modified.length} resource{diffEntries.modified.length !== 1 ? "s" : ""}</p>}
            {diffEntries.removed > 0 && <p>- {diffEntries.removed} action{diffEntries.removed !== 1 ? "s" : ""} removed across {diffEntries.modified.length} resource{diffEntries.modified.length !== 1 ? "s" : ""}</p>}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-blue-700">Show details</summary>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-blue-600">
              {diffEntries.modified.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-base shadow-sm"
          placeholder="Filter resources..."
          aria-label="Filter permission resources"
          value={permSearch}
          onChange={(e) => setPermSearch(e.target.value)}
        />
      </div>

      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" role="status" aria-live="polite">
        {filteredResources.length} of {authResources.length} resources shown
      </p>

      <div className="space-y-2">
        {filteredResources.map((resource) => {
          const resourcePerms = perms[resource] ?? [];
          const isFullyChecked = permissionActions.every((a) => resourcePerms.includes(a));
          const isPartiallyChecked = resourcePerms.length > 0 && !isFullyChecked;

          return (
            <div key={resource} className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={isFullyChecked}
                    onChange={() => {
                      setPerms((prev) => ({
                        ...prev,
                        [resource]: isFullyChecked ? [] : [...permissionActions]
                      }));
                    }}
                  />
                  <span className="text-sm font-bold">{formatEnterpriseLabel(resource)}</span>
                </label>
                {isPartiallyChecked && (
                  <button
                    type="button"
                    onClick={() => {
                      setPerms((prev) => ({
                        ...prev,
                        [resource]: [...permissionActions]
                      }));
                    }}
                    className="text-[10px] font-bold uppercase text-muted-foreground hover:text-accent"
                  >
                    Select all
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {permissionActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    role="checkbox"
                    aria-checked={resourcePerms.includes(action)}
                    aria-label={`${action} for ${formatEnterpriseLabel(resource)}`}
                    onClick={() => toggleAction(resource, action)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                      resourcePerms.includes(action)
                        ? "bg-accent text-accent-foreground"
                        : "bg-surface-muted text-muted-foreground hover:bg-surface-strong"
                    }`}
                  >
                    {resourcePerms.includes(action) && <Check className="size-3" />}
                    {action}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {filteredResources.length === 0 && (
          <p className="py-4 text-center text-sm font-semibold text-muted-foreground">No resources match &quot;{permSearch}&quot;.</p>
        )}
      </div>

      <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
        <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
      </FormField>

      <FormField label="Reason (required)" error={state.fieldErrors?.reason}>
        <Textarea name="reason" placeholder="Why are these permissions changing?" rows={2} required />
      </FormField>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Save Permissions" />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function AssignRoleForm({ role, onClose, criticalSuperAdminEmail }: { role: RoleManagementRecord; onClose: () => void; criticalSuperAdminEmail: string }) {
  const [state, formAction] = useActionState(assignUserRoleAction, initialAuthActionState);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{ id: string; fullName: string; email: string | null }>>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; fullName: string; email: string | null } | null>(null);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "success") { showToast(state.message ?? "Role assigned.", "success"); onClose(); }
  }, [state.status, state.message, onClose]);

  useEffect(() => {
    if (search.length < 2) { setResults([]); setSearchError(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/super-admin/roles/search?q=${encodeURIComponent(search)}`);
        if (!res.ok) throw new Error(await res.text());
        const users: Array<{ id: string; fullName: string; email: string | null }> = await res.json();
        setResults(users);
        setSearchError(null);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "Search failed.");
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (selectedUser) {
      fetch(`/api/super-admin/roles/assigned?userId=${encodeURIComponent(selectedUser.id)}`)
        .then(async (res) => { if (!res.ok) throw new Error(await res.text()); return res.json(); })
        .then((ids: string[]) => setAssignedIds(ids))
        .catch(() => {});
    }
  }, [selectedUser]);

  const alreadyAssigned = assignedIds.includes(role.id);

  return (
    <form action={formAction} className="space-y-5">
      <input name="roleId" type="hidden" value={role.id} />
      {selectedUser && <input name="userId" type="hidden" value={selectedUser.id} />}

      <div className="rounded-md border border-border bg-surface-muted p-4">
        <p className="text-sm font-bold">{role.display_name}</p>
        <p className="text-xs font-semibold text-muted-foreground">{role.name}</p>
      </div>

      <FormField label="Search user by email">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-base shadow-sm"
            placeholder="Type at least 2 characters..."
            aria-label="Search users by email"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedUser(null); }}
          />
        </div>
        {searchError && <p className="mt-1 text-xs text-red-600">{searchError}</p>}
        {results.length > 0 && !selectedUser && (
          <div className="mt-1 rounded-md border border-border bg-surface shadow-sm">
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                onClick={() => { setSelectedUser(u); setResults([]); setSearch(""); }}
              >
                <span className="font-bold">{u.fullName}</span>
                <span className="text-muted-foreground">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </FormField>

      {selectedUser && (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface-muted p-3">
          <div>
            <p className="font-bold text-sm">{selectedUser.fullName}</p>
            <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
          </div>
          <Button type="button" onClick={() => setSelectedUser(null)} size="sm" variant="ghost"><X className="size-4" /></Button>
        </div>
      )}

      {selectedUser && alreadyAssigned && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          This user already has this role assigned.
        </div>
      )}

      {selectedUser && !alreadyAssigned && (
        <>
          <FormField label="Step-up email" error={state.fieldErrors?.stepUpEmail}>
            <Input name="stepUpEmail" placeholder={criticalSuperAdminEmail} required />
          </FormField>

          <FormField label="Reason (optional)" error={state.fieldErrors?.reason}>
            <Textarea name="reason" placeholder="Why is this role being assigned?" rows={2} />
          </FormField>
        </>
      )}

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton label="Assign Role" disabled={!selectedUser || alreadyAssigned} />
        <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
      </div>
    </form>
  );
}

function FormField({ children, error, label }: { children: ReactNode; error?: string[] | undefined; label: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold">{label}</label>
      {children}
      {error && <FieldError message={error.join(", ")} />}
    </div>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending || disabled} type="submit" variant="primary">
      {pending && <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin" />}
      {label}
    </Button>
  );
}
