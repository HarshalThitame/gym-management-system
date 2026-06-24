Continue from docs/Phase3.8.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.8 — Custom Dashboards + Scheduled Reports + Equipment Inventory for Organization Owner panel.

Short overview:
  This phase bundles three independent Enterprise features. Part A (custom_dashboards_kpis)
  extends the existing customizable-dashboard.tsx to save layouts server-side and share
  between users. Part B (scheduled_report_delivery) builds a report scheduler that
  auto-generates and emails PDF reports weekly/monthly. Part C (equipment_inventory_maintenance)
  creates a new sidebar module for tracking gym equipment, service schedules, and AMC
  expiries. All three are independent — build in any order.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Use Promise.all for all independent Supabase queries.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 19.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

PART A: Custom Dashboards & KPIs

Step A1: Read existing customizable dashboard.
  - features/organization-owner/components/customizable-dashboard.tsx (148 lines —
    localStorage-based widget toggling, 10 widget types, drag reorder, already functional)
  - features/organization-owner/components/enterprise-dashboard.tsx (existing KPI computation)
  - features/entitlement/feature-registry.ts (custom_dashboards_kpis in FEATURE_KEYS)

Step A2: Create migration for dashboard layouts.
  File: supabase/migrations/YYYYMMDD_custom_dashboards.sql

  Table: dashboard_layouts
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
    name text NOT NULL DEFAULT 'My Dashboard'
    is_default boolean DEFAULT false
    widgets jsonb NOT NULL DEFAULT '[]'::jsonb
      -- [{ id: "revenue", enabled: true, order: 0, size: "sm"|"md"|"lg", config: {} }]
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Unique: (organization_id, user_id, name).
  Index on organization_id.
  Enable RLS.

Step A3: Extend customizable-dashboard to save to server.
  File: features/organization-owner/components/customizable-dashboard.tsx (modify)

  Current flow: load from localStorage, save to localStorage.
  New flow:
  - On mount: fetch layouts from server via getDashboardLayouts (server action)
  - "Save Layout" button → calls saveDashboardLayout (server action)
  - "Load Layout" dropdown → pick from saved layouts
  - "Set as Default" → marks layout as default, loads it on next visit
  - Drag-and-drop reorder still works (existing)
  - Fallback: if server unavailable or feature disabled, use localStorage

  Server actions (in existing file or new):
  File: features/organization-owner/actions/dashboard-actions.ts
  "use server"
  Export:
  - getDashboardLayouts(organizationId) → DashboardLayout[]
    Gate: requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis")

  - saveDashboardLayout(organizationId, data: { name, widgets, isDefault? })
    Returns DashboardLayout
    Gate: requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis")

  - deleteDashboardLayout(organizationId, layoutId) → void
    Gate: requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis")

  - getDefaultLayout(organizationId) → DashboardLayout | null
    Gate: requireOrgFeatureAccess(organizationId, "custom_dashboards_kpis")

  Parallel DB pattern:
    const [layoutsRes, defaultRes] = await Promise.all([
      supabase.from("dashboard_layouts").select("*").eq("organization_id", orgId)
        .eq("user_id", userId).order("updated_at", { ascending: false }),
      supabase.from("dashboard_layouts").select("*").eq("organization_id", orgId)
        .eq("user_id", userId).eq("is_default", true).maybeSingle(),
    ]);

Step A4: Add more KPI widget types.
  Extend the ALL_WIDGETS array in customizable-dashboard.tsx with new IDs:
  - "new_leads" — New leads this month
  - "expiring_memberships" — Expiring soon count
  - "class_occupancy" — Average class fill %
  - "revenue_per_member" — Revenue per active member
  - "check_ins_today" — Today's check-in count
  - "cross_branch" — Cross-branch check-ins (if Phase 2.6 built)
  - "corporate" — Corporate member count (if Phase 2.4 built)
  - "loyalty_balance" — Total loyalty points outstanding (if Phase 3.5 built)
  Each widget computes its value from dashboard data or a lightweight server action.

---

PART B: Scheduled Report Delivery

Step B1: Read existing PDF generation pattern.
  - features/billing/lib/invoice-pdf.ts (pdf-lib usage, formatCurrency, StandardFonts)

