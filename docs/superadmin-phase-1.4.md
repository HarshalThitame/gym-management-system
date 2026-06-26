# Super Admin Phase 1.4 — Backup & Restore Operations (SAR-004)

> **Master plan:** `docs/SUPER_ADMIN_PRODUCTION_PLAN.md`
> **QA report:** `docs/52-super-admin-qa-report.md` (SAR-004, High risk)
> **Duration:** ~1 day
> **Type:** Build (UI + wire server actions + test)

---

## Context

The super admin backup & restore implementation has a **solid database schema and read-only dashboard but zero mutation capabilities**. All 11 backup tables exist in the database with full RLS policies, but there are no server actions or UI buttons to create, restore, delete, or configure backups.

### What Already Exists

**Database Schema (11 backup-related tables, all fully migrated):**

| Table | Purpose |
|-------|---------|
| `backup_jobs` | Backup catalog with type/scope/status/size/checksum |
| `recovery_sessions` | Full recovery workflow with multi-step status pipeline |
| `recovery_approvals` | Multi-level approval (levels 1-4, MFA-tracked) |
| `backup_replication` | Cross-region replication tracking |
| `backup_verifications` | Integrity verification results (checksums, consistency checks) |
| `backup_storage_tiers` | Hot/warm/cold/archive tier capacity tracking |
| `backup_security_events` | Ransomware/tampering detection events |
| `backup_schedules` | Automated backup scheduling config |
| `backup_pitr_points` | Point-in-time recovery point catalog |
| `backup_compliance_reports` | Compliance report records (GDPR, SOC2, HIPAA, PCI) |
| `obs_dr_status` | Disaster recovery status (RPO/RTO tracking) |

**Read-Only Service:**

`features/backup/services/backup-service.ts` (216 lines):
- `getBackupDashboard()` — queries ALL 11 tables via Supabase admin client, returns `BackupDashboard` type with KPIs and collections. Cached with 30s TTL. Falls back to empty dashboard on error.

**Read-Only UI:**

`app/(super-admin)/super-admin/backups/backup-dashboard.tsx` (582 lines):
- 12 tabs: Overview, Backups, Recovery, Replication, Verification, Storage, Security, Schedules, PITR, Compliance, Approvals, DR
- KPI boxes at top: Total Backups, Successful, Failed, Recovery Rate, RPO, RTO, DR Readiness, Storage Used
- Each tab renders its data in card lists or tables
- ZERO action buttons — "New Recovery" is just a link to `?tab=recovery`, "DR Status" is a link to `?tab=dr`
- No forms, no modals, no create/restore/delete/configure workflows

### What's MISSING (Critical Gaps)

**Gap 1 (CRITICAL): No backup creation.**
There is NO server action or UI to trigger a new backup. The dashboard shows backup jobs but has no "Create Backup" or "Run Backup" button. The `backup_jobs` table can only be populated manually via SQL.

**Gap 2 (CRITICAL): No restore/recovery initiation.**
The "New Recovery" button in the Recovery tab is a dead link (just switches tabs). There is no wizard/modal to select a backup, choose recovery point, validate dependencies, or execute a restore. The `recovery_sessions` table has a full pipeline (pending → scope_selected → recovery_point_chosen → dependencies_validated → impact_analyzed → approved → executing → validating → completed) but nothing advances through it.

**Gap 3 (HIGH): No backup deletion.**
There is no way to delete old/unwanted backups from the UI.

**Gap 4 (HIGH): No backup schedule configuration.**
The Schedules tab shows backup schedule cards but has no way to create, edit, or delete schedules.

**Gap 5 (MEDIUM): No backup verification trigger.**
The Verification tab shows results but has no "Run Verification" button.

**Gap 6 (MEDIUM): No compliance report generation.**
The Compliance tab shows reports but has no "Generate Report" button.

**Gap 7 (MEDIUM): No PITR (Point-in-Time Recovery) execution.**
The PITR tab shows recovery points but has no "Restore to This Point" button.

