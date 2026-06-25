# Super Admin Phase 1.1 — User Management Completion (SAR-001)

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **QA report:** `docs/52-super-admin-qa-report.md` (SAR-001, High risk)
> **Duration:** ~1.5 days
> **Type:** Build (UI + wire server actions + test)

---

## Context

The super admin user management module (`/super-admin/users`) has a solid foundation:
- **Server actions exist** (10 actions in `features/super-admin/actions/user-management-actions.ts`, 742 lines): `inviteUserAction`, `updateUserStatusAction`, `forceLogoutUserAction`, `resetUserPasswordAction`, `transferUserRoleAction`, `bulkUserActionAction`, `saveUserProfileAction`, `resendInviteAction`, `revokeInviteAction`, `deleteUserAction`.
- **All schemas exist** (12 zod schemas in `features/super-admin/schemas/user-management-schemas.ts`).
- **Services exist** (`getUserManagementData`, `getPendingInvites`, `deleteUserCascade`, `getUserDetailData`).
- **UI workspace exists** (`UserManagementWorkspace.tsx`, 1146 lines) with 22 sub-components and 12 drawer states.

**BUT the QA report flagged missing workflows:**
1. **Create Auth User from UI** — `inviteUserAction` exists but the invite flow doesn't create an auth user; Org Owner, Gym Admin, Reception, Trainer, Member creation from Super Admin is missing.
2. **Password Reset UI** — `resetUserPasswordAction` exists and the `UserResetPasswordForm` component is wired, but the action only sends email. No "set temporary password" option.
3. **Account Lock/Unlock** — `updateUserStatusAction` can activate/suspend/archive, but `UserStatusForm` only has those 3 states. A distinct "lock/unlock" (ban auth user) flow is needed.
4. **Force Logout** — `forceLogoutUserAction` exists but calls `auth.admin.deleteUser()` which PERMANENTLY DELETES the auth account. This is wrong — it should sign out all sessions without deleting the user.
5. **Bulk Actions** — `bulkUserActionAction` exists and `BulkUserActionForm` is wired, but the workspace lacks multi-select checkboxes and a bulk action bar.
6. **Login History Drilldown** — `getUserDetailData` provides login history ONLY on the detail page, not in the list view. The list view shows `loginCount: 0, lastLoginAt: null` for all users.
7. **Org Owner Creation Wizard** — No dedicated wizard exists. Creating an Org Owner requires: create auth user → create profile → assign org_owner role → create organization — all in one atomic flow.

**Additional gaps found during code audit:**
8. `accountNoteSchema` is defined but no UI or server action exists for account notes.
9. `saveUserProfileAction` does manual validation instead of using `updateUserProfileSchema`.
10. User detail page (`[userId]/page.tsx`) is read-only — no edit/delete/status buttons.
11. No loading/skeleton states — data is fully server-rendered with no optimistic UI.
12. No empty state CTA — when user list is empty, just shows "No users match these filters" without an invite button.
13. `hasActiveSessions` is misleading — it reflects branch assignment count, not actual auth sessions.
14. No soft-delete/restore mechanism — `deleteUserAction` is permanent cascade.

---

## Tasks

### Task 1: Fix Force Logout to Sign Out Sessions (Not Delete Auth User) — PRIORITY

**Current behavior:** `forceLogoutUserAction` calls `supabaseAdmin.auth.admin.deleteUser(cleanUserId)` which PERMANENTLY removes the auth account. This is dangerous.

**Required behavior:** Sign out all active sessions by calling `supabaseAdmin.auth.admin.signOut(cleanUserId)` (or the Supabase equivalent). Do NOT delete the auth user. Write audit log entry.

**File to modify:** `features/super-admin/actions/user-management-actions.ts:264-320`
- Replace `deleteUser` calls with `signOut` calls
- Update the `forceLogoutUserSchema` description if needed
- Keep all MFA/rate-limit/audit requirements

---

### Task 2: Add "Set Temporary Password" to User Management

Currently `resetUserPasswordAction` only sends a password reset email. Super admins need the ability to set a temporary password AND force a password change on next login.

**Required behavior:**
- Add `isTemporary: boolean` and `temporaryPassword?: string` fields to `resetUserPasswordSchema`
- If temporary password provided, update the auth user's password directly via `supabaseAdmin.auth.admin.updateUserById(cleanUserId, { password: temporaryPassword, user_metadata: { force_password_change: true } })`
- If no temporary password, send reset email as current behavior
- The `UserResetPasswordForm` UI must show both options: "Send Reset Email" (default) and "Set Temporary Password" (with password input + confirm)