Step B2: Create migration for report schedules.
  File: same migration as Part A (YYYYMMDD_custom_dashboards.sql)

  Table: report_schedules
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    name text NOT NULL
    report_type text NOT NULL CHECK (report_type IN ('revenue_summary', 'member_report', 'attendance_report', 'class_report', 'trainer_performance', 'dashboard_summary'))
    frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly'))
    day_of_week integer CHECK (day_of_week >= 1 AND day_of_week <= 7)  -- for weekly
    day_of_month integer CHECK (day_of_month >= 1 AND day_of_month <= 28)  -- for monthly
    recipients text[] NOT NULL DEFAULT '{}'  -- email addresses
    is_active boolean DEFAULT true
    last_sent_at timestamptz
    next_scheduled_at timestamptz
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Index on organization_id, on next_scheduled_at.
  Enable RLS.

Step B3: Create report schedule server actions.
  File: features/organization-owner/actions/report-schedule-actions.ts
  Mark as "use server".

  Export:
  - getReportSchedules(organizationId) → ReportSchedule[]
    Gate: requireOrgFeatureAccess(organizationId, "scheduled_report_delivery")

  - createReportSchedule(organizationId, data: { name, reportType, frequency, dayOfWeek?, dayOfMonth?, recipients[], isActive? })
    Returns ReportSchedule
    Gate: requireOrgFeatureAccess(organizationId, "scheduled_report_delivery")
    Also calculates next_scheduled_at based on frequency + day config.

  - updateReportSchedule(organizationId, scheduleId, data)
    Returns ReportSchedule
    Gate: requireOrgFeatureAccess(organizationId, "scheduled_report_delivery")

  - deleteReportSchedule(organizationId, scheduleId) → void
    Gate: requireOrgFeatureAccess(organizationId, "scheduled_report_delivery")

  - generateReportPdf(organizationId, reportType, dateFrom?, dateTo?)
    Generates PDF using pdf-lib (follow invoice-pdf.ts pattern).
    Content depends on report_type:
      - revenue_summary: revenue table + chart image
      - member_report: member list table
      - attendance_report: attendance summary
      - dashboard_summary: KPI cards + charts
    Returns { pdfBuffer: Buffer; fileName: string }
    Gate: requireOrgFeatureAccess(organizationId, "scheduled_report_delivery")

  - sendScheduledReport(organizationId, scheduleId)
    Gate: requireOrgFeatureAccess(organizationId, "scheduled_report_delivery")
    1. Fetch schedule config
    2. Generate PDF via generateReportPdf
    3. Send email to recipients via Resend (RESEND_API_KEY from .env.local)
    4. Update last_sent_at and next_scheduled_at
    5. Create delivery log
    Returns { sent: boolean; recipients: number; fileName: string }

  - processScheduledReports(organizationId) — for cron
    Gate: no gate (cron endpoint). Uses hasFeatureAccess silently.
    Finds all active schedules where next_scheduled_at <= now().
    Sends each. Updates next_scheduled_at.
    Returns { processed: number; sent: number; errors: string[] }

  Parallel DB pattern for generateReportPdf:
    const [revenueRes, memberRes, attendanceRes] = await Promise.all([
      supabase.from("payments").select("amount, created_at, status")
        .eq("organization_id", orgId).gte("created_at", dateFrom).lte("created_at", dateTo),
      supabase.from("members").select("full_name, status, created_at")
        .eq("organization_id", orgId),
      supabase.from("attendance_sessions").select("check_in_at, gym_id")
        // need organization-level filtering through gyms
    ]);
    // Then build PDF with pdf-lib using the aggregate data.

Step B4: Create report schedules UI.
  File: features/organization-owner/components/modules/ReportSchedulesPanel.tsx
  "use client" component, rendered as a sub-tab in the Analytics module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout:
  - "Add Schedule" button → opens drawer:
    - Report name input
    - Report type select: Revenue Summary, Member Report, Attendance Report, Class Report, Trainer Performance, Dashboard Summary
    - Frequency select: Daily, Weekly, Monthly
    - If Weekly: day of week select (Monday-Sunday)
    - If Monthly: day of month select (1-28)
    - Recipients: email input with "Add" button (multiple recipients, shows as tags)
    - Active toggle
  - Schedule list: Name, Report Type, Frequency, Next Send, Recipients, Active toggle, Actions (Send Now, Edit, Delete)
  - "Send Now" button → immediately generates and emails the report
  - Next scheduled delivery date shown per schedule

Step B5: Create cron API endpoint.
  File: app/api/cron/scheduled-reports/route.ts
  POST handler secured by CRON_SECRET from .env.local.
  Calls processScheduledReports for all organizations (or passed org_id).
  Returns { processed: number; sent: number; errors: string[] }