**Gap 8 (MEDIUM): No approval workflow for restores.**
The Approvals tab shows approval requests but has no approve/reject buttons.

---

## Tasks

### Task 1: Create Backup Server Actions (PRIORITY)

**Current:** The entire `features/backup/` directory has only a read-only service. No mutation functions exist.

**Required:** Create `features/backup/actions/backup-actions.ts` with the following server actions:

**1. `startBackupAction(input): Promise<AuthActionState>`**
- Schema: `startBackupSchema` — backupType (database/files/configuration/full), scope (platform/tenant/branch), organizationId (optional if scope=tenant/branch), branchId (optional if scope=branch), reason (min 10 chars), stepUpEmail (MFA)
- Logic:
  - Insert record into `backup_jobs` with status="queued", requested_by=current user
  - For database backups: trigger `SELECT pg_database_size(current_database())` or similar to validate DB is accessible
  - For file backups: validate storage bucket access
  - Return the job ID
- Security: `requireRole(["super_admin"])` + MFA step-up (AAL2 + cookie freshness + stepUpEmail match)
- Rate limit: 5/60s
- Audit: write audit log on create

**2. `deleteBackupAction(input): Promise<AuthActionState>`**
- Schema: `deleteBackupSchema` — backupId (uuid), reason (min 10 chars), stepUpEmail
- Logic: Delete from `backup_jobs` where id = backupId
- Security: MFA + type-to-confirm (type "DELETE_BACKUP:{backupId.slice(0,8)}")
- Rate limit: 5/60s

**3. `initiateRecoveryAction(input): Promise<AuthActionState>`**
- Schema: `initiateRecoverySchema` — backupId (uuid), recoveryType (22 options from DB enum), scope (platform/tenant/branch/gym), organizationId (optional), stepUpEmail
- Logic:
  - Validate backup exists and is completed
  - Create `recovery_sessions` row with status="pending"
  - Create initial `recovery_approvals` row if approval level > 0
- Security: MFA + type-to-confirm (type "RECOVER:{backupId.slice(0,8)}")
- Rate limit: 3/60s

**4. `approveRecoveryAction(input): Promise<AuthActionState>`**
- Schema: `approveRecoverySchema` — recoveryId (uuid), decision (approve/reject/escalate), reviewNote (optional max 500), stepUpEmail
- Logic: Update `recovery_approvals` status, advance `recovery_sessions` status
- Security: MFA

**5. `saveBackupScheduleAction(input): Promise<AuthActionState>`**
- Schema: `saveBackupScheduleSchema` — scheduleId (optional uuid, null=create), name, backupType, frequency (hourly/daily/weekly/monthly/custom_cron), customCron (if frequency=custom_cron), retentionDays, storageTier, isActive, preferredWindowStart, preferredWindowEnd
- Logic: Upsert into `backup_schedules`
- Security: requireRole(["super_admin"])
- Rate limit: 10/60s (no MFA needed for schedule config)

**6. `deleteBackupScheduleAction(input): Promise<AuthActionState>`**
- Security: requireRole(["super_admin"]) + type-to-confirm

**7. `runBackupVerificationAction(input): Promise<AuthActionState>`**
- Schema: `runVerificationSchema` — backupId (uuid), verificationType (completeness/file_integrity/db_consistency/encryption_validity/full_recovery_test)
- Logic: Insert into `backup_verifications` with status="in_progress"
- Security: requireRole(["super_admin"]), no MFA needed

**8. `generateComplianceReportAction(input): Promise<AuthActionState>`**
- Schema: `generateComplianceSchema` — reportType (backup_compliance/recovery_testing/dr_readiness/audit/gdpr/soc2/hipaa/pci), organizationId (optional), dateRange
- Logic: Insert into `backup_compliance_reports` with status="generating"
- Security: requireRole(["super_admin"])

**Files to create:**
- `features/backup/actions/backup-actions.ts` — all 8 server actions
- `features/backup/schemas/backup-schemas.ts` — all zod schemas

---

