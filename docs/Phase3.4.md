Continue from docs/Phase3.4.md and docs/ENTERPRISE_PRODUCTION_PLAN.md.
Execute Phase 3.4 — Referral Program for Organization Owner panel.

Short overview:
  The Enterprise plan includes referral_program — members earn rewards for referring
  new members via unique referral codes. Currently zero implementation exists. This
  phase builds the referral engine: unique referral codes per member, tracking who
  referred whom, reward configuration (discount on membership renewal), a referral
  dashboard in the Org panel showing referral stats and payouts. The member-facing
  referral code and sharing UI is part of the Member portal (out of scope for this
  phase). This phase focuses on the Org Owner management and tracking side.

  Supabase: https://bobqiyhljubfrzmhqnqq.supabase.co (see .env.local for keys)
  Run all independent Supabase queries in Promise.all for parallel execution.

Reference: docs/ENTERPRISE_PRODUCTION_PLAN.md Phase 3 Session 15.

---

Pre-flight: verify npm run typecheck, npm run lint, npm run build, and npm test all pass.

---

Step 1: Read existing files.
  - features/organization-owner/components/modules/MembersModule.tsx (member patterns)
  - features/organization-owner/actions/member-actions.ts (member CRUD patterns)
  - features/memberships/actions/membership-actions.ts (how memberships are created,
    renewal logic, discount application)
  - types/database.ts (members table, memberships table)
  - features/entitlement/feature-registry.ts (referral_program in FEATURE_KEYS)

Step 2: Create migration.
  File: supabase/migrations/YYYYMMDD_create_referral_program.sql

  ALTER TABLE members ADD COLUMN IF NOT EXISTS:
    referral_code text UNIQUE  -- generated code like "JOHN-D83K"
    referred_by uuid REFERENCES members(id) ON DELETE SET NULL  -- who referred this member

  CREATE INDEX IF NOT EXISTS idx_members_referral_code ON members(referral_code);
  CREATE INDEX IF NOT EXISTS idx_members_referred_by ON members(referred_by);

  Table: referral_rewards
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    referrer_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE
    referred_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE
    reward_type text NOT NULL CHECK (reward_type IN ('discount', 'credit', 'free_month'))
    reward_value integer NOT NULL  -- percentage for discount (paise), amount for credit, months for free_month
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'earned', 'paid', 'expired'))
    earned_at timestamptz
    paid_at timestamptz
    expiry_date timestamptz
    membership_id uuid REFERENCES memberships(id) ON DELETE SET NULL  -- applied to which membership
    notes text
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()

  Indexes: on (organization_id), on (referrer_id), on (referred_member_id), on (status).
  Enable RLS.

  Table: referral_program_config
  Columns:
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
    reward_type text NOT NULL DEFAULT 'discount' CHECK (reward_type IN ('discount', 'credit', 'free_month'))
    reward_value integer NOT NULL DEFAULT 10  -- 10% discount, or 10000 paise credit, or 1 month
    min_membership_days integer DEFAULT 30  -- referred member must stay X days before reward earned
    max_rewards_per_referrer integer DEFAULT 0  -- 0 = unlimited
    is_active boolean DEFAULT true
    created_at timestamptz DEFAULT now()
    updated_at timestamptz DEFAULT now()
    UNIQUE (organization_id)

  Enable RLS.

