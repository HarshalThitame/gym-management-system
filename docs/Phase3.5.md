Continue from docs/Phase3.5.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.5 — Loyalty Points System for Organization Owner panel.

Short overview:
  The Enterprise plan includes loyalty_points_system — members earn points for check-ins,
  renewals, referrals, and purchases, then redeem points against membership renewals.
  Currently zero implementation exists. This phase builds the points engine: earning
  rules configuration, automatic point accrual on key events, redemption against renewal
  invoices, points balance tracking per member, and a points dashboard in the Org panel.
  The member-facing points view is part of the Member portal (out of scope). This phase
  focuses on the Org Owner configuration and management side.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Run all independent Supabase queries in Promise.all for parallel execution.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 16.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files.
  - features/organization-owner/components/modules/MembersModule.tsx (member patterns, tabs)
  - features/organization-owner/actions/member-actions.ts (member CRUD)
  - features/memberships/actions/membership-actions.ts (renewal, payment creation)
  - features/attendance/actions/attendance-actions.ts (check-in events — where points earn)
  - features/billing/lib/money.ts or features/enterprise/lib/business-rules.ts (currency helpers)
  - features/entitlement/feature-registry.ts (loyalty_points_system in FEATURE_KEYS)

Step 2: Understand where points should be earned.
  Points are awarded on key events:
  - Check-in: awarded in processCheckIn (attendance-actions.ts) after successful check-in
  - Membership renewal: awarded in membership-actions.ts after successful renewal payment
  - Referral (Phase 3.4): awarded in referral-actions.ts when reward is earned
  - Purchase/POS (future): when POS is built

  Each event calls a centralized earnPoints function. This keeps the earning logic
  in one place and prevents duplicate points.

Step 3: Create migration.
  File: supabase/migrations/YYYYMMDD_create_loyalty_points.sql

  Table: loyalty_points_config
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    points_per_check_in integer NOT NULL DEFAULT 10
    points_per_renewal_percentage integer NOT NULL DEFAULT 5  -- 5 points per 100 INR spent
    points_per_referral integer NOT NULL DEFAULT 100
    points_redemption_rate integer NOT NULL DEFAULT 100  -- 100 points = 1 INR discount
    min_points_to_redeem integer NOT NULL DEFAULT 0
    max_redemption_percentage integer DEFAULT 100  -- max % of invoice redeemable with points
    is_active boolean DEFAULT true
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()
    UNIQUE (organization_id)

  Enable RLS.

  Table: loyalty_points
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE
    points integer NOT NULL CHECK (points != 0)  -- positive = earned, negative = redeemed
    source_type text NOT NULL CHECK (source_type IN ('check_in', 'renewal', 'referral', 'purchase', 'redemption', 'adjustment'))
    source_id uuid  -- reference to the event (attendance_session, membership, referral_reward, etc.)
    description text
    created_at timestamptz DEFAULT now()

  Indexes: on (organization_id, member_id), on (member_id, created_at), on (source_type).
  Enable RLS.

  Create a view or function for member points balance:
    CREATE OR REPLACE FUNCTION get_member_points_balance(member_uuid uuid)
    RETURNS integer AS $$
      SELECT COALESCE(SUM(points), 0) FROM loyalty_points WHERE member_id = member_uuid;
    $$ LANGUAGE sql STABLE;