### Task 2: Wire "Create Backup" Button + Modal to Backup Dashboard

**Current:** The Backups tab shows a table of backup jobs with no create button.

**Required:**

1. **Add "Create Backup" button** in the Backups tab header (and optionally in the Overview tab header):
   ```
   <button onClick={() => setShowCreateBackup(true)}
     className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm">
     <Plus className="size-4" />
     Create Backup
   </button>
   ```

2. **CreateBackupModal** — glass-styled modal with:
   - **Step 1: Scope** — Platform (entire system) / Tenant (select org) / Branch (select org + branch)
   - **Step 2: Type** — Database / Files / Configuration / Full (with descriptions for each)
   - **Step 3: Options** — Reason textarea (min 10 chars), MFA step-up email input
   - **Step 4: Confirm** — Summary card, confirm button, type-to-confirm (type "BACKUP")
   - Wire to `startBackupAction`
   - On success: show toast with backup ID, refresh the backup list

3. **Add loading/processing state** — while backup is running, show a status badge "In Progress" with spinner animation

**Files to modify:**
- `app/(super-admin)/super-admin/backups/backup-dashboard.tsx` — add Create Backup button + modal state

---

### Task 3: Wire "Restore from Backup" Workflow with Multi-Step Wizard

**Current:** The Recovery tab shows recovery sessions but "New Recovery" is just a tab link with no action.

**Required:**

1. **Replace "New Recovery" dead link** with a real button that opens `RecoveryWizardModal`

2. **RecoveryWizardModal** — multi-step glass wizard:

   **Step 1: Select Backup** — Search/filter backup jobs table. Select a completed backup. Show backup details (type, date, size, checksum, storage tier).

   **Step 2: Recovery Type** — Select from 22 recovery types (full_platform, database, storage, tenant, franchise_group, branch, membership_data, payment_data, etc). Filtered by backup type.

   **Step 3: Scope** — If tenant/branch recovery, select org and branch.

   **Step 4: Recovery Point** — Show PITR points if available. Option to choose "Latest" or a specific timestamp.

   **Step 5: Impact Analysis** — Show organizations/users affected, data that will be rolled back, estimated downtime.

   **Step 6: Approval** — Show required approval level. If level > 0, show approver list. For level 3-4, require secondary MFA verification.

   **Step 7: Confirm** — Summary of all choices, type-to-confirm ("RECOVER:{backupId.slice(0,8)}"), MFA step-up.

3. Wire to `initiateRecoveryAction` on final confirmation
4. On success: redirect to the Recovery tab showing the newly created session

**Files to modify:**
- `app/(super-admin)/super-admin/backups/backup-dashboard.tsx` — add RecoveryWizard modal, wire New Recovery button

---

### Task 4: Add Approval Workflow for Restore Operations

**Current:** The Approvals tab shows approval requests but has no action buttons.

**Required:**

1. **Each approval card** shows: recovery info, requested by, approval level required, status
2. **Pending approvals** get action buttons:
   - **Approve** (green) — opens approval modal with review note textarea, MFA step-up
   - **Reject** (red) — opens modal with rejection reason, MFA
   - **Escalate** (amber) — opens modal with escalation note, bumps to next approval level
3. **Approval timeline** — show the chain of approvals (level 1 → 2 → 3 → 4) with completed/pending status for each
4. Wire to `approveRecoveryAction`

**Files to modify:**
- `app/(super-admin)/super-admin/backups/backup-dashboard.tsx` — add approve/reject/escalate buttons and modals in Approvals tab

---

### Task 5: Add Backup Schedule Configuration UI

**Current:** The Schedules tab shows backup schedule cards but no create/edit/delete.

**Required:**

1. **Schedule cards** — each shows: name, frequency, backup type, retention days, storage tier, active/inactive toggle, next scheduled run
2. **Each schedule card gets action buttons:**
   - **Edit** (pencil) — opens `BackupScheduleFormModal` pre-filled
   - **Delete** (trash) — confirmation modal with type-to-confirm
   - **Toggle active/inactive** (switch)