Step 3: Create referral server actions.
  File: features/organization-owner/actions/referral-actions.ts
  Mark as "use server".

  Export:
  -- Program config --
  - getReferralConfig(organizationId) → ReferralConfig | null
    Gate: requireOrgFeatureAccess(organizationId, "referral_program")

  - saveReferralConfig(organizationId, data: { rewardType, rewardValue, minMembershipDays?, maxRewards? })
    Returns ReferralConfig
    Gate: requireOrgFeatureAccess(organizationId, "referral_program")

  -- Referral code --
  - generateReferralCode(memberId)
    Creates code from member name + random suffix: "JOHN-D83K"
    Updates member.referral_code.
    No feature gate (called during member creation if org has feature).

  -- Referral tracking --
  - getReferralStats(organizationId)
    Returns {
      totalReferrals, totalRewardsEarned, totalRewardsPaid,
      topReferrers[]: { memberId, memberName, referralCount, rewardsEarned },
      recentReferrals[]: { referrerName, referredName, date, status }
    }
    Gate: requireOrgFeatureAccess(organizationId, "referral_program")

  - getReferralList(organizationId, filters?: { referrerId?, status?, dateFrom?, dateTo?, page?, pageSize? })
    Returns { referrals: ReferralRewardRow[]; total: number }
    Gate: requireOrgFeatureAccess(organizationId, "referral_program")

  - markRewardPaid(organizationId, rewardId) → ReferralRewardRow
    Gate: requireOrgFeatureAccess(organizationId, "referral_program")

  - markRewardEarned(organizationId, rewardId, membershipId?)
    Called automatically when referred member's membership reaches min_membership_days.
    Gate: no separate gate (called internally after membership check).

  -- Apply referral on join --
  - processReferralOnJoin(organizationId, newMemberId, referralCode?)
    When a new member joins with a referral code:
    1. Look up referrer by referral_code
    2. Set newMember.referred_by = referrer.id
    3. Create pending referral_rewards row
    4. The reward is marked as "earned" after min_membership_days
    No feature gate (should work silently if org has feature, or return early if not).

  Parallel DB pattern for getReferralStats:
    const [totalRes, topRes, recentRes, configRes] = await Promise.all([
      supabase.from("referral_rewards").select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase.from("referral_rewards")
        .select("referrer_id, members!referrer_id(full_name), count(*)")
        .eq("organization_id", orgId).eq("status", "earned")
        .order("count", { ascending: false }).limit(10),
      supabase.from("referral_rewards")
        .select("*, members!referrer_id(full_name), referred:members!referred_member_id(full_name)")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(10),
      supabase.from("referral_program_config").select("*").eq("organization_id", orgId).single(),
    ]);

