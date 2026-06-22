Continue from docs/Phase1.4.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 1.4 — Dedicated Report Pages for Organization Owner panel.

Context: Four report types have feature keys registered in the entitlement system but no
dedicated UI pages. These features (trainer_performance_report, class_occupancy_report,
lead_conversion_report, branch_revenue_comparison) unlock nothing in the Org panel — they
have no tabs, no chart components, and no data fetching logic for their specific reports.

Goal: Build 4 report tabs inside the existing Analytics module at /organization/analytics.
Each report gets a dedicated sub-tab, chart visualization, data table, date range filter,
and CSV export. All gated through the existing entitlement pipeline.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files to understand patterns.
  - features/organization-owner/components/modules/AnalyticsModule.tsx (how existing analytics tabs work)
  - features/organization-owner/services/organization-owner-service.ts (OrganizationOwnerDashboard type, data available)
  - features/organization-owner/services/module-data-resolver.ts (how analytics data is pre-fetched)
  - app/api/analytics/reports/route.ts (existing analytics API)
  - app/api/training/reports/route.ts (existing training API)
  - app/api/classes/reports/route.ts (existing classes API)
  - features/entitlement/feature-registry.ts (MODULE_FEATURE_MAP, analytics module already mapped to "advanced_reports")
  - components/ui/chart-skeleton.tsx and stat-card.tsx (existing UI components)
  - Look for any existing Recharts usage in the project (revenue charts in enterprise-dashboard.tsx)

Step 2: Understand the data sources.
  The OrganizationOwnerDashboard already fetches these tables:
  - branch_metrics (revenue, attendance per branch per date)
  - trainers (trainer data)
  - class_sessions (class data)
  - attendance_logs (attendance records)
  - members + memberships (member data)
  - payments (revenue tracking)
  
  For the 4 reports, you need to query these tables with specific aggregations.
  Create a dedicated report service rather than overloading the dashboard service.

Step 3: Create report data service.
  File: features/organization-owner/services/report-service.ts

  Export these functions. Each accepts organizationId, dateFrom, dateTo, and optional filters.
  Use createSupabaseServerClient() from @/lib/supabase/server.

  - getTrainerPerformanceReport(orgId, dateFrom, dateTo)
    Returns: { trainerId, trainerName, totalSessions, ptSessions, classSessions, avgRating, totalAttendees }[]
    Query: trainers table joined with class_sessions + attendance_logs for date range.
    Aggregate: count sessions per trainer, average rating from trainer_ratings if table exists.

  - getClassOccupancyReport(orgId, dateFrom, dateTo)
    Returns: { classType, totalSlots, totalBooked, occupancyPercent, avgAttendees }[]
    Query: class_sessions table, calculate booked vs capacity.
    Group by class type or by individual class.

  - getLeadConversionReport(orgId, dateFrom, dateTo)
    Returns: { stage: string, count: number }[]
    Returns funnel data: New → Contacted → Trial Scheduled → Trial Attended → Won → Lost
    Query: leads table grouped by status for date range.
    Also return: { source, total, won, conversionRate }[] for source breakdown.

  - getBranchRevenueComparison(orgId, dateFrom, dateTo)
    Returns: { branchId, branchName, totalRevenue, memberCount, attendanceCount, revenuePerMember }[]
    Query: branches joined with branch_metrics for the date range.
    Also: revenue over time per branch for chart series.

  Each function should be gated:
    await requireFeatureAccess(orgId, "trainer_performance_report"); // or respective key
    Import requireFeatureAccess from @/features/entitlement.

Step 4: Create report UI components.
  File: features/organization-owner/components/modules/reports/TrainerPerformanceReport.tsx
  "use client" component.

  Layout:
  - Date range picker at top (dateFrom, dateTo inputs or preset ranges: 7d, 30d, 90d)
  - Summary stat cards row: Total Trainers, Total Sessions, Avg Rating, Total Attendees
  - Bar chart: sessions per trainer (Recharts BarChart)
  - Data table below chart: trainer name, sessions, PT sessions, class sessions, rating, attendees
  - CSV export button

  Props: { organizationId: string; hasFeature: boolean }
  If !hasFeature, show a locked message: "Trainer performance report requires an upgrade."

Step 5: Create ClassOccupancyReport component.
  File: features/organization-owner/components/modules/reports/ClassOccupancyReport.tsx
  "use client" component.

  Layout:
  - Date range picker
  - Summary: total classes, avg occupancy %, most popular class, under-performing count
  - Bar chart: occupancy % per class type (Recharts BarChart, color by %: green >80%, yellow 50-80%, red <50%)
  - Data table: class name, type, capacity, booked, occupancy %, attendees
  - Highlight under-performing rows (occupancy < 50%) in red
  - CSV export button

  Props: { organizationId: string; hasFeature: boolean }