3. **"Create Schedule" button** in the Schedules tab header
4. **BackupScheduleFormModal** with:
   - Name, description
   - Backup type (database/files/configuration/full)
   - Frequency (hourly/daily/weekly/monthly/custom_cron)
   - Retention days (number input)
   - Storage tier (hot/warm/cold/archive)
   - Preferred window start/end (time inputs)
   - Active toggle
5. Wire to `saveBackupScheduleAction` and `deleteBackupScheduleAction`

**Files to modify:**
- `app/(super-admin)/super-admin/backups/backup-dashboard.tsx` — add schedule form modal, edit/delete/toggle buttons

---

### Task 6: Add Backup Verification & Compliance Report Triggers

**Current:** Verification tab shows results with no "Run Verification" button. Compliance tab shows reports with no "Generate Report" button.

**Required:**

**Part A: Verification Tab**
1. Add "Run Verification" button in the Verification tab header
2. `RunVerificationModal` with:
   - Backup selector (dropdown of completed backups)
   - Verification type selector (completeness/file_integrity/db_consistency/encryption_validity/full_recovery_test)
   - Reason textarea
   - Run button
3. Wire to `runBackupVerificationAction`
4. Show verification in-progress badge with spinner

**Part B: Compliance Tab**
1. Add "Generate Report" button in the Compliance tab header
2. `GenerateComplianceReportModal` with:
   - Report type (backup_compliance/recovery_testing/dr_readiness/audit/gdpr/soc2/hipaa/pci)
   - Organization filter (optional)
   - Date range (from/to)
   - Generate button
3. Wire to `generateComplianceReportAction`
4. Show "generating" status with download link when complete

**Files to modify:**
- `app/(super-admin)/super-admin/backups/backup-dashboard.tsx` — add verification + compliance modals

---

### Task 7: Add Backup Deletion UI

**Current:** Backup table rows are read-only. No delete button.

**Required:**

1. **Each backup row in the Backups tab** gets a delete button (trash icon, only shown for completed/failed/cancelled statuses — never for running or queued)
2. **DeleteConfirmationModal**:
   - Show backup details (type, date, size)
   - Warning: "This will permanently remove this backup. This action cannot be undone."
   - Reason textarea (min 10 chars)
   - MFA step-up email input
   - Type-to-confirm: Type "DELETE_BACKUP:{first 8 chars of backup ID}"
3. Wire to `deleteBackupAction`
4. Remove the row from the table on success

**Files to modify:**
- `app/(super-admin)/super-admin/backups/backup-dashboard.tsx` — add delete button + confirmation modal

---

### Task 8: Add PITR (Point-in-Time Recovery) Restore

**Current:** The PITR tab shows recovery points but no "Restore to This Point" button.

**Required:**

1. **Each PITR point row** gets a "Restore to This Point" button
2. **PITR Restore Modal**:
   - Shows selected recovery point details (timestamp, granularity, resource type)
   - Select recovery scope (platform/tenant/branch)
   - Warning: "Restoring to this point will roll back all data to {timestamp}. Current data changes after this point will be lost."
   - Type-to-confirm: Type "PITR:{timestamp.replace(/[^0-9]/g, '')}"
   - MFA step-up email input
   - Restore button (destructive styling)
3. Wire to `initiateRecoveryAction` with PITR point ID and timestamp
4. Redirect to Recovery tab showing new recovery session

**Files to modify:**
- `app/(super-admin)/super-admin/backups/backup-dashboard.tsx` — add PITR restore button + modal

---

### Task 9: UI Polish — Glass Effects & Cinematic Styling

Apply the design standards from `SUPER_ADMIN_PRODUCTION_PLAN.md` to ALL backup/restore UI:

**Required style changes:**

1. **Backup dashboard page header** — sticky glass header:
   ```
   bg-background/90 backdrop-blur sticky top-0 z-10 border-b border-border -mx-5 px-5 py-4
   ```
   With title, subtitle, and "Create Backup" + "New Recovery" buttons