---

PART C: Equipment Inventory

Step C1: Create migration for equipment tracking.
  File: supabase/migrations/YYYYMMDD_equipment_inventory.sql

  Table: equipment
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    branch_id uuid REFERENCES branches(id) ON DELETE SET NULL
    name text NOT NULL
    equipment_type text NOT NULL CHECK (equipment_type IN ('cardio', 'strength', 'free_weight', 'machine', 'accessory', 'other'))
    serial_number text
    brand text
    model text
    purchase_date date
    purchase_price integer  -- paise
    warranty_expiry date
    last_service_date date
    next_service_date date
    service_interval_days integer DEFAULT 90
    amc_provider text
    amc_expiry date
    status text NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'under_maintenance', 'out_of_order', 'retired'))
    location text  -- where in the gym
    notes text
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on (organization_id), on (branch_id), on (status), on (next_service_date), on (warranty_expiry), on (amc_expiry).
  Enable RLS.

  Table: equipment_service_logs
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    service_date date NOT NULL DEFAULT CURRENT_DATE
    service_type text NOT NULL CHECK (service_type IN ('routine', 'repair', 'amc', 'inspection'))
    description text
    cost integer  -- paise
    service_provider text
    technician_name text
    next_service_date date
    created_at timestamptz DEFAULT now()

  Indexes: on equipment_id, on (organization_id, service_date).
  Enable RLS.

Step C2: Create equipment server actions.
  File: features/organization-owner/actions/equipment-actions.ts
  Mark as "use server".

  Export:
  - getEquipment(organizationId, filters?: { branchId?, type?, status?, page?, pageSize? })
    Returns { equipment: EquipmentRow[]; total: number; alerts: { warrantyExpiring: number; serviceOverdue: number; amcExpiring: number } }
    Gate: requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance")

  - saveEquipment(organizationId, data: { equipmentId?, name, equipmentType, branchId?, serialNumber?, brand?, model?, purchaseDate?, purchasePrice?, warrantyExpiry?, lastServiceDate?, serviceIntervalDays?, amcProvider?, amcExpiry?, status?, location?, notes? })
    Returns EquipmentRow
    Gate: requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance")

  - deleteEquipment(organizationId, equipmentId) → void
    Gate: requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance")

  - logService(organizationId, equipmentId, data: { serviceDate, serviceType, description?, cost?, serviceProvider?, technicianName? })
    Returns ServiceLogRow
    Gate: requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance")
    Also updates equipment.last_service_date and next_service_date.

  - getServiceHistory(organizationId, equipmentId) → ServiceLogRow[]
    Gate: requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance")

  - getEquipmentAlerts(organizationId)
    Returns equipment with: warranty_expiry within 30 days, next_service_date overdue (< today), amc_expiry within 30 days.
    Gate: requireOrgFeatureAccess(organizationId, "equipment_inventory_maintenance")

  Parallel DB pattern:
    const [equipment, alerts] = await Promise.all([
      supabase.from("equipment").select("*").eq("organization_id", orgId).order("name"),
      supabase.from("equipment").select("id, name, warranty_expiry, next_service_date, amc_expiry, status")
        .eq("organization_id", orgId).eq("status", "operational")
        .or("warranty_expiry.lte." + thirtyDaysFromNow
          + ",next_service_date.lt." + today
          + ",amc_expiry.lte." + thirtyDaysFromNow),
    ]);

Step C3: Create equipment UI component.
  File: features/organization-owner/components/modules/EquipmentModule.tsx
  "use client" component, NEW sidebar module.

  Props: { dashboard: OrganizationOwnerDashboard; moduleData?: { items: EquipmentRow[] }; moduleFilters?: ModuleSearchParams }

  Layout — Equipment Tab:
  - Alert banner at top (if any):
    - "X equipment with warranty expiring" (orange)
    - "X equipment with service overdue" (red)
    - "X equipment with AMC expiring" (orange)
  - Summary stat cards: Total Equipment, Operational, Under Maintenance, Out of Order
  - Filter bar: branch select, type select, status select, search name
  - Data table: Name, Type badge, Branch, Brand/Model, Status badge, Last Service, Next Service, Actions
  - Status badges: operational=green, under_maintenance=yellow, out_of_order=red, retired=gray
  - "Add Equipment" button → drawer: name, type, branch, serial, brand, model, purchase info,
    warranty, service interval, AMC, status, location, notes
  - Row click → Equipment detail panel:
    - Full equipment info
    - Service history log table
    - "Log Service" button → quick form: service type, date, description, cost, provider

  Layout — Alerts Tab (or integrated into main tab):
  - Three sections: Warranty Expiring, Service Overdue, AMC Expiring
  - Each section: equipment list with expiry dates
  - Action buttons: "Log Service" for overdue, "Update Warranty" for expired