**Files to modify:**
- `features/super-admin/schemas/user-management-schemas.ts` — extend `resetUserPasswordSchema`
- `features/super-admin/actions/user-management-actions.ts` — extend `resetUserPasswordAction`
- `features/super-admin/components/users/UserManagementWorkspace.tsx` — extend `UserResetPasswordForm`

---

### Task 3: Wire Login History in User List View

**Current:** `getUserManagementData` (service line ~191-192) hardcodes `loginCount: 0, lastLoginAt: null` for every record. Login data only appears on the detail page.

**Required:**
- Modify `getUserManagementService` to batch-fetch login history for the current page of users
- Add a `lastLoginInfo` object to `UserManagementRecord`: `{ loginCount: number, lastLoginAt: string|null, lastLoginSuccess: boolean|null }`
- Display in the user row: show "Last login: 2h ago" / "Never logged in" with a small indicator dot (green=grey)
- Add sort option `last_login_desc` to `userSortOptions`

**Files to modify:**
- `features/super-admin/services/user-management-service.ts` — batch query login_history, update `UserManagementRecord` type
- `features/super-admin/components/users/UserManagementWorkspace.tsx` — show login info in `UserRow`
- `app/(super-admin)/super-admin/users/page.tsx` — add new sort option

---

### Task 4: Add Action Buttons to User Detail Page

**Current:** `app/(super-admin)/super-admin/users/[userId]/page.tsx` is entirely read-only. No edit/delete/status/logout/reset buttons.

**Required:**
- Wrap the detail page content in a client component `UserDetailClient` that adds an action bar
- Action bar buttons: Edit Profile, Reset Password, Force Logout, Change Status (activate/suspend), Transfer Role, Delete User
- Each button opens a glass-effect modal/drawer with the corresponding form (reuse/extract form components from `UserManagementWorkspace`)
- All destructive actions require type-to-confirm + MFA step-up
- Add "Back to Users" breadcrumb at top

**Files to modify:**
- `app/(super-admin)/super-admin/users/[userId]/page.tsx` — add client wrapper with actions
- Create new: `features/super-admin/components/users/UserDetailActions.tsx` — action bar component

---

### Task 5: Build Org Owner Creation Wizard

**Required flow:**
1. Super admin clicks "Create Org Owner" button (on users page header)
2. Glass modal opens with a multi-step wizard:
   - **Step 1: Account** — email, password (auto-generate option), full name, phone
   - **Step 2: Organization** — org name, slug (auto-generated from name), description, timezone (IST default), currency (INR default)
   - **Step 3: Subscription** — select package tier (Starter/Growth/Enterprise), trial days, billing period
   - **Step 4: Review** — summary of everything, confirm button
3. On confirm: create auth user → create profile → insert user_role (org_owner) → create organization → insert organization_subscription → write audit logs
4. Show success toast with created user/org details
5. Redirect to org detail page

**Security requirements:**
- Type-to-confirm on final step
- MFA step-up verification
- Rate limit: 10/60s
- Audit log every creation step

**Files to create:**
- `features/super-admin/components/users/OrgOwnerCreationWizard.tsx` — the wizard modal
- `features/super-admin/actions/org-owner-creation-actions.ts` — the compound server action

**Files to modify:**
- `features/super-admin/components/users/UserManagementWorkspace.tsx` — add "Create Org Owner" button in header
- `features/super-admin/schemas/user-management-schemas.ts` — add `createOrgOwnerSchema`

---

### Task 6: Add Account Notes Feature

**Current:** `accountNoteSchema` exists but has no server action, UI, or drawer state.

**Required:**
- Create `addAccountNoteAction` — inserts into a new `account_notes` table OR stores in profile `metadata` jsonb
- Add "Notes" tab/button in user detail view and in the workspace drawer's `UserDetailView`
- Show notes timeline (newest first) with author and timestamp
- Add note form: textarea + submit button
- Add "Add Note" button in `UserRow` actions

**DB:** Decide — create `account_notes` table or store in `profiles.metadata.notes[]` jsonb. The jsonb approach avoids a migration.

**Files to create/modify:**
- `features/super-admin/actions/user-management-actions.ts` — add `addAccountNoteAction`
- `features/super-admin/components/users/UserManagementWorkspace.tsx` — add note drawer state, note form, note timeline in `UserDetailView`
- `app/(super-admin)/super-admin/users/[userId]/page.tsx` — add notes section (via `UserDetailActions`)

---

### Task 7: Add Loading Skeletons & Empty States

**Required:**
- **Loading skeleton:** When navigating between pages, show a shimmer skeleton table (rows of pulsing rectangles) instead of blank page
- **Empty state:** When no users exist, show a centered illustration area with "No users yet" message, "Invite your first user" CTA button, and link to "Create Org Owner"
- **Filter empty state:** When filters return no results, show "No users match your filters" with a "Clear filters" button that's more prominent