2. **Executive KPI boxes** — add reveal-up staggered animation:
   ```tsx
   <div className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md hover:border-border-strong"
        style={{"--reveal-delay": `${i * 0.05}s`} as React.CSSProperties}>
   ```

3. **Tab bar** — glass sticky:
   ```
   sticky top-[73px] z-[9] bg-background/80 backdrop-blur-sm border-b border-border
   ```

4. **Backup job table rows** — hover state:
   ```
   transition-colors hover:bg-surface-muted
   ```
   With status badges using existing Badge variants:
   - Queued: info (cyan)
   - Running: warning (amber)
   - Completed: success (green)
   - Failed: error (red)
   - Cancelled: neutral

5. **Recovery wizard modal** — glass multi-step:
   ```
   <!-- Backdrop -->
   <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4">
     <!-- Modal -->
     <div className="w-full max-w-2xl rounded-lg border border-border bg-surface shadow-2xl max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
       <!-- Step indicator -->
       <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
         {steps.map((s, i) => (
           <div key={i} className={`flex items-center gap-2 ${currentStep > i ? 'text-accent' : currentStep === i ? 'text-foreground' : 'text-muted-foreground'}`}>
             <div className={`size-6 rounded-full grid place-items-center text-xs font-black ${currentStep >= i ? 'bg-accent text-accent-foreground' : 'bg-surface-muted'}`}>{i + 1}</div>
             <span className="text-xs font-black">{s}</span>
             {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
           </div>
         ))}
       </div>
       ...
     </div>
   </div>
   ```

6. **Status cards with colored left border** (for schedule cards, storage tiers, replication status):
   ```
   rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4
   border-l-4 border-l-green-500|amber-500|red-500|cyan-500
   ```

7. **Empty states** — centered with illustration:
   ```
   rounded-lg border border-dashed border-border bg-background p-12 text-center
   ```
   Each tab gets a contextual empty state with a relevant icon and CTA button.

8. **Approval cards** — reveal-up staggered, MFA badge:
   ```
   <div className="reveal-up rounded-lg border border-border bg-surface p-4 space-y-3"
        style={{"--reveal-delay": `${i * 0.05}s`}}>
     <div className="flex items-start justify-between">
       <div>
         <div className="flex items-center gap-2">
           <span className="text-sm font-black">{approval.action}</span>
           <Badge variant={statusVariant}>{approval.status}</Badge>
           <span className="text-[10px] font-black uppercase text-muted-foreground">Level {approval.level}/4</span>
         </div>
         <p className="mt-1 text-xs text-muted-foreground">Required by: {approval.requiredBy}</p>
       </div>
       <!-- Approve/Reject/Escalate buttons -->
     </div>
   </div>
   ```

9. **Step indicator in modals** — as shown above. Active step = accent background, completed = accent, pending = muted.

10. **Type-to-confirm inputs** — glass-styled danger zone:
    ```
    rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2
    ```

---

### Task 10: Fix Data & Type Issues

1. **Fix the "New Recovery" dead link** — Currently `href="/super-admin/backups?tab=recovery"` just changes the URL fragment. Replace with `<button onClick={() => setShowRecoveryWizard(true)}>`.

2. **Fix the 30-second cache** — After any mutation (create backup, delete, etc.), call `revalidatePath("/super-admin/backups")` to bust the server cache. The `unstable_cache` with 30s TTL will still serve stale data for up to 30s after a mutation.

3. **Fix empty dashboard fallback** — When Supabase admin client is unavailable, `getBackupDashboard` returns all zeros. The UI should show a warning banner: "Backup dashboard data unavailable — check database connectivity" rather than silently showing zeros.

4. **Add `BackupDashboard` type updates** — Add `actions` field to the type or handle mutations client-side by re-fetching after each action.

---

## Files Summary

### Files to CREATE:
| File | Purpose |
|------|---------|
| `features/backup/actions/backup-actions.ts` | 8 server actions: start/delete backup, initiate/approve recovery, save/delete schedule, run verification, generate compliance report |
| `features/backup/schemas/backup-schemas.ts` | Zod schemas for all 8 actions |