Step 4: Create loyalty server actions.
  File: features/organization-owner/actions/loyalty-actions.ts
  Mark as "use server".

  Export:
  -- Config --
  - getLoyaltyConfig(organizationId) → LoyaltyConfig | null
    Gate: requireOrgFeatureAccess(organizationId, "loyalty_points_system")

  - saveLoyaltyConfig(organizationId, data: { pointsPerCheckIn?, pointsPerRenewalPercentage?, pointsPerReferral?, pointsRedemptionRate?, minPointsToRedeem?, maxRedemptionPercentage? })
    Returns LoyaltyConfig
    Gate: requireOrgFeatureAccess(organizationId, "loyalty_points_system")

  -- Points engine --
  - earnPoints(organizationId, memberId, sourceType, sourceId?, description?)
    Checks config (is_active), calculates points based on config rules.
    Creates loyalty_points row with positive value.
    Returns { pointsEarned: number; newBalance: number }
    No feature gate (called internally). Returns early if config not found or inactive.

  - redeemPoints(organizationId, memberId, pointsToRedeem, sourceId?, description?)
    Validates balance >= pointsToRedeem, respects min_points_to_redeem.
    Creates loyalty_points row with negative value.
    Returns { pointsRedeemed: number; newBalance: number }
    Gate: no gate (called internally).

  - getMemberPointsBalance(organizationId, memberId) → number
    No feature gate (general member data).

  -- Reporting --
  - getPointsSummary(organizationId)
    Returns {
      totalPointsEarned, totalPointsRedeemed, activePointsBalance,
      topEarners[]: { memberId, memberName, balance },
      recentActivity[]: { memberId, memberName, points, sourceType, description, createdAt },
      bySource: { check_in: number, renewal: number, referral: number, purchase: number, redemption: number }
    }
    Gate: requireOrgFeatureAccess(organizationId, "loyalty_points_system")

  - getMemberPointsHistory(organizationId, memberId, page?, pageSize?)
    Returns { transactions: LoyaltyPointRow[]; total: number; balance: number }
    Gate: no gate (member-specific data).

  - getPointsTransactionList(organizationId, filters?: { memberId?, sourceType?, dateFrom?, dateTo?, page?, pageSize? })
    Returns { transactions: LoyaltyPointRow[]; total: number }
    Gate: requireOrgFeatureAccess(organizationId, "loyalty_points_system")

  Import: requireOrgFeatureAccess from @/features/entitlement.
  Import: createSupabaseServerClient from @/lib/supabase/server.

  Parallel DB pattern for getPointsSummary:
    const [earnedRes, redeemedRes, topRes, recentRes, bySourceRes] = await Promise.all([
      supabase.from("loyalty_points").select("points").eq("organization_id", orgId).gt("points", 0),
      supabase.from("loyalty_points").select("points").eq("organization_id", orgId).lt("points", 0),
      supabase.rpc("get_top_loyalty_members", { org_id: orgId, limit_count: 10 }),
      supabase.from("loyalty_points")
        .select("id, member_id, points, source_type, description, created_at, members!inner(full_name)")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
      supabase.from("loyalty_points")
        .select("source_type, points")  // group in JS by source_type
        .eq("organization_id", orgId),
    ]);

Step 5: Hook earning into existing event flows.
  File: features/attendance/actions/attendance-actions.ts
  In processCheckIn, after successful check-in (around line 560, after session creation):
    // Award loyalty points for check-in (fire and forget — don't block check-in)
    if (input.context.organizationId) {
      earnPoints(input.context.organizationId, input.memberId, "check_in", sessionId, "Daily check-in")
        .catch(() => {}); // silently ignore loyalty errors
    }

  File: features/memberships/actions/membership-actions.ts
  After successful membership renewal payment:
    // Award loyalty points for renewal
    if (orgId) {
      const points = Math.floor(paymentAmount / 100 * config.pointsPerRenewalPercentage); // config lookup
      earnPoints(orgId, memberId, "renewal", membershipId, `Membership renewal - ${paymentAmount/100} INR`)
        .catch(() => {});
    }

  File: features/organization-owner/actions/referral-actions.ts (if Phase 3.4 built)
  When a referral reward is marked as earned:
    earnPoints(orgId, referrerId, "referral", rewardId, "Referral reward earned")
      .catch(() => {});

  NOTE: The earnPoints call should NEVER block the main flow. Wrap in try/catch or .catch().
  Awarding loyalty is bonus, not critical path.

Step 6: Hook redemption into membership renewal flow.
  File: features/memberships/actions/membership-actions.ts

  When creating a renewal invoice/payment:
  - Accept optional param: redeemPoints: number
  - If redeemPoints > 0 and org has loyalty_points_system:
    1. Check member's balance >= redeemPoints
    2. Check redeemPoints * (pointsRedemptionRate / 100) <= maxRedemptionPercentage * invoiceAmount
    3. Call redeemPoints(orgId, memberId, redeemPoints, invoiceId, "Renewal discount")
    4. Subtract the discount from the invoice amount
    5. The discount = redeemPoints * (points_redemption_rate / 100) paise

  This applies a point-based discount to the renewal payment.

Step 7: Create loyalty UI component.
  File: features/organization-owner/components/modules/LoyaltyPointsPanel.tsx
  "use client" component, rendered as a sub-tab in the Members module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout — Dashboard Tab:
  - Summary stat cards: Total Points Earned, Total Points Redeemed, Active Balance, 
    Total Redeemable Value (balance * rate in INR)
  - Points by Source bar chart (Recharts): check-in vs renewal vs referral vs redemption
  - Top Earners leaderboard: ranked member list with balances
  - Recent Activity feed: latest point transactions with member name, points, source icon

  Layout — Configuration Tab:
  - Points per check-in: number input
  - Points per renewal: points per 100 INR spent
  - Points per referral: number input
  - Redemption rate: X points = 1 INR discount
  - Minimum points to redeem: number input
  - Max redemption percentage: max % of invoice that can be paid with points
  - Save button

  Layout — Transactions Tab:
  - Filter bar: member dropdown, source type filter, date range
  - Data table: Member Name, Points (green for earn, red for redeem), Source Type badge,
    Description, Date
  - Balance shown per member row
  - CSV export

