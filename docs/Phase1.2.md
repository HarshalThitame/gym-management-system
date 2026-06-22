Continue from docs/Phase1.2.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 1.2 — Build CRM / Leads Dashboard for Organization Owner panel.

Context: Public lead capture API exists at app/api/leads/route.ts (POST only).
The leads table exists in the DB. Feature key lead_management is registered but
unlocks nothing in the Org panel — no sidebar, no route, no module.

Goal: Full CRM module — sidebar entry, route guard, LeadsModule UI with data table,
search/filter, detail panel, status management, convert-to-member action,
API extension (GET/PUT/DELETE), and dashboard KPI card.

---

Pre-flight: before starting, verify `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test` all pass.

---

Step 1: Read these files to understand existing patterns:
  - features/entitlement/feature-registry.ts (FEATURE_KEYS and MODULE_FEATURE_MAP)
  - features/organization-owner/lib/organization-owner-modules.tsx (module registry + sidebar)
  - features/organization-owner/components/organization-owner-workspace.tsx (module routing, look for ModuleContent switch/case)
  - features/organization-owner/services/module-data-resolver.ts (module data fetching, look for resolveModuleData)
  - app/(organization-owner)/organization/[module]/page.tsx (route guard pattern)
  - features/organization-owner/components/modules/MembersModule.tsx (example module component, copy its props pattern)
  - app/api/leads/route.ts (existing public lead capture, POST only)

Step 2: Add Leads module to sidebar registry.
  File: features/organization-owner/lib/organization-owner-modules.tsx
  - Import UserRoundPlus from lucide-react at the top
  - Add this module entry to the organizationOwnerModules array (before the closing `]`):
    {
      slug: "leads",
      href: "/organization/leads",
      label: "Leads",
      title: "Lead & Enquiry Management",
      description: "View, manage, and convert leads and enquiries across your organization.",
      icon: <UserRoundPlus className="size-5" />,
      iconKey: "users",
      featureKey: "lead_management" as FeatureKey,
    }

Step 3: Add to MODULE_FEATURE_MAP.
  File: features/entitlement/feature-registry.ts
  Add this entry to MODULE_FEATURE_MAP (before the closing `};`):
    leads: "lead_management",

Step 4: Route guard — no changes needed.
  The existing [module]/page.tsx already resolves any slug dynamically through
  MODULE_FEATURE_MAP and enforces the entitlement check. If lead_management is
  not in activeFeatureKeys, visiting /organization/leads will redirect to
  /organization/locked-feature automatically. Verify this behavior.

Step 5: Create the Leads module UI component.
  File: features/organization-owner/components/modules/LeadsModule.tsx
  This is a "use client" component. Follow the exact props pattern from MembersModule.tsx.

  Props type: { dashboard: OrganizationOwnerDashboard; moduleFilters?: ModuleSearchParams }

  UI requirements:
  - Search input (name/phone/email) at the top
  - Status filter dropdown: All, New, Contacted, Trial Scheduled, Trial Attended, Negotiation, Won, Lost
  - Source filter dropdown: All, Website, Walk-in, Phone, Referral, Social Media, Other
  - Data table with columns: Name, Phone, Email, Source, Status badge (color-coded), Created Date
  - Pagination (page/pageSize from moduleFilters)
  - Clicking a row opens a slide-out drawer (use org-owner-drawer.tsx) or expandable detail panel
  - Detail panel shows: full lead info, notes textarea, status dropdown to change status, 
    "Convert to Member" button
  - "Convert to Member" creates a member record via server action, then marks lead as "won"
  - Empty state when no leads exist (use empty-state.tsx)
  - Loading skeleton while fetching

  Status values: "new", "contacted", "trial_scheduled", "trial_attended", "negotiation", "won", "lost"
  Source values: "website", "walk_in", "phone", "referral", "social_media", "other"

  Import types from features/organization-owner/services/organization-owner-service.ts
  for OrganizationOwnerDashboard, and from module-data-resolver for ModuleSearchParams.