### Files to MODIFY:
| File | Changes |
|------|---------|
| `app/(super-admin)/super-admin/backups/backup-dashboard.tsx` | Add all modals, action buttons, state management for 7 workflows, glass styling |
| `app/(super-admin)/super-admin/backups/page.tsx` | Add `revalidatePath` after mutations (or handle in actions) |

---

## UI Styling Guidelines

Follow the design system in `docs/SUPER_ADMIN_PRODUCTION_PLAN.md` exactly. Key patterns:

### Recovery Wizard Step Indicator
```tsx
<div className="flex items-center gap-2 px-6 py-4 border-b border-border">
  {steps.map((step, i) => (
    <div key={i} className="flex items-center gap-2">
      <div className={`size-7 rounded-full grid place-items-center text-xs font-black transition-all duration-300 ${
        i <= currentStep ? 'bg-accent text-accent-foreground scale-100' : 'bg-surface-muted text-muted-foreground scale-90'
      }`}>
        {i < currentStep ? <Check className="size-3.5" /> : i + 1}
      </div>
      <span className={`text-xs font-black ${i === currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>{step}</span>
      {i < steps.length - 1 && <div className={`w-8 h-px ${i < currentStep ? 'bg-accent' : 'bg-border'}`} />}
    </div>
  ))}