Step C4: Add Equipment to sidebar and routing.
  File: features/organization-owner/lib/organization-owner-modules.tsx
  Add module entry:
    {
      slug: "equipment",
      href: "/organization/equipment",
      label: "Equipment",
      title: "Equipment Inventory & Maintenance",
      description: "Track gym equipment, service schedules, warranty, and AMC expiries.",
      icon: <Wrench className="size-5" />,  // import Wrench from lucide-react
      iconKey: "settings",
      featureKey: "equipment_inventory_maintenance" as FeatureKey,
    }

  File: features/entitlement/feature-registry.ts
  Add to MODULE_FEATURE_MAP:
    equipment: "equipment_inventory_maintenance",

  File: features/organization-owner/components/organization-owner-workspace.tsx
  Import EquipmentModule, add case "equipment" to switch.

  File: features/organization-owner/services/module-data-resolver.ts
  Add case "equipment" that fetches from equipment-actions.

---

Final Validation (all three parts):
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Custom Dashboards:
  - Dashboard page shows layout selector dropdown
  - Save layout with widget config
  - Load saved layout restores widget order and visibility
  - "Set as Default" marks layout as default
  - New KPI widget types render with correct data
  Scheduled Reports:
  - Analytics module shows "Scheduled Reports" sub-tab for Enterprise plan
  - Create schedule with report type, frequency, recipients
  - "Send Now" generates PDF and emails it
  - PDF contains correct report data for the selected type
  - Next scheduled date auto-calculated
  - Cron endpoint secured by CRON_SECRET
  - Recipients array saves and displays as email tags
  Equipment:
  - Equipment sidebar entry visible for Enterprise plan
  - Equipment hidden for Growth and Starter plans
  - Create equipment with all fields
  - Equipment list shows with correct status badges
  - Log service updates last_service_date and next_service_date
  - Service history shows all logs for equipment
  - Alert banner shows expiring warranty/AMC/overdue service
  - Filter by branch, type, status works
  General:
  - All three features gated via requireOrgFeatureAccess
  - typecheck/lint/build all pass
  - No regression in existing dashboard/reports/equipment unrelated flows

---

Files to Create:
  supabase/migrations/YYYYMMDD_custom_dashboards_scheduled_reports_equipment.sql
  features/organization-owner/actions/dashboard-actions.ts
  features/organization-owner/actions/report-schedule-actions.ts
  features/organization-owner/actions/equipment-actions.ts
  features/organization-owner/components/modules/ReportSchedulesPanel.tsx
  features/organization-owner/components/modules/EquipmentModule.tsx
  app/api/cron/scheduled-reports/route.ts

Files to Modify:
  features/organization-owner/components/customizable-dashboard.tsx (server-side save/load)
  features/organization-owner/lib/organization-owner-modules.tsx (add equipment module)
  features/entitlement/feature-registry.ts (add equipment to MODULE_FEATURE_MAP)
  features/organization-owner/components/organization-owner-workspace.tsx (add equipment case)
  features/organization-owner/services/module-data-resolver.ts (add equipment resolver)
  features/organization-owner/components/modules/AnalyticsModule.tsx (add Scheduled Reports tab)

Key design decisions:
  - All three parts are independent and can be built in any order.
  - Part A (dashboards): extends existing customizable-dashboard.tsx. Adds server persistence
    with localStorage fallback. No forced migration for existing localStorage users.
  - Part B (reports): reuses pdf-lib already in the project (invoice-pdf.ts pattern).
    Reports contain aggregate data, not raw tables — designed for executive summary.
    Resend for email delivery (RESEND_API_KEY from .env.local).
  - Part C (equipment): new sidebar module at /organization/equipment. Separate from
    the analytics/reporting system. Standalone CRUD + service log tracking.
  - All server actions gated with requireOrgFeatureAccess using the correct feature key
    per part (custom_dashboards_kpis, scheduled_report_delivery, equipment_inventory_maintenance).
  - Promise.all used for all independent Supabase queries across all three parts.