Step 6: Create LeadConversionReport component.
  File: features/organization-owner/components/modules/reports/LeadConversionReport.tsx
  "use client" component.

  Layout:
  - Date range picker
  - Funnel visualization: horizontal stacked bars showing count at each stage
    (New → Contacted → Trial → Won), with conversion % between stages
  - Source breakdown: table showing source, total leads, won, conversion rate
  - Summary stats: total leads, conversion rate, avg days to convert
  - CSV export button

  Props: { organizationId: string; hasFeature: boolean }

Step 7: Create BranchRevenueReport component.
  File: features/organization-owner/components/modules/reports/BranchRevenueReport.tsx
  "use client" component.

  Layout:
  - Date range picker
  - Summary stats: total revenue, top branch, avg revenue per member
  - Grouped bar chart: revenue per branch side-by-side (Recharts BarChart)
  - Revenue trend line chart: multi-series line chart showing each branch's revenue over time
  - Data table: branch name, revenue, members, attendance, revenue/member
  - CSV export button

  Props: { organizationId: string; hasFeature: boolean }

Step 8: Integrate report tabs into AnalyticsModule.
  File: features/organization-owner/components/modules/AnalyticsModule.tsx

  The Analytics module currently fetches data via module-data-resolver and renders
  AnalyticsEnterpriseModule. You need to:

  - Read the current AnalyticsModule to understand its tab structure
  - Add 4 new tabs: "Trainer Performance", "Class Occupancy", "Lead Conversion", "Branch Revenue"
  - Each tab renders the corresponding report component
  - Pass organizationId from the dashboard prop
  - Gate each tab: only show if the org has the respective feature key
  - The activeFeatureKeys are available from OrgOwnerLayoutClient context or passed as prop
  - If analytics module doesn't use tabs yet, add a tab bar (sub-navigation under the module hero)
  - Default tab: existing analytics view. New tabs: the 4 reports.

  If AnalyticsModule doesn't currently have sub-tabs, create a simple tab bar using existing
  UI patterns. Each tab passes the required feature check.

Step 9: Extend analytics API.
  File: app/api/analytics/reports/route.ts
  Read the existing route to understand its pattern.
  Extend to handle report type via query param: ?type=trainer_performance|class_occupancy|lead_conversion|branch_revenue
  Each type calls the corresponding report-service function.
  Gate each report type with requireApiFeatureAccess using the correct feature key.

Step 10: Add CSV export utility.
  File: features/organization-owner/lib/csv-export.ts (if not already existing)
  Check if features/classes/lib/csv.ts or features/organization-owner/lib/pdf-export.ts exist.
  Create a reusable CSV export helper function:
    export function downloadCSV(headers: string[], rows: string[][], filename: string)
  Uses Blob and URL.createObjectURL to trigger browser download.
  Each report component calls this with its data.

Step 11: Update module-data-resolver (optional).
  File: features/organization-owner/services/module-data-resolver.ts
  If the analytics resolver needs to pre-fetch additional data for the report tabs,
  extend the analytics case. Otherwise, the report components fetch their own data
  client-side via the API.

Step 12: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  - Analytics module shows 4 new report tabs for Growth/Enterprise
  - Report tabs hidden for Starter plan (or show locked state)
  - Trainer Performance: bar chart renders with trainer data
  - Trainer Performance: data table shows correct session counts
  - Class Occupancy: occupancy % chart renders, under-performing highlighted
  - Class Occupancy: data table shows correct fill rates
  - Lead Conversion: funnel chart renders with stage counts
  - Lead Conversion: source breakdown table shows conversion rates
  - Branch Revenue: grouped bar chart compares branches
  - Branch Revenue: line chart shows revenue over time per branch
  - Date range filter works on all 4 reports
  - CSV export button downloads valid CSV for each report
  - Reports show empty state when no data in date range
  - Loading skeleton renders while data loads
  - All 4 reports work independently (not coupled to each other)
  - typecheck/ lint/ build all pass

---

Files to Create:
  features/organization-owner/services/report-service.ts
  features/organization-owner/components/modules/reports/TrainerPerformanceReport.tsx
  features/organization-owner/components/modules/reports/ClassOccupancyReport.tsx
  features/organization-owner/components/modules/reports/LeadConversionReport.tsx
  features/organization-owner/components/modules/reports/BranchRevenueReport.tsx
  features/organization-owner/lib/csv-export.ts (if not already exists)

Files to Modify:
  features/organization-owner/components/modules/AnalyticsModule.tsx (add report tabs + gating)
  app/api/analytics/reports/route.ts (extend with report type handling)

Key patterns for chart components:
  Use Recharts (already in project — check enterprise-dashboard.tsx for examples).
  Import: import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
  All charts wrapped in ResponsiveContainer with width="100%" and fixed height.
  Use existing chart-skeleton.tsx for loading states.
  Use stat-card.tsx for summary KPI cards.

Key pattern for feature gating in report tabs:
  const featureSet = new Set(activeFeatureKeys);
  const hasTrainerReport = featureSet.has("trainer_performance_report");
  // Only show tab if hasTrainerReport is true.