Step 4: Auto-generate referral codes on member creation.
  File: features/organization-owner/actions/member-actions.ts

  In saveMemberAction (new member creation path):
  - After inserting the member, check if org has referral_program feature
  - If yes, call generateReferralCode(memberId) to set their referral code
  - Call in background (don't block member creation):
    generateReferralCode(memberId).catch(() => {});
  - For member updates: if no referral code exists, generate one silently.

  Import generateReferralCode from referral-actions.

Step 5: Hook referral processing into member join flow.
  File: features/organization-owner/actions/member-actions.ts

  In saveMemberAction (new member path):
  - Accept referralCode from formData: formData.get("referralCode") as string | null
  - If referralCode is provided and org has referral_program feature:
    - Call processReferralOnJoin(orgId, newMemberId, referralCode)

  File: features/memberships/actions/membership-actions.ts
  - When a membership reaches min_membership_days (during renewal or cron check):
    - Check if member was referred (member.referred_by is set)
    - If yes, find their pending reward and mark as earned
    - This auto-triggers the reward payout cycle

Step 6: Create referral program UI.
  File: features/organization-owner/components/modules/ReferralProgramPanel.tsx
  "use client" component, rendered as a sub-tab in the Members module.

  Props: { dashboard: OrganizationOwnerDashboard; hasFeature: boolean }

  Layout — Dashboard Tab:
  - Summary stat cards: Total Referrals, Rewards Earned, Rewards Paid, Pending Payouts
  - Top Referrers leaderboard: ranked list of members with most referrals
  - Recent Referrals log: latest referral events

  Layout — Configuration Tab:
  - Reward type select: "Discount on renewal", "Account credit", "Free month"
  - Reward value: percentage (discount), amount (credit), or months (free)
  - Minimum membership days: how long referred member must stay before reward
  - Max rewards per referrer (0 = unlimited)
  - Save button

  Layout — All Referrals Tab:
  - Filter bar: referrer dropdown, status filter, date range
  - Data table: Referrer, Referred Member, Date, Reward Type, Reward Value, Status, Actions
  - Status badges: pending=gray, earned=green, paid=blue, expired=red
  - "Mark as Paid" button for earned rewards
  - CSV export

Step 7: Add referral code field to member invite form.
  File: features/organization-owner/components/modules/MembersModule.tsx

  In the create member drawer form:
  - Add an optional "Referral Code" text input
  - Only shown if org has referral_program feature
  - Pass referralCode to saveMemberAction

Step 8: Integrate into Members module.
  File: features/organization-owner/components/modules/MembersModule.tsx

  Add sub-tab: "Referrals" — ReferralProgramPanel
  Gated: only show if org has referral_program feature.
  Use: const hasReferral = useHasFeature("referral_program");

  Import ReferralProgramPanel.

Step 9: Validation.
  Run: npm run typecheck (0 errors)
  Run: npm run lint (0 new errors)
  Run: npm run build (must complete)
  Run: npm test (no new failures)

  Verification checklist:
  - Members module shows "Referrals" tab for Enterprise plan
  - "Referrals" tab hidden for Growth and Starter plans
  - Referral code auto-generated on member creation
  - Referral code is unique per member
  - New member joins with valid referral code → linked to referrer
  - Pending reward created for successful referral
  - Reward marked as earned after min_membership_days
  - "Mark as Paid" updates reward status
  - Top referrers leaderboard shows correct ranking
  - Referral config saves and applies to new referrals
  - Max rewards per referrer enforced (if set)
  - Referral stats summarize correctly
  - CSV export of referral data works
  - Expired rewards excluded from "pending payout" count
  Edge Cases:
  - Invalid referral code → member joins without referrer (no error)
  - Member refers themselves → rejected (validate referred_by != id)
  - Duplicate referral code generation → unique constraint handles it, retry
  - config not yet set → use defaults (10% discount, 30 days)
  General:
  - All actions gated via requireOrgFeatureAccess (no hardcoded plan checks)
  - Existing member creation flow unchanged — no regression
  - typecheck/lint/build all pass

---

Files to Create:
  supabase/migrations/YYYYMMDD_create_referral_program.sql
  features/organization-owner/actions/referral-actions.ts
  features/organization-owner/components/modules/ReferralProgramPanel.tsx

Files to Modify:
  features/organization-owner/actions/member-actions.ts (generate code on create, accept referralCode param)
  features/organization-owner/components/modules/MembersModule.tsx (add referral input to create form, add Referrals tab)
  features/memberships/actions/membership-actions.ts (auto-mark reward earned on membership milestone)

Supabase parallel pattern example (use throughout):
  // getReferralStats: fetch all aggregations in parallel
  const [referrals, topReferrers, recentReferrals, config] = await Promise.all([
    supabase.from("referral_rewards").select("id, status").eq("organization_id", orgId),
    supabase.from("referral_rewards")
      .select("referrer_id, count(*)")
      .eq("organization_id", orgId).eq("status", "earned")
      .order("count", { ascending: false }).limit(10),
    supabase.from("referral_rewards")
      .select("id, referrer_id, referred_member_id, status, reward_type, reward_value, created_at, members!referrer_id(full_name), referred:members!referred_member_id(full_name)")
      .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
    supabase.from("referral_program_config").select("*").eq("organization_id", orgId).maybeSingle(),
  ]);

Key design decisions:
  - Referral codes are member attributes (ALTER TABLE members ADD referral_code).
    Simplest integration — no separate table, just a unique column.
  - referred_by FK on members tracks the relationship, referral_rewards tracks payouts.
  - Rewards auto-earn when referred member's membership matures. This happens in
    membership-actions.ts during renewal or cron check.
  - ReferralProgramPanel is a sub-tab of Members module (3 tabs: Dashboard, Config, All).
  - All server actions gated with requireOrgFeatureAccess(orgId, "referral_program").