Step 8: Add points balance to member detail.
  File: features/organization-owner/components/modules/MembersModule.tsx

  In the member detail drawer:
  - Show "Loyalty Points: X" if org has loyalty_points_system feature
  - Show "Redeemable Value: X INR" based on config
  - Fetch balance via getMemberPointsBalance and config in parallel

Step 9: Integrate into Members module.
  File: features/organization-owner/components/modules/MembersModule.tsx

  Add sub-tab: "Loyalty" — LoyaltyPointsPanel
  Gated: only show if org has loyalty_points_system feature.
  Use: const hasLoyalty = useHasFeature("loyalty_points_system");

  Import LoyaltyPointsPanel.

Step 10: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  - Members module shows "Loyalty" tab for Enterprise plan
  - "Loyalty" tab hidden for Growth and Starter plans
  Config:
  - Save loyalty config with all fields
  - Default config values applied
  Earning:
  - Check-in awards correct number of points
  - Renewal awards points based on payment amount
  - Referral awards points when reward earned
  - Points transactions logged with source_type and description
  - Multiple event types work concurrently (Promise.all fire-and-forget)
  Redemption:
  - Member can redeem points against renewal (if Phase 1.5 memberships built)
  - Redemption respects min_points_to_redeem
  - Redemption respects max_redemption_percentage
  - Redemption creates negative loyalty_points row
  - Balance updated correctly after redemption
  Dashboard:
  - Summary stats show correct aggregated numbers
  - Top earners leaderboard shows correct ranking
  - Recent activity shows correct transaction history
  - Points by source chart renders with data
  - CSV export works
  Edge Cases:
  - Check-in fails → no points awarded (earnPoints never called)
  - Config is_active = false → no points awarded for any event
  - Member has 0 points → redemption rejected
  - Negative balance not possible (check constraint prevents)
  - Config not set → earning silently skipped (safe default)
  General:
  - Earning calls NEVER block the main flow (try/catch or .catch())
  - All admin actions gated via requireOrgFeatureAccess
  - Existing flows unchanged — loyalty is additive, not intrusive
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_loyalty_points.sql
  features/organization-owner/actions/loyalty-actions.ts
  features/organization-owner/components/modules/LoyaltyPointsPanel.tsx

Files to Modify:
  features/attendance/actions/attendance-actions.ts (award points after check-in)
  features/memberships/actions/membership-actions.ts (award points after renewal, accept redeemPoints)
  features/organization-owner/actions/referral-actions.ts (award points on referral earned — if Phase 3.4 built)
  features/organization-owner/components/modules/MembersModule.tsx (add points in member detail, add Loyalty tab)

Supabase parallel pattern (use throughout):
  // Fetch config + balance + recent history in parallel
  const [configRes, balanceRes, historyRes] = await Promise.all([
    supabase.from("loyalty_points_config").select("*").eq("organization_id", orgId).maybeSingle(),
    supabase.from("loyalty_points").select("points").eq("member_id", memberId),
    supabase.from("loyalty_points").select("*").eq("member_id", memberId)
      .order("created_at", { ascending: false }).limit(10),
  ]);
  const balance = (balanceRes.data ?? []).reduce((sum, r) => sum + r.points, 0);

  // Dashboard summary: fetch all aggregates in parallel
  const [earned, redeemed, topEarners, recent, bySource] = await Promise.all([
    supabase.from("loyalty_points").select("points").eq("organization_id", orgId).gt("points", 0),
    supabase.from("loyalty_points").select("points").eq("organization_id", orgId).lt("points", 0),
    supabase.from("loyalty_points").select("member_id, members!inner(full_name), sum(points)")
      .eq("organization_id", orgId).order("sum", { ascending: false }).limit(10),
    supabase.from("loyalty_points").select("*, members!inner(full_name)")
      .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
    supabase.from("loyalty_points").select("source_type, points").eq("organization_id", orgId),
  ]);

Key design decisions:
  - Points are atomic integers (no fractional points). Positive = earned, negative = redeemed.
  - Balance = SUM(points). No separate balance column (always derived from transactions).
  - earnPoints and redeemPoints are centralized. All events call these two functions.
  - Earning is fire-and-forget (.catch(() => {})) — never blocks the main event flow.
  - Config is per-organization. Single active config row.
  - LoyaltyPointsPanel is a sub-tab of Members module (3 tabs: Dashboard, Config, Transactions).
  - All server actions gated with requireOrgFeatureAccess(orgId, "loyalty_points_system").