**Files to modify:**
- `features/super-admin/components/users/UserManagementWorkspace.tsx` — add loading/empty states
- Create: `features/super-admin/components/users/UserTableSkeleton.tsx` — shimmer skeleton

---

### Task 8: UI Polish — Glass Effects & Cinematic Styling

Apply the design standards from `SUPER_ADMIN_PRODUCTION_PLAN.md` to ALL user management UI:

**Required style changes:**
1. **UserManagementWorkspace header** — add `bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border` for a sticky glass header
2. **KPI cards row** — add `reveal-up` animation with staggered delays (`delay={i * 0.05}s`)
3. **Filter bar** — wrap in glass container: `sticky top-[73px] z-[9] bg-background/80 backdrop-blur-sm border-b border-border py-3`
4. **Drawer modal** — use `fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm` backdrop; dialog uses `rounded-lg border border-border bg-surface shadow-2xl`
5. **Drawer slide-in** — add CSS animation: `animate-slide-in-right` (translateX from 30px to 0, opacity 0 to 1, 0.3s ease-out)
6. **User rows** — add `transition-colors hover:bg-surface-muted` for hover state
7. **Checkbox selection** — selected rows get `border-accent bg-accent/5 ring-1 ring-accent/20`
8. **Status badges** — use existing Badge component variants consistently
9. **Action buttons** — use `size-8 rounded-md border border-border bg-background hover:bg-surface-muted hover:border-border-strong transition-all` icon buttons (currently they are bare icons)
10. **Toast notifications** — already uses `showToast`, ensure glass-styled toast container
11. **Bulk action bar** — when rows selected, show a floating glass bar at the bottom: `fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-surface shadow-2xl backdrop-blur px-4 py-3 flex items-center gap-3`

**CSS animation to add in globals.css:**
```css
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}
.animate-slide-in-right {
  animation: slide-in-right 0.3s cubic-bezier(0.2, 0, 0, 1) both;
}
```

---

### Task 9: Fix Data & Type Issues

1. **Fix `hasActiveSessions` field** — rename to `activeAssignments` in `UserManagementRecord` and update all references. The field currently counts branch assignments, not auth sessions.
2. **Wire `updateUserProfileSchema`** — modify `saveUserProfileAction` to use the zod schema instead of manual validation.
3. **Add soft-delete** — change `deleteUserAction` to do soft-delete (set profile status to `deleted` + archive auth user) instead of permanent cascade. Add a "Permanent Purge" option that requires dual confirmation + MFA for GDPR compliance.

---

## Files Summary

### Files to CREATE:
| File | Purpose |
|------|---------|
| `features/super-admin/components/users/OrgOwnerCreationWizard.tsx` | Multi-step org owner creation wizard |
| `features/super-admin/actions/org-owner-creation-actions.ts` | Compound server action for org owner + org + subscription |
| `features/super-admin/components/users/UserDetailActions.tsx` | Action bar for user detail page |
| `features/super-admin/components/users/UserTableSkeleton.tsx` | Shimmer loading skeleton for user table |

### Files to MODIFY:
| File | Changes |
|------|---------|
| `features/super-admin/actions/user-management-actions.ts` | Fix force logout (signOut, not deleteUser), add temp password flow, add accountNoteAction, soft-delete, use zod schema |
| `features/super-admin/schemas/user-management-schemas.ts` | Extend resetPasswordSchema, add createOrgOwnerSchema |
| `features/super-admin/services/user-management-service.ts` | Batch login history fetch, fix hasActiveSessions → activeAssignments |
| `features/super-admin/components/users/UserManagementWorkspace.tsx` | Glass styling, login info in rows, bulk bar, loading/empty states, sticky header, account notes drawer, org owner wizard trigger |
| `app/(super-admin)/super-admin/users/page.tsx` | Add sort option last_login_desc |
| `app/(super-admin)/super-admin/users/[userId]/page.tsx` | Add UserDetailActions client wrapper with action bar |
| `app/globals.css` | Add slide-in-right animation keyframe |

---

## UI Styling Guidelines

**Follow the design system in `docs/SUPER_ADMIN_PRODUCTION_PLAN.md` exactly:**

### Modals & Drawers
```
<!-- Backdrop -->
<div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm" />

<!-- Dialog -->
<div className="fixed inset-y-0 right-0 z-50 flex">
  <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-lg border border-border bg-surface shadow-2xl animate-slide-in-right">
    <!-- Header: glass effect -->
    <div className="flex items-center justify-between px-5 py-4 bg-background/90 backdrop-blur border-b border-border">
      <h2 className="text-lg font-black">Drawer Title</h2>
      <button ...>Close</button>
    </div>
    <!-- Content -->
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      ...
    </div>
    <!-- Footer -->
    <div className="px-5 py-4 border-t border-border bg-background/50">
      <button>Confirm</button>
    </div>
  </div>
</div>
```