Step 6: Create server actions.
  File: features/organization-owner/actions/lead-actions.ts
  Mark as "use server".

  Export these functions:
  - getOrgLeads(organizationId: string, filters: { q?: string; status?: string; source?: string; page?: number; pageSize?: number })
    → Returns { leads: Lead[]; total: number }
  - updateLeadStatus(organizationId: string, leadId: string, status: string, notes?: string)
    → Returns the updated Lead
  - convertLeadToMember(organizationId: string, leadId: string)
    → Creates a member record from lead data, updates lead status to "won", returns member

  Every action must call at the top:
    await requireOrgFeatureAccess(organizationId, "lead_management");
  Import requireOrgFeatureAccess from @/features/entitlement.

  Use createSupabaseServerClient() from @/lib/supabase/server for DB queries.
  For convertLeadToMember: read the lead row, upsert into members table, update lead status.

  Define a Lead type in this file or import from types/database.ts:
    type Lead = { id: string; organization_id: string; name: string; phone: string; email: string; source: string; status: string; notes: string; created_at: string; updated_at: string };

Step 7: Create lead service.
  File: features/organization-owner/services/lead-service.ts
  Contains Supabase query helpers used by module-data-resolver and the actions.
  Export getLeads(organizationId, filters) with pagination and search logic.

Step 8: Extend the existing leads API route.
  File: app/api/leads/route.ts
  Currently POST only for public lead capture.
  Extend to handle: GET (list), PUT (update), DELETE (archive).
  
  Use Next.js route handlers with method-based routing.
  Import requireApiFeatureAccess from @/features/entitlement.
  GET: requires organization_id query param and auth
  PUT: requires organization_id and lead_id in body, gated with requireApiFeatureAccess(orgId, "lead_management")
  DELETE: requires organization_id and lead_id, gated similarly
  Keep the existing public POST (no auth required) for lead capture from public forms.

Step 9: Add to workspace router.
  File: features/organization-owner/components/organization-owner-workspace.tsx
  - Import LeadsModule near the other module imports
  - In the ModuleContent function's switch/case block, add:
    case "leads":
      return <LeadsModule dashboard={dashboard} moduleFilters={moduleFilters} />;

Step 10: Add to module-data-resolver.
  File: features/organization-owner/services/module-data-resolver.ts
  In resolveModuleData, add a case for "leads" that calls the lead-service getLeads function.
  Follow the same pattern as other modules (staff, members, etc.).

Step 11: Add Leads KPI to enterprise dashboard.
  File: features/organization-owner/components/enterprise-dashboard.tsx
  - Import the lead service and fetch new leads count for current month
  - Add a StatCard in the KPI grid showing "New Leads" with the count
  - Only show this card if leadManagement is in the active feature keys
  - The dashboard already receives planContext which includes activeFeatureKeys

Step 12: Validation.
  Run: npm run typecheck (must pass 0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  - /organization/leads visible in sidebar for Growth/Enterprise plans (unlocked)
  - /organization/leads shows locked badge in sidebar for Starter plan
  - /organization/leads page renders data table with leads
  - Search by name/phone/email filters results
  - Status and source filter dropdowns work
  - Clicking a lead opens detail panel
  - Changing status in detail panel persists
  - "Convert to Member" creates a member and marks lead as "won"
  - Empty state renders when no leads exist
  - Direct URL /organization/leads redirects to locked-feature page for Starter
  - API GET /api/leads returns leads for authenticated org
  - API PUT /api/leads returns 403 for plans without lead_management
  - API POST /api/leads (public capture) still works unauthenticated
  - Dashboard shows "New Leads This Month" KPI for Growth/Enterprise
  - Mobile responsive: table scrolls, drawer works

Critical: Do NOT hardcode any plan checks. All gating must use:
  activeFeatureKeys → MODULE_FEATURE_MAP["leads"] → requireOrgFeatureAccess / requireApiFeatureAccess

Pattern reference for module components (copy MembersModule.tsx structure):
  "use client";
  export function LeadsModule({ dashboard, moduleFilters }: Props) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(moduleFilters?.q || "");
    const [selectedLead, setSelectedLead] = useState(null);
    // useEffect to fetch on mount and filter changes
    // render: search + filters + table + drawer
  }

Pattern reference for server actions:
  "use server";
  import { requireOrgFeatureAccess } from "@/features/entitlement";
  export async function getOrgLeads(orgId, filters) {
    await requireOrgFeatureAccess(orgId, "lead_management");
    // query supabase
  }

Pattern reference for API guards:
  import { requireApiFeatureAccess } from "@/features/entitlement";
  const denied = await requireApiFeatureAccess(orgId, "lead_management");
  if (denied) return denied;
