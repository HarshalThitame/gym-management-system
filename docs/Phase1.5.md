Continue from docs/Phase1.5.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 1.5 — Trainer Commission Tracking + Payroll Export for Organization Owner panel.

Context: Trainer commissions and payroll export have feature keys registered
(trainer_commissions_payroll, payroll_export) but zero implementation — no DB tables,
no server actions, no UI. Trainers currently exist in the trainers table and PT sessions
are tracked, but earnings are not calculated. Payroll export has no module.

Goal: Auto-calculate trainer commissions per PT session and per class taught. Provide
a commission dashboard in the Trainers module. Build a payroll summary module that
combines base salary + commissions and exports as CSV/PDF. All gated via entitlement.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

PART A: Database

Step 1: Read existing patterns.
  - supabase/migrations/ (recent migration files for table creation patterns)
  - features/training/actions/training-actions.ts (how PT sessions are completed)
  - features/classes/actions/class-actions.ts (how class attendance is marked)
  - features/organization-owner/components/modules/TrainersModule.tsx (current trainer UI)
  - features/entitlement/feature-registry.ts (FEATURE_KEYS)

Step 2: Create migration for trainer_commissions.
  File: supabase/migrations/YYYYMMDD_create_trainer_commissions.sql

  Table: trainer_commissions
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE
    source_type text NOT NULL CHECK (source_type IN ('pt_session', 'class', 'membership_sale'))
    source_id uuid NOT NULL
    description text
    amount integer NOT NULL CHECK (amount >= 0)  -- in paise
    rate decimal(5,2) NOT NULL DEFAULT 0  -- percentage rate applied
    calculated_at timestamptz NOT NULL DEFAULT now()
    paid_at timestamptz
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled'))
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on organization_id, on trainer_id, on status, on calculated_at.
  Enable RLS.

Step 3: Create migration for trainer_commission_rates.
  File: same migration file.

  Table: trainer_commission_rates
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE
    source_type text NOT NULL CHECK (source_type IN ('pt_session', 'class', 'membership_sale'))
    rate decimal(5,2) NOT NULL CHECK (rate >= 0 AND rate <= 100)
    is_active boolean DEFAULT true
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()
    UNIQUE (organization_id, trainer_id, source_type)

  This allows per-trainer, per-source-type commission rates.

Step 4: Add base_salary column to trainers table.
  In the same migration, ALTER TABLE trainers ADD COLUMN IF NOT EXISTS base_salary integer DEFAULT 0.
  (In paise. 0 means no fixed salary, commission only.)

---

PART B: Commission Server Actions

Step 5: Create commission server actions.
  File: features/organization-owner/actions/commission-actions.ts
  Mark as "use server".

  Export:
  - getTrainerCommissions(organizationId, filters?: { trainerId?, status?, dateFrom?, dateTo?, page?, pageSize? })
    Returns { commissions: Commission[]; total: number; summary: { totalPending, totalPaid, totalAmount } }
    Gate: requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll")

  - getCommissionRates(organizationId) → CommissionRate[]
    Gate: requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll")

  - setCommissionRate(organizationId, trainerId, sourceType, rate) → CommissionRate
    Gate: requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll")

  - markCommissionPaid(organizationId, commissionId) → Commission
    Gate: requireOrgFeatureAccess(organizationId, "trainer_commissions_payroll")

  - calculateCommissionsForSession(organizationId, trainerId, sourceType, sourceId, baseAmount)
    Creates a commission row using the trainer's rate for that source_type.
    Called internally when PT sessions complete or class attendance is marked.

  Import requireOrgFeatureAccess from @/features/entitlement.
  Import createSupabaseServerClient from @/lib/supabase/server.

Step 6: Trigger commission calculation on PT session completion.
  File: features/training/actions/training-actions.ts
  Find the function that completes/finishes a PT session.
  After marking the session complete, call calculateCommissionsForSession
  from commission-actions.ts with source_type = "pt_session".
  Use the session price as baseAmount.
  Wrap in try/catch — don't block session completion on commission error.

Step 7: Trigger commission calculation on class attendance.
  File: features/classes/actions/class-actions.ts
  Find the function that marks class attendance (trainer teaching a class).
  After recording attendance, call calculateCommissionsForSession
  with source_type = "class".
  Use a configurable per-class rate or the trainer's class rate.
  Wrap in try/catch.

---

PART C: Commission UI

Step 8: Create commission panel component.
  File: features/organization-owner/components/modules/TrainerCommissionPanel.tsx
  "use client" component.

  Layout:
  - Summary row at top: Total Pending (₹), Total Paid (₹), Total Commissions (₹)
  - Filter bar: trainer dropdown, status dropdown, date range
  - Data table: Trainer Name, Source Type, Description, Amount (₹), Rate %, Date, Status badge
  - Status badges color-coded: pending=orange, paid=green, cancelled=gray
  - Row actions: "Mark Paid" button for pending commissions
  - Undo/cancel option for paid commissions (within 24h)
  - CSV export of commissions

  Props: { organizationId: string; hasFeature: boolean }