</div>
```

### Backup Row with Delete Button
```tsx
<div className="rounded-md border border-border bg-background p-4 transition-colors hover:bg-surface-muted">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`size-2 rounded-full ${
        status === 'completed' ? 'bg-green-500' :
        status === 'failed' ? 'bg-red-500' :
        status === 'running' ? 'bg-amber-500 animate-pulse' :
        'bg-muted-foreground'
      }`} />
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black">{backupType.toUpperCase()}</span>
          <Badge variant={statusVariant}>{status}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatBytes(size)} · {createdAt} · {scope}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-1">
      {status === 'completed' && (
        <button onClick={() => setRestoreBackup(job)}
          className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted transition-all grid place-items-center"
          title="Restore from this backup">
          <RotateCcw className="size-4" />
        </button>
      )}
      {(status === 'completed' || status === 'failed') && (
        <button onClick={() => setDeleteBackup(job)}
          className="size-8 rounded-md border border-border bg-background hover:bg-destructive/10 hover:border-destructive/30 text-destructive transition-all grid place-items-center"
          title="Delete backup">
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  </div>
</div>
```

### Create Backup Modal
```tsx
// Glass backdrop + modal shell
<div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 backdrop-blur-sm p-4">
  <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-200">
    {/* Header */}
    <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background/50">
      <h2 className="text-lg font-black">Create Backup</h2>
      <button onClick={onClose} className="size-8 rounded-md border border-border bg-background hover:bg-surface-muted grid place-items-center">
        <X className="size-4" />
      </button>
    </div>
    {/* Content */}
    <div className="p-5 space-y-4">
      {/* Scope selector */}
      <div className="space-y-1">
        <label className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Scope</label>
        <div className="grid grid-cols-3 gap-2">
          {scopes.map(s => (
            <button key={s.value}
              className={`rounded-md border p-3 text-center transition-all ${
                selectedScope === s.value
                  ? 'border-accent bg-accent/5 ring-1 ring-accent/20'
                  : 'border-border bg-background hover:bg-surface-muted'
              }`}
            >
              <s.icon className="mx-auto size-5" />
              <span className="mt-1 block text-xs font-black">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Rest of form */}
      ...
    </div>
    {/* Footer */}
    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-background/50">
      <button onClick={onClose} className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-muted">
        Cancel
      </button>
      <SubmitButton pending={pending} label="Start Backup" />
    </div>
  </div>
</div>
```

### KPI Row
```tsx
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  {kpis.map((kpi, i) => (
    <div key={kpi.label}
      className="reveal-up rounded-lg border border-border bg-surface shadow-[0_18px_60px_rgb(17_18_20/0.06)] p-4 transition-all hover:shadow-md hover:border-border-strong"
      style={{"--reveal-delay": `${i * 0.05}s`} as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-md bg-accent/20">{kpi.icon}</div>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{kpi.label}</div>
          <div className="text-2xl font-black text-foreground">{kpi.value}</div>
        </div>
      </div>
    </div>
  ))}
</div>
```

### Empty State
```tsx
<div className="rounded-lg border border-dashed border-border bg-background p-12 text-center">
  <div className="mx-auto grid size-16 place-items-center rounded-full bg-surface-muted">
    <Database className="size-8 text-muted-foreground" />
  </div>
  <h3 className="mt-4 text-lg font-black">No backups yet</h3>
  <p className="mt-1 text-sm text-muted-foreground">Create your first backup to protect your platform data.</p>
  <div className="mt-6">
    <button onClick={...} className="inline-flex items-center gap-2 rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-black hover:-translate-y-0.5 transition-transform shadow-sm">
      <Plus className="size-4" />
      Create Backup
    </button>
  </div>
</div>
```

---

## Verification Checklist

After completing all tasks, verify:

### Fixes
- [ ] "New Recovery" button opens recovery wizard (not just a dead link)
- [ ] Dashboard cache is busted after mutations (backups appear immediately after creation)

### New Features
- [ ] Create Backup works (database/files/configuration/full, scope platform/tenant/branch)
- [ ] Backup creation shows progress/status in real-time
- [ ] Delete backup works with MFA + type-to-confirm
- [ ] Recovery wizard walks through all steps (select backup → type → scope → PITR → impact → approval → confirm)
- [ ] Recovery initiates real recovery session in the database
- [ ] Approval workflow works (approve/reject/escalate with MFA per level)
- [ ] Schedule CRUD works (create/edit/delete/toggle)
- [ ] Run Verification creates verification record
- [ ] Generate Compliance Report creates report record
- [ ] PITR restore creates recovery session with PITR point

### Styling
- [ ] Backup dashboard has sticky glass header
- [ ] Tab bar has glass backdrop
- [ ] KPI cards animate in with staggered reveal
- [ ] Recovery wizard has step indicator with accent coloring
- [ ] Backup rows have hover transitions and colored status dots
- [ ] Empty states have contextual icons and CTA buttons
- [ ] Delete confirmation has danger zone styling (red border, warning icon)

### Security
- [ ] Create/delete/restore backups require MFA step-up
- [ ] Schedule configuration does NOT require MFA (low-risk)
- [ ] All writes gated with `requireRole(["super_admin"])`
- [ ] All writes produce audit log entries
- [ ] Rate limiting on all mutation endpoints

### Build
- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run lint` passes (0 new errors)
- [ ] `npm run build` completes
- [ ] No page/console errors at `/super-admin/backups`

---

## Important Notes

1. **This is a record-keeping and orchestration layer, NOT actual backup execution.** The `startBackupAction` creates a job record in `backup_jobs` but does NOT call `pg_dump` or perform actual file backups. Actual backup execution would require a separate worker/cron process. This phase builds the **management layer** — the creation, tracking, scheduling, restoration workflow, approval chain, and compliance reporting.

2. **Coordinate with Supabase managed backups.** Supabase Pro plan has daily backups + PITR. This custom backup system is an additional management layer on top. The "Restore" action should document that actual restoration requires Supabase support involvement for database-level restores, but file/configuration restores can be automated.

3. **Do NOT modify existing backup service.** The `getBackupDashboard()` read-only service should remain untouched. All mutations go through the new `backup-actions.ts` file.

4. **Use the drawer + modal pattern from the subscription client.** The existing subscriptions page has a well-tested pattern of `useState` for modal visibility + server action calls + toast feedback + revalidation. Follow that pattern.

5. **The 12-tab dashboard is a single component.** All modals use state within that component. Do not split into separate files — keep all backup UI in `backup-dashboard.tsx` to match the existing architecture.