### KPI Cards
```tsx
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  {kpiData.map((kpi, i) => (
    <div
      key={kpi.label}
      className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md hover:border-border-strong"
      style={{ "--reveal-delay": `${i * 0.05}s` } as React.CSSProperties}
    >
      <div className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{kpi.label}</div>
      <div className="mt-1 text-3xl font-black text-foreground">{kpi.value}</div>
    </div>
  ))}
</div>
```

### Floating Bulk Action Bar
```tsx
{selectedCount > 0 && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-border bg-surface/95 backdrop-blur shadow-2xl px-4 py-3 flex items-center gap-3 animate-slide-in-right">
    <span className="text-sm font-black">{selectedCount} selected</span>
    <div className="w-px h-5 bg-border" />
    <button className="...">Suspend</button>
    <button className="...">Activate</button>
    <button className="...">Force Logout</button>
    <div className="w-px h-5 bg-border" />
    <button className="text-destructive">Delete</button>
  </div>
)}
```

### Empty State
```tsx
{data.records.length === 0 && !loading && (
  <div className="rounded-lg border border-dashed border-border bg-background p-12 text-center">
    <div className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted">
      <UsersRound className="size-8 text-muted-foreground" />
    </div>
    <h3 className="mt-4 text-lg font-black">No users yet</h3>
    <p className="mt-1 text-sm text-muted-foreground">Invite your first user or create an organization owner to get started.</p>
    <div className="mt-6 flex items-center justify-center gap-3">
      <button onClick={...} className="...">Invite User</button>
      <button onClick={...} className="...">Create Org Owner</button>
    </div>
  </div>
)}
```

---

## Verification Checklist

After completing all tasks, verify:

### Fixes
- [ ] Force logout signs out sessions, does NOT delete the auth user
- [ ] `hasActiveSessions` renamed to `activeAssignments` everywhere
- [ ] `saveUserProfileAction` uses `updateUserProfileSchema` for validation
- [ ] Delete user does soft-delete by default; permanent purge is separate with dual confirmation

### New Features
- [ ] Set temporary password works (password set on auth user, force change flag)
- [ ] Login history visible in user list rows (last login time + success indicator)
- [ ] User detail page has action bar (edit, reset, logout, status, transfer, delete)
- [ ] Org Owner Creation Wizard works end-to-end (auth → profile → role → org → subscription)
- [ ] Account notes can be added and viewed on user detail
- [ ] Loading skeleton shows during page transitions
- [ ] Empty state shows invite CTA when no users exist

### Styling
- [ ] Sticky glass header on user management page
- [ ] KPI cards animate in with staggered reveal
- [ ] Glass filter bar with sticky positioning
- [ ] Drawer modals have backdrop-blur backdrop + slide-in animation
- [ ] User rows have hover transition
- [ ] Floating bulk action bar appears when rows selected
- [ ] All buttons have `rounded-md border bg-background hover:bg-surface-muted` styling (no bare icon buttons)

### Security
- [ ] All destructive actions require type-to-confirm
- [ ] All destructive actions require MFA step-up via `InlineMfaStepUp`
- [ ] All writes gated with `requireRole(["super_admin"])`
- [ ] All writes rate limited
- [ ] All writes produce audit log entries

### Build
- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run lint` passes (0 new errors)
- [ ] `npm run build` completes
- [ ] No new page/console errors at `/super-admin/users`

---

## Important Notes

1. **Do NOT modify the existing MFA step-up flow.** The `verifyCriticalSuperAdminAccess` function (lines 676-709 in `user-management-actions.ts`) checks the critical super admin email, MFA aal2 level, and MFA freshness. Keep this requirement on all destructive actions.

2. **Keep all existing server action signatures.** Other modules may import these actions. Add new parameters as optional with defaults to maintain backward compatibility.

3. **Do NOT change the database schema.** All new data (notes, temp password flags) should use existing columns (`metadata` jsonb on profiles) or the existing tables. If a new table is absolutely needed, include the migration file.

4. **Reuse existing components.** The `Card`, `Badge`, `Button`, `Input`, `Select`, `ConfirmDialog` components from `components/ui/` should be used. Do not create duplicate UI primitives.

5. **Match existing code patterns.** Look at `UserManagementWorkspace.tsx` line 410-470 (DrawerModal), line 489-566 (InviteUserForm), and line 596-636 (UserStatusForm) for the patterns to follow for new forms/drawers.