Step 9: Create commission rates config panel.
  File: features/organization-owner/components/modules/CommissionRatesPanel.tsx
  "use client" component.

  Layout:
  - Data table: Trainer Name, PT Session Rate (%), Class Rate (%), Membership Sale Rate (%)
  - Edit: inline edit or modal to change rate per trainer per source type
  - Default rates section: set org-wide default commission rates

  Props: { organizationId: string; hasFeature: boolean }

---

PART D: Payroll

Step 10: Create payroll server actions.
  File: features/organization-owner/actions/payroll-actions.ts
  Mark as "use server".

  Export:
  - getMonthlyPayroll(organizationId, month: string, year: string)
    Returns PayrollRecord[] where each record:
      { trainerId, trainerName, baseSalary, totalCommissions, deductions, netPayable, commissionCount }
    Gate: requireOrgFeatureAccess(organizationId, "payroll_export")
    Aggregates trainer_commissions for the month + base_salary from trainers table.
    Deductions default to 0 (can be extended later).

  - exportPayrollCSV(organizationId, month, year) → CSV string
    Gate: requireOrgFeatureAccess(organizationId, "payroll_export")

  - exportPayrollPDF(organizationId, month, year) → PDF buffer or base64
    Gate: requireOrgFeatureAccess(organizationId, "payroll_export")
    Uses the existing pdf-lib integration (see features/billing/lib/invoice-pdf.ts for pattern).

  Import requireOrgFeatureAccess from @/features/entitlement.

Step 11: Create payroll module component.
  File: features/organization-owner/components/modules/PayrollModule.tsx
  "use client" component.

  Layout:
  - Month/year picker at top
  - Summary row: Total Payroll (₹), Total Trainers, Avg per Trainer
  - Data table: Trainer Name, Base Salary (₹), Commissions (₹), Deductions (₹), Net Payable (₹)
  - Net Payable column highlighted
  - "Export CSV" button → downloads CSV
  - "Export PDF" button → downloads PDF
  - Empty state if no commissions for selected month

  Props: { organizationId: string; hasFeature: boolean }

Step 12: Integrate into Trainers module.
  File: features/organization-owner/components/modules/TrainersModule.tsx

  Add sub-tabs to the Trainers module:
  1. "Trainers" (existing trainer list)
  2. "Commissions" (TrainerCommissionPanel — gated on trainer_commissions_payroll)
  3. "Rates" (CommissionRatesPanel — gated on trainer_commissions_payroll)
  4. "Payroll" (PayrollModule — gated on payroll_export)

  Pass organizationId and activeFeatureKeys to gate each tab.
  Only show tabs for features the org actually has in its plan.

Step 13: Add Payroll sidebar entry (optional).
  If payroll is significant enough to warrant its own sidebar entry, add it.
  File: features/organization-owner/lib/organization-owner-modules.tsx
  Add module entry:
    {
      slug: "payroll",
      href: "/organization/payroll",
      label: "Payroll",
      title: "Payroll & Commission Reports",
      description: "Monthly payroll summary including base salary and trainer commissions.",
      icon: <ReceiptText className="size-5" />,
      iconKey: "receipt",
      featureKey: "payroll_export" as FeatureKey,
    }
  And add to MODULE_FEATURE_MAP: payroll: "payroll_export",
  And add to workspace router switch/case.
  This is optional — decide based on whether payroll is better as a standalone module
  or as a tab inside Trainers. Tab inside Trainers is recommended (less sidebar clutter).

---

Step 14: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  Commission:
  - Commission auto-calculated when PT session is completed
  - Commission auto-calculated when class attendance is marked
  - Commission rate config works (per-trainer per-source-type)
  - Commission dashboard shows all commissions with correct amounts
  - Status badges color-coded correctly
  - "Mark Paid" updates status and records paid_at
  - CSV export of commissions downloads correctly
  - Commission panel hidden for plans without trainer_commissions_payroll
  Payroll:
  - Monthly payroll shows trainer list with correct salary + commission totals
  - Month/year picker filters correctly
  - CSV export downloads valid payroll report
  - PDF export generates valid PDF (use pdf-lib, follow invoice-pdf.ts pattern)
  - Empty state for months with no data
  - Payroll module hidden for plans without payroll_export
  General:
  - Both features gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - typecheck/lint/build all pass
  - No regression in existing trainer/class/PT session functionality

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_trainer_commissions.sql
  features/organization-owner/actions/commission-actions.ts
  features/organization-owner/actions/payroll-actions.ts
  features/organization-owner/components/modules/TrainerCommissionPanel.tsx
  features/organization-owner/components/modules/CommissionRatesPanel.tsx
  features/organization-owner/components/modules/PayrollModule.tsx

Files to Modify:
  features/training/actions/training-actions.ts (trigger commission on PT session complete)
  features/classes/actions/class-actions.ts (trigger commission on class attendance)
  features/organization-owner/components/modules/TrainersModule.tsx (add sub-tabs)

Key patterns:
  Amounts stored in paise (integers), displayed as rupees (divide by 100).
  Use formatCurrency from features/enterprise/lib/business-rules.ts for display.
  Commission status flow: pending → paid (with paid_at timestamp).
  All server actions gated with requireOrgFeatureAccess.
  PDF generation: use pdf-lib (already in features/billing/lib/invoice-pdf.ts).
