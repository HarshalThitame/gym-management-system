import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type TestInfo, test } from "@playwright/test";

type ProfileRow = {
  id: string;
  gym_id: string | null;
  email: string | null;
  full_name: string;
  status: string;
};

type OrganizationSeed = {
  key: "a" | "b" | "c";
  organizationId: string;
  tenantConfigId: string;
  customDomain: string;
  subdomain: string;
  branchDomain: string;
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  gyms: Array<{
    id: string;
    branchId: string;
    name: string;
    slug: string;
  }>;
  ownerUserId: string;
  gymAdminUserId: string;
  trainerUserId: string;
  memberUserId: string;
  trainerId: string;
  memberId: string;
  staffProfileId: string;
  membershipPlanId: string;
  membershipId: string;
  invoiceId: string;
  paymentId: string;
  notificationId: string;
  auditLogId: string;
};

type TenantAuditSeed = {
  runId: string;
  suffix: string;
  password: string;
  superAdminUserId: string;
  organizations: OrganizationSeed[];
  stress: {
    organizationIds: string[];
    gymIds: string[];
    memberIds: string[];
    trainerIds: string[];
  };
};

const localEnv = readLocalEnv();
const publicSupabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const publicSupabaseAnonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const superAdminEmail = readEnv("E2E_SUPER_ADMIN_EMAIL") ?? "hthitame+qa.superadmin@gmail.com";
const defaultPassword = requiredEnv("E2E_AUTH_PASSWORD");

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

test.describe.serial("QA Phase 12 multi-tenant architecture, domains, branding, RLS, and isolation audit", () => {
  let seed: TenantAuditSeed;

  test.beforeAll(async () => {
    seed = await seedTenantAudit();
  });

  test.afterAll(async () => {
    if (seed) {
      await cleanupTenantAudit(seed);
    }
  });

  test("tenant structure, relationships, domain registry, and resolver outputs are correct", async ({}, testInfo) => {
    const organizations = await serviceSelect("organizations", "id,name,slug,status", [like("slug", `p12-${seed.suffix}%`)]);
    const gyms = await serviceSelect<{ id: string; organization_id: string }>("gyms", "id,name,slug,organization_id,status", [like("slug", `p12-${seed.suffix}%`)]);
    const branches = await serviceSelect<{ id: string; organization_id: string; gym_id: string }>("branches", "id,organization_id,gym_id,slug,status", [like("slug", `p12-${seed.suffix}%`)]);
    const members = await serviceSelect("members", "id,gym_id,user_id,member_code,status", [inList("id", seed.organizations.map((org) => org.memberId))]);
    const trainers = await serviceSelect("trainers", "id,gym_id,user_id,employee_code,status", [inList("id", seed.organizations.map((org) => org.trainerId))]);
    const staff = await serviceSelect("staff_profiles", "id,gym_id,employee_code,status", [inList("id", seed.organizations.map((org) => org.staffProfileId))]);
    const tenantDomains = await serviceSelect("tenant_domains", "id,organization_id,branch_id,gym_id,tenant_config_id,domain,normalized_domain,domain_type,routing_mode,status,ssl_status,is_primary", [like("domain", `p12-${seed.suffix}%`)]);

    expect(organizations).toHaveLength(3);
    expect(gyms).toHaveLength(9);
    expect(branches).toHaveLength(9);
    expect(members).toHaveLength(3);
    expect(trainers).toHaveLength(3);
    expect(staff).toHaveLength(3);
    expect(tenantDomains).toHaveLength(9);

    for (const org of seed.organizations) {
      const orgGymIds = new Set(org.gyms.map((gym) => gym.id));
      expect(gyms.filter((gym) => gym.organization_id === org.organizationId)).toHaveLength(3);
      expect(branches.filter((branch) => branch.organization_id === org.organizationId && orgGymIds.has(branch.gym_id))).toHaveLength(3);

      const custom = await resolveTenant(org.customDomain);
      const subdomain = await resolveTenant(org.subdomain);
      const branchDomain = await resolveTenant(org.branchDomain);

      expect(custom?.organization_id).toBe(org.organizationId);
      expect(custom?.gym_id).toBeNull();
      expect(custom?.brand_name).toBe(org.brandName);
      expect(custom?.primary_color).toBe(org.primaryColor);

      expect(subdomain?.organization_id).toBe(org.organizationId);
      expect(subdomain?.domain_type).toBe("subdomain");

      expect(branchDomain?.organization_id).toBe(org.organizationId);
      expect(branchDomain?.branch_id).toBe(org.gyms[0]?.branchId);
      expect(branchDomain?.gym_id).toBe(org.gyms[0]?.id);
      expect(branchDomain?.routing_mode).toBe("branch");
    }

    const invalidDomain = await resolveTenant(`missing-${seed.suffix}.example.com`);
    expect(invalidDomain).toBeNull();

    await attachJson(testInfo, "phase12-tenant-structure", {
      organizations: organizations.length,
      gyms: gyms.length,
      branches: branches.length,
      members: members.length,
      trainers: trainers.length,
      staff: staff.length,
      tenantDomains: tenantDomains.length,
      stressSeed: {
        organizations: seed.stress.organizationIds.length,
        gyms: seed.stress.gymIds.length,
        members: seed.stress.memberIds.length,
        trainers: seed.stress.trainerIds.length
      }
    });
  });

  test("production routing rejects spoofed forwarded hosts while resolver supports white-label domains", async ({ page }, testInfo) => {
    const timings: Array<{ domain: string; status: number; durationMs: number; spoofedBrandRendered: boolean }> = [];

    for (const org of seed.organizations) {
      const startedAt = performance.now();
      await page.setExtraHTTPHeaders({ "x-forwarded-host": org.customDomain });
      const response = await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
      const content = await page.content();
      const durationMs = Math.round(performance.now() - startedAt);
      const spoofedBrandRendered = content.includes(org.brandName);

      timings.push({
        domain: org.customDomain,
        status: response?.status() ?? 0,
        durationMs,
        spoofedBrandRendered
      });

      expect(response?.status()).toBe(200);
      expect(spoofedBrandRendered).toBe(false);
      for (const otherOrg of seed.organizations.filter((candidate) => candidate.organizationId !== org.organizationId)) {
        expect(content).not.toContain(otherOrg.brandName);
      }
    }

    await page.setExtraHTTPHeaders({ "x-forwarded-host": `invalid-${seed.suffix}.example.com` });
    const invalidResponse = await page.goto("/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    const invalidContent = await page.content();
    expect(invalidResponse?.status()).toBe(200);
    expect(seed.organizations.some((org) => invalidContent.includes(org.brandName))).toBe(false);

    await attachJson(testInfo, "phase12-middleware-branding", {
      timings,
      note: "Vercel production does not trust browser-supplied x-forwarded-host; real custom-domain rendering requires actual Vercel domain attachment. Resolver RPC validation covers tenant/domain mapping.",
      target: "tenant resolution < 100ms at resolver layer; public page < 2s target where cache/network permits"
    });
  });

  test("session tokens, JWT tampering, and direct tenant data reuse remain isolated", async ({}, testInfo) => {
    const orgA = seed.organizations[0]!;
    const orgB = seed.organizations[1]!;

    const [memberAToken, memberBToken, adminAToken] = await Promise.all([
      rawSupabaseSignIn(userEmail(seed.runId, "a", "member")),
      rawSupabaseSignIn(userEmail(seed.runId, "b", "member")),
      rawSupabaseSignIn(userEmail(seed.runId, "a", "admin"))
    ]);

    const [memberAOwnRecord, memberASessionReuseAgainstB, memberBOwnRecord, adminAOwnGym, adminASessionReuseAgainstB] = await Promise.all([
      anonSelect(memberAToken, "members", "id", [eq("id", orgA.memberId)]),
      anonSelect(memberAToken, "members", "id", [eq("id", orgB.memberId)]),
      anonSelect(memberBToken, "members", "id", [eq("id", orgB.memberId)]),
      anonSelect(adminAToken, "gyms", "id", [eq("id", orgA.gyms[0]!.id)]),
      anonSelect(adminAToken, "gyms", "id", [eq("id", orgB.gyms[0]!.id)])
    ]);

    expect(memberAOwnRecord).toHaveLength(1);
    expect(memberASessionReuseAgainstB).toEqual([]);
    expect(memberBOwnRecord).toHaveLength(1);
    expect(adminAOwnGym).toHaveLength(1);
    expect(adminASessionReuseAgainstB).toEqual([]);

    const tamperedToken = `${memberAToken.slice(0, -8)}tampered`;
    const tamperedResponse = await fetchWithRetry(`${publicSupabaseUrl}/rest/v1/members?select=id&id=eq.${orgA.memberId}`, {
      headers: {
        apikey: publicSupabaseAnonKey,
        authorization: `Bearer ${tamperedToken}`
      }
    });
    expect(tamperedResponse.status).toBe(401);

    await attachJson(testInfo, "phase12-login-session-isolation", {
      memberAOwnRecord: memberAOwnRecord.length,
      memberASessionReuseAgainstB: memberASessionReuseAgainstB.length,
      memberBOwnRecord: memberBOwnRecord.length,
      adminAOwnGym: adminAOwnGym.length,
      adminASessionReuseAgainstB: adminASessionReuseAgainstB.length,
      tamperedTokenStatus: tamperedResponse.status
    });
  });

  test("Supabase RLS and API isolation block cross-tenant reads, writes, IDOR, and role escalation", async ({}, testInfo) => {
    const orgA = seed.organizations[0]!;
    const orgB = seed.organizations[1]!;
    const [ownerAToken, adminAToken, trainerAToken, memberAToken, memberBToken] = await Promise.all([
      rawSupabaseSignIn(userEmail(seed.runId, "a", "owner")),
      rawSupabaseSignIn(userEmail(seed.runId, "a", "admin")),
      rawSupabaseSignIn(userEmail(seed.runId, "a", "trainer")),
      rawSupabaseSignIn(userEmail(seed.runId, "a", "member")),
      rawSupabaseSignIn(userEmail(seed.runId, "b", "member"))
    ]);

    const [
      ownerAOwnOrg,
      ownerAOtherOrg,
      ownerAOwnGyms,
      ownerAOtherGyms,
      ownerAOwnMembers,
      ownerAOtherMembers,
      adminAOwnGym,
      adminAOtherGym,
      adminAOwnMembers,
      adminAOtherMembers,
      trainerAOwnMember,
      trainerAOtherMember,
      memberAOwnRecord,
      memberAOtherRecord,
      memberBOwnRecord
    ] = await Promise.all([
      anonSelect(ownerAToken, "organizations", "id", [eq("id", orgA.organizationId)]),
      anonSelect(ownerAToken, "organizations", "id", [eq("id", orgB.organizationId)]),
      anonSelect(ownerAToken, "gyms", "id", [eq("organization_id", orgA.organizationId)]),
      anonSelect(ownerAToken, "gyms", "id", [eq("organization_id", orgB.organizationId)]),
      anonSelect(ownerAToken, "members", "id", [like("member_code", `${seed.runId}-A%`)]),
      anonSelect(ownerAToken, "members", "id", [like("member_code", `${seed.runId}-B%`)]),
      anonSelect(adminAToken, "gyms", "id", [eq("id", orgA.gyms[0]!.id)]),
      anonSelect(adminAToken, "gyms", "id", [eq("id", orgB.gyms[0]!.id)]),
      anonSelect(adminAToken, "members", "id", [eq("gym_id", orgA.gyms[0]!.id)]),
      anonSelect(adminAToken, "members", "id", [eq("gym_id", orgB.gyms[0]!.id)]),
      anonSelect(trainerAToken, "members", "id", [eq("id", orgA.memberId)]),
      anonSelect(trainerAToken, "members", "id", [eq("id", orgB.memberId)]),
      anonSelect(memberAToken, "members", "id", [eq("id", orgA.memberId)]),
      anonSelect(memberAToken, "members", "id", [eq("id", orgB.memberId)]),
      anonSelect(memberBToken, "members", "id", [eq("id", orgB.memberId)])
    ]);

    expect(ownerAOwnOrg).toHaveLength(1);
    expect(ownerAOtherOrg).toEqual([]);
    expect(ownerAOwnGyms).toHaveLength(3);
    expect(ownerAOtherGyms).toEqual([]);
    expect(ownerAOwnMembers).toHaveLength(1);
    expect(ownerAOtherMembers).toEqual([]);
    expect(adminAOwnGym).toHaveLength(1);
    expect(adminAOtherGym).toEqual([]);
    expect(adminAOwnMembers).toHaveLength(1);
    expect(adminAOtherMembers).toEqual([]);
    expect(trainerAOwnMember).toHaveLength(1);
    expect(trainerAOtherMember).toEqual([]);
    expect(memberAOwnRecord).toHaveLength(1);
    expect(memberAOtherRecord).toEqual([]);
    expect(memberBOwnRecord).toHaveLength(1);

    const crossTenantMemberInsert = await anonInsert(adminAToken, "members", {
      gym_id: orgB.gyms[0]!.id,
      member_code: `${seed.runId}-ADMIN-A-CROSS`,
      full_name: `${seed.runId} Admin A Cross Tenant Member`,
      email: `cross-${seed.suffix}@example.com`,
      phone: `93${randomDigits(8)}`,
      status: "active",
      joined_at: today(),
      metadata: { run_id: seed.runId, attack: "cross_tenant_member_insert" }
    });
    const ownerCrossDomainInsert = await anonInsert(ownerAToken, "tenant_domains", {
      organization_id: orgB.organizationId,
      domain: `p12-${seed.suffix}-owner-a-to-b.example.com`,
      domain_type: "custom_domain",
      routing_mode: "organization",
      status: "pending",
      is_primary: false,
      ssl_status: "pending",
      metadata: { run_id: seed.runId, attack: "cross_tenant_domain_insert" },
      created_by: orgA.ownerUserId
    });
    const memberRoleEscalation = await anonInsert(memberAToken, "branch_users", {
      organization_id: orgA.organizationId,
      branch_id: orgA.gyms[0]!.branchId,
      user_id: orgA.memberUserId,
      role_name: "organization_owner",
      branch_role: "owner",
      access_scope: "organization",
      status: "active",
      permissions: { attack: "role_escalation" },
      assigned_by: orgA.memberUserId
    });

    expect(crossTenantMemberInsert.ok).toBe(false);
    expect(ownerCrossDomainInsert.ok).toBe(false);
    expect(memberRoleEscalation.ok).toBe(false);

    await attachJson(testInfo, "phase12-rls-api-isolation", {
      ownerAOwnOrg: ownerAOwnOrg.length,
      ownerAOtherOrg: ownerAOtherOrg.length,
      ownerAOwnGyms: ownerAOwnGyms.length,
      ownerAOtherGyms: ownerAOtherGyms.length,
      ownerAOwnMembers: ownerAOwnMembers.length,
      ownerAOtherMembers: ownerAOtherMembers.length,
      adminAOwnGym: adminAOwnGym.length,
      adminAOtherGym: adminAOtherGym.length,
      trainerAOwnMember: trainerAOwnMember.length,
      trainerAOtherMember: trainerAOtherMember.length,
      memberAOwnRecord: memberAOwnRecord.length,
      memberAOtherRecord: memberAOtherRecord.length,
      crossTenantMemberInsert: { ok: crossTenantMemberInsert.ok, status: crossTenantMemberInsert.status, payload: crossTenantMemberInsert.payload },
      ownerCrossDomainInsert: { ok: ownerCrossDomainInsert.ok, status: ownerCrossDomainInsert.status, payload: ownerCrossDomainInsert.payload },
      memberRoleEscalation: { ok: memberRoleEscalation.ok, status: memberRoleEscalation.status, payload: memberRoleEscalation.payload }
    });
  });

  test("reporting, notification, audit log, and storage isolation remain tenant scoped", async ({}, testInfo) => {
    const orgA = seed.organizations[0]!;
    const orgB = seed.organizations[1]!;
    const [ownerAToken, adminAToken, memberAToken] = await Promise.all([
      rawSupabaseSignIn(userEmail(seed.runId, "a", "owner")),
      rawSupabaseSignIn(userEmail(seed.runId, "a", "admin")),
      rawSupabaseSignIn(userEmail(seed.runId, "a", "member"))
    ]);

    const [
      ownerAOwnPayments,
      ownerAOtherPayments,
      adminAOwnInvoices,
      adminAOtherInvoices,
      memberAOwnNotification,
      memberAOtherNotification,
      adminAOwnAuditLog,
      adminAOtherAuditLog
    ] = await Promise.all([
      anonSelect(ownerAToken, "payments", "id", [eq("id", orgA.paymentId)]),
      anonSelect(ownerAToken, "payments", "id", [eq("id", orgB.paymentId)]),
      anonSelect(adminAToken, "invoices", "id", [eq("id", orgA.invoiceId)]),
      anonSelect(adminAToken, "invoices", "id", [eq("id", orgB.invoiceId)]),
      anonSelect(memberAToken, "notifications", "id", [eq("id", orgA.notificationId)]),
      anonSelect(memberAToken, "notifications", "id", [eq("id", orgB.notificationId)]),
      anonSelect(adminAToken, "audit_logs", "id", [eq("id", orgA.auditLogId)]),
      anonSelect(adminAToken, "audit_logs", "id", [eq("id", orgB.auditLogId)])
    ]);

    expect(ownerAOwnPayments).toHaveLength(1);
    expect(ownerAOtherPayments).toEqual([]);
    expect(adminAOwnInvoices).toHaveLength(1);
    expect(adminAOtherInvoices).toEqual([]);
    expect(memberAOwnNotification).toHaveLength(1);
    expect(memberAOtherNotification).toEqual([]);
    expect(adminAOwnAuditLog).toHaveLength(1);
    expect(adminAOtherAuditLog).toEqual([]);

    const ownDocumentPath = `${orgA.memberId}/${seed.runId}-own.txt`;
    const otherDocumentPath = `${orgB.memberId}/${seed.runId}-other.txt`;
    await uploadStorageObject("member-documents", ownDocumentPath, "own tenant document");
    await uploadStorageObject("member-documents", otherDocumentPath, "other tenant document");

    const [ownDocument, otherDocument] = await Promise.all([
      downloadStorageObject(memberAToken, "member-documents", ownDocumentPath),
      downloadStorageObject(memberAToken, "member-documents", otherDocumentPath)
    ]);

    expect(ownDocument.ok).toBe(true);
    expect(otherDocument.ok).toBe(false);

    await attachJson(testInfo, "phase12-reporting-storage-isolation", {
      ownerAOwnPayments: ownerAOwnPayments.length,
      ownerAOtherPayments: ownerAOtherPayments.length,
      adminAOwnInvoices: adminAOwnInvoices.length,
      adminAOtherInvoices: adminAOtherInvoices.length,
      memberAOwnNotification: memberAOwnNotification.length,
      memberAOtherNotification: memberAOtherNotification.length,
      adminAOwnAuditLog: adminAOwnAuditLog.length,
      adminAOtherAuditLog: adminAOtherAuditLog.length,
      storage: {
        ownDocumentStatus: ownDocument.status,
        otherDocumentStatus: otherDocument.status
      }
    });
  });

  test("custom domain lifecycle and tenant stress seed remain performant and isolated", async ({}, testInfo) => {
    const orgA = seed.organizations[0]!;
    const ownerAToken = await rawSupabaseSignIn(userEmail(seed.runId, "a", "owner"));

    const lifecycleDomain = await anonInsert<Array<{ id: string }>>(ownerAToken, "tenant_domains", {
      organization_id: orgA.organizationId,
      branch_id: orgA.gyms[1]!.branchId,
      gym_id: orgA.gyms[1]!.id,
      tenant_config_id: orgA.tenantConfigId,
      domain: `p12-${seed.suffix}-owner-lifecycle.example.com`,
      domain_type: "custom_domain",
      routing_mode: "branch",
      status: "pending",
      is_primary: false,
      ssl_status: "pending",
      metadata: { run_id: seed.runId, lifecycle: "owner_created" },
      created_by: orgA.ownerUserId
    });

    expect(lifecycleDomain.ok).toBe(true);

    const duplicateDomain = await serviceInsertSafe("tenant_domains", {
      organization_id: orgA.organizationId,
      tenant_config_id: orgA.tenantConfigId,
      domain: orgA.customDomain,
      domain_type: "custom_domain",
      routing_mode: "organization",
      status: "pending",
      is_primary: false,
      ssl_status: "pending",
      metadata: { run_id: seed.runId, duplicate: true },
      created_by: orgA.ownerUserId
    });
    expect(duplicateDomain.ok).toBe(false);

    const stressStartedAt = performance.now();
    const [stressOrganizations, stressGyms, stressMembers, stressTrainers] = await Promise.all([
      serviceCount("organizations", [like("slug", `p12-stress-${seed.suffix}%`)]),
      serviceCount("gyms", [like("slug", `p12-stress-${seed.suffix}%`)]),
      serviceCount("members", [like("member_code", `${seed.runId}-S%`)]),
      serviceCount("trainers", [like("employee_code", `${seed.runId}-S%`)])
    ]);
    const stressDurationMs = Math.round(performance.now() - stressStartedAt);

    expect(stressOrganizations).toBe(50);
    expect(stressGyms).toBe(200);
    expect(stressMembers).toBe(5000);
    expect(stressTrainers).toBe(500);

    await attachJson(testInfo, "phase12-domain-stress", {
      lifecycleDomainStatus: lifecycleDomain.status,
      duplicateDomainStatus: duplicateDomain.status,
      stressCounts: {
        organizations: stressOrganizations,
        gyms: stressGyms,
        trainers: stressTrainers,
        members: stressMembers
      },
      stressReadDurationMs: stressDurationMs,
      targets: {
        tenantResolution: "< 100ms resolver target",
        dashboard: "< 2s dashboard target"
      }
    });
  });
});

async function seedTenantAudit(): Promise<TenantAuditSeed> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.replace(/[^a-z0-9-]/g, "-");
  const runId = `P12-${suffix.toUpperCase()}`;
  const roles = await loadRoleIds();
  const superAdmin = await getProfileByEmail(superAdminEmail);
  const organizations: OrganizationSeed[] = [];

  for (const key of ["a", "b", "c"] as const) {
    const label = key.toUpperCase();
    const customDomain = `p12-${suffix}-${key}.example.com`;
    const subdomain = `p12-${suffix}-${key}.platform.test`;
    const branchDomain = `p12-${suffix}-${key}-branch.example.com`;
    const org = await serviceInsert<{ id: string }>("organizations", {
      name: `${runId} Organization ${label}`,
      slug: `p12-${suffix}-org-${key}`,
      organization_type: "multi_branch",
      status: "active",
      primary_domain: customDomain,
      billing_email: `billing-${key}-${suffix}@example.com`,
      settings: { run_id: runId, tenant_key: key },
      created_by: superAdmin.id
    });
    const tenantConfig = await serviceInsert<{ id: string }>("tenant_configs", {
      organization_id: org.id,
      tenant_key: `p12-${suffix}-${key}`,
      plan_tier: key === "c" ? "professional" : "enterprise",
      status: "active",
      custom_domain: customDomain,
      subdomain,
      brand_name: `${runId} Brand ${label}`,
      logo_url: `https://example.com/${runId.toLowerCase()}-${key}.png`,
      favicon_url: `https://example.com/${runId.toLowerCase()}-${key}.ico`,
      primary_color: key === "a" ? "#14532d" : key === "b" ? "#1d4ed8" : "#7c2d12",
      secondary_color: key === "a" ? "#22c55e" : key === "b" ? "#38bdf8" : "#f97316",
      accent_color: key === "a" ? "#bef264" : key === "b" ? "#facc15" : "#14b8a6",
      typography: { heading: "Inter", body: "Inter" },
      email_branding: { from_name: `${runId} Brand ${label}`, footer: `Tenant ${label}` },
      feature_overrides: { run_id: runId },
      limits: { branches: 3, members: 1000, storage_mb: 1024 },
      compliance_settings: { data_region: "IN" },
      updated_by: superAdmin.id
    });

    const gyms: OrganizationSeed["gyms"] = [];
    for (let index = 1; index <= 3; index += 1) {
      const gym = await serviceInsert<{ id: string }>("gyms", {
        organization_id: org.id,
        name: `${runId} Gym ${label}${index}`,
        slug: `p12-${suffix}-${key}-gym-${index}`,
        timezone: "Asia/Kolkata",
        currency: "INR",
        status: "active"
      });
      const branch = await serviceInsert<{ id: string }>("branches", {
        organization_id: org.id,
        gym_id: gym.id,
        name: `${runId} Branch ${label}${index}`,
        slug: `p12-${suffix}-${key}-branch-${index}`,
        branch_code: `P12${label}${index}${suffix.slice(-4).toUpperCase()}`,
        status: "active",
        timezone: "Asia/Kolkata",
        currency: "INR",
        address: `${index} Tenant Street`,
        city: key === "a" ? "Mumbai" : key === "b" ? "Pune" : "Nashik",
        state: "Maharashtra",
        country: "India",
        postal_code: `4000${index}`,
        phone: `91000000${index}${key.charCodeAt(0)}`,
        email: `branch-${key}-${index}-${suffix}@example.com`,
        capacity: 250,
        operating_hours: { monday: "06:00-22:00" },
        metadata: { run_id: runId },
        created_by: superAdmin.id
      });
      gyms.push({ id: gym.id, branchId: branch.id, name: `${runId} Gym ${label}${index}`, slug: `p12-${suffix}-${key}-gym-${index}` });
    }

    const [owner, admin, trainerUser, memberUser] = await Promise.all([
      createAuthUser(userEmail(runId, key, "owner"), defaultPassword, "organization_owner", null, `${runId} Owner ${label}`),
      createAuthUser(userEmail(runId, key, "admin"), defaultPassword, "gym_admin", gyms[0]!.id, `${runId} Admin ${label}`),
      createAuthUser(userEmail(runId, key, "trainer"), defaultPassword, "trainer", gyms[0]!.id, `${runId} Trainer User ${label}`),
      createAuthUser(userEmail(runId, key, "member"), defaultPassword, "member", gyms[0]!.id, `${runId} Member User ${label}`)
    ]);

    await Promise.all([
      upsertProfile(owner.id, null, userEmail(runId, key, "owner"), `${runId} Owner ${label}`),
      upsertProfile(admin.id, gyms[0]!.id, userEmail(runId, key, "admin"), `${runId} Admin ${label}`),
      upsertProfile(trainerUser.id, gyms[0]!.id, userEmail(runId, key, "trainer"), `${runId} Trainer User ${label}`),
      upsertProfile(memberUser.id, gyms[0]!.id, userEmail(runId, key, "member"), `${runId} Member User ${label}`)
    ]);
    await Promise.all([
      insertUserRole(owner.id, roles.organization_owner, null, superAdmin.id),
      insertUserRole(admin.id, roles.gym_admin, gyms[0]!.id, superAdmin.id),
      insertUserRole(trainerUser.id, roles.trainer, gyms[0]!.id, superAdmin.id),
      insertUserRole(memberUser.id, roles.member, gyms[0]!.id, superAdmin.id)
    ]);
    await Promise.all([
      insertBranchUser(org.id, gyms[0]!.branchId, owner.id, "organization_owner", "owner", "organization", superAdmin.id),
      insertBranchUser(org.id, gyms[0]!.branchId, admin.id, "gym_admin", "admin", "single_branch", superAdmin.id),
      insertBranchUser(org.id, gyms[0]!.branchId, trainerUser.id, "trainer", "trainer", "single_branch", superAdmin.id),
      insertBranchUser(org.id, gyms[0]!.branchId, memberUser.id, "member", "viewer", "single_branch", superAdmin.id)
    ]);

    const trainer = await serviceInsert<{ id: string }>("trainers", {
      gym_id: gyms[0]!.id,
      user_id: trainerUser.id,
      employee_code: `${runId}-${label}-TRN`,
      display_name: `${runId} Trainer ${label}`,
      email: userEmail(runId, key, "trainer"),
      phone: `92${key.charCodeAt(0)}${randomDigits(7)}`.slice(0, 12),
      status: "active",
      employment_type: "full_time",
      joined_at: today(-30),
      years_experience: 5,
      hourly_rate_amount: 1000,
      created_by: superAdmin.id,
      metadata: { run_id: runId }
    });
    const member = await serviceInsert<{ id: string }>("members", {
      gym_id: gyms[0]!.id,
      user_id: memberUser.id,
      member_code: `${runId}-${label}-MEM`,
      full_name: `${runId} Member ${label}`,
      email: userEmail(runId, key, "member"),
      phone: `93${key.charCodeAt(0)}${randomDigits(7)}`.slice(0, 12),
      assigned_trainer_id: trainerUser.id,
      status: "active",
      joined_at: today(-15),
      created_by: admin.id,
      metadata: { run_id: runId }
    });
    const staff = await serviceInsert<{ id: string }>("staff_profiles", {
      gym_id: gyms[0]!.id,
      user_id: null,
      employee_code: `${runId}-${label}-STF`,
      full_name: `${runId} Staff ${label}`,
      email: `staff-${key}-${suffix}@example.com`,
      phone: `94${key.charCodeAt(0)}${randomDigits(7)}`.slice(0, 12),
      staff_role: "reception",
      status: "active",
      employment_type: "full_time",
      joined_at: today(-10),
      created_by: admin.id
    });
    const plan = await serviceInsert<{ id: string }>("membership_plans", {
      gym_id: gyms[0]!.id,
      name: `${runId} Plan ${label}`,
      slug: `p12-${suffix}-${key}-plan`,
      description: "Phase 12 multi-tenant audit membership plan.",
      plan_type: "monthly",
      duration_days: 30,
      price_amount: 3000,
      joining_fee_amount: 0,
      currency: "INR",
      access_level: "standard",
      features: ["access"],
      status: "active",
      is_public: true,
      display_order: 1,
      created_by: admin.id
    });
    const membership = await serviceInsert<{ id: string }>("memberships", {
      gym_id: gyms[0]!.id,
      member_id: member.id,
      membership_plan_id: plan.id,
      status: "active",
      start_date: today(-5),
      end_date: today(25),
      activated_at: new Date().toISOString(),
      source: "manual",
      price_amount: 3000,
      joining_fee_amount: 0,
      discount_amount: 0,
      invoice_number: `${runId}-${label}-MSHIP`,
      payment_status: "paid",
      created_by: admin.id,
      updated_by: admin.id
    });
    const invoice = await serviceInsert<{ id: string }>("invoices", {
      gym_id: gyms[0]!.id,
      member_id: member.id,
      membership_id: membership.id,
      invoice_number: `${runId}-${label}-INV`,
      status: "paid",
      currency: "INR",
      subtotal_amount: 3000,
      discount_amount: 0,
      tax_amount: 540,
      amount_paid: 3540,
      issued_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      created_by: admin.id,
      notes: runId
    });
    const payment = await serviceInsert<{ id: string }>("payments", {
      gym_id: gyms[0]!.id,
      member_id: member.id,
      membership_id: membership.id,
      invoice_id: invoice.id,
      payment_number: `${runId}-${label}-PAY`,
      payment_type: "membership_purchase",
      status: "paid",
      method: "cash",
      provider: "manual",
      amount: 3540,
      currency: "INR",
      discount_amount: 0,
      tax_amount: 540,
      receipt_number: `${runId}-${label}-RCT`,
      collected_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      metadata: { run_id: runId },
      created_by: admin.id
    });
    const notification = await serviceInsert<{ id: string }>("notifications", {
      gym_id: gyms[0]!.id,
      user_id: memberUser.id,
      member_id: member.id,
      trainer_id: null,
      category: "system",
      title: `${runId} Notification ${label}`,
      body: "Tenant isolation notification.",
      priority: "normal",
      status: "unread",
      action_url: "/member/notifications",
      metadata: { run_id: runId },
      created_by: admin.id
    });
    const auditLog = await serviceInsert<{ id: string }>("audit_logs", {
      gym_id: gyms[0]!.id,
      actor_id: admin.id,
      action: "tenant.audit.seeded",
      entity_type: "tenant",
      entity_id: org.id,
      metadata: { run_id: runId, tenant: key }
    });

    await Promise.all([
      verifyTenantDomain(customDomain, true),
      verifyTenantDomain(subdomain, false),
      insertTenantDomain(org.id, tenantConfig.id, gyms[0]!.branchId, gyms[0]!.id, branchDomain, "custom_domain", "branch", false, superAdmin.id)
    ]);

    organizations.push({
      key,
      organizationId: org.id,
      tenantConfigId: tenantConfig.id,
      customDomain,
      subdomain,
      branchDomain,
      brandName: `${runId} Brand ${label}`,
      primaryColor: key === "a" ? "#14532d" : key === "b" ? "#1d4ed8" : "#7c2d12",
      secondaryColor: key === "a" ? "#22c55e" : key === "b" ? "#38bdf8" : "#f97316",
      accentColor: key === "a" ? "#bef264" : key === "b" ? "#facc15" : "#14b8a6",
      gyms,
      ownerUserId: owner.id,
      gymAdminUserId: admin.id,
      trainerUserId: trainerUser.id,
      memberUserId: memberUser.id,
      trainerId: trainer.id,
      memberId: member.id,
      staffProfileId: staff.id,
      membershipPlanId: plan.id,
      membershipId: membership.id,
      invoiceId: invoice.id,
      paymentId: payment.id,
      notificationId: notification.id,
      auditLogId: auditLog.id
    });
  }

  const stress = await seedStressDataset(runId, suffix, superAdmin.id);

  return {
    runId,
    suffix,
    password: defaultPassword,
    superAdminUserId: superAdmin.id,
    organizations,
    stress
  };
}

async function seedStressDataset(runId: string, suffix: string, createdBy: string) {
  const organizationRows = Array.from({ length: 50 }, (_, index) => ({
    name: `${runId} Stress Organization ${index + 1}`,
    slug: `p12-stress-${suffix}-org-${index + 1}`,
    organization_type: "multi_branch",
    status: "active",
    billing_email: `stress-org-${index + 1}-${suffix}@example.com`,
    settings: { run_id: runId, stress: true },
    created_by: createdBy
  }));
  const organizations = await serviceInsertMany<{ id: string }>("organizations", organizationRows);
  const gymRows = organizations.flatMap((organization, orgIndex) => Array.from({ length: 4 }, (_, gymIndex) => ({
    organization_id: organization.id,
    name: `${runId} Stress Gym ${orgIndex + 1}-${gymIndex + 1}`,
    slug: `p12-stress-${suffix}-org-${orgIndex + 1}-gym-${gymIndex + 1}`,
    timezone: "Asia/Kolkata",
    currency: "INR",
    status: "active"
  })));
  const gyms = await serviceInsertMany<{ id: string }>("gyms", gymRows);
  const trainerRows = gyms.flatMap((gym, gymIndex) => Array.from({ length: gymIndex < 100 ? 3 : 2 }, (_, trainerIndex) => ({
    gym_id: gym.id,
    user_id: null,
    employee_code: `${runId}-S-TRN-${gymIndex + 1}-${trainerIndex + 1}`,
    display_name: `${runId} Stress Trainer ${gymIndex + 1}-${trainerIndex + 1}`,
    email: `stress-trainer-${gymIndex + 1}-${trainerIndex + 1}-${suffix}@example.com`,
    phone: `95${String(gymIndex).padStart(4, "0")}${String(trainerIndex).padStart(4, "0")}`.slice(0, 12),
    status: "active",
    employment_type: "full_time",
    joined_at: today(-60),
    years_experience: 3,
    hourly_rate_amount: 800,
    created_by: createdBy,
    metadata: { run_id: runId, stress: true }
  })));
  const trainers = await serviceInsertMany<{ id: string }>("trainers", trainerRows, 500);
  const memberRows = gyms.flatMap((gym, gymIndex) => Array.from({ length: 25 }, (_, memberIndex) => ({
    gym_id: gym.id,
    user_id: null,
    member_code: `${runId}-S-MEM-${gymIndex + 1}-${memberIndex + 1}`,
    full_name: `${runId} Stress Member ${gymIndex + 1}-${memberIndex + 1}`,
    email: `stress-member-${gymIndex + 1}-${memberIndex + 1}-${suffix}@example.com`,
    phone: `96${String(gymIndex).padStart(4, "0")}${String(memberIndex).padStart(4, "0")}`.slice(0, 12),
    status: "active",
    joined_at: today(-20),
    created_by: createdBy,
    metadata: { run_id: runId, stress: true }
  })));
  const members = await serviceInsertMany<{ id: string }>("members", memberRows, 500);

  return {
    organizationIds: organizations.map((row) => row.id),
    gymIds: gyms.map((row) => row.id),
    memberIds: members.map((row) => row.id),
    trainerIds: trainers.map((row) => row.id)
  };
}

async function cleanupTenantAudit(seed: TenantAuditSeed) {
  await Promise.allSettled([
    deleteStoragePrefix("member-documents", seed.runId),
    ...seed.organizations.flatMap((org) => [
      deleteStoragePrefix("member-documents", org.memberId)
    ])
  ]);

  await Promise.allSettled([
    serviceDelete("tenant_domain_checks", [like("domain", `p12-${seed.suffix}%`)]),
    serviceDelete("pwa_install_events", [like("client_event_id", `${seed.runId}%`)])
  ]);

  await Promise.allSettled([
    serviceDelete("payments", [like("payment_number", `${seed.runId}%`)]),
    serviceDelete("invoices", [like("invoice_number", `${seed.runId}%`)]),
    serviceDelete("notifications", [like("title", `${seed.runId}%`)]),
    serviceDelete("audit_logs", [like("action", "tenant.audit%"), `metadata->>run_id=eq.${encodeURIComponent(seed.runId)}`]),
    serviceDelete("memberships", [like("invoice_number", `${seed.runId}%`)]),
    serviceDelete("membership_plans", [like("slug", `p12-${seed.suffix}%`)]),
    serviceDelete("staff_profiles", [like("employee_code", `${seed.runId}%`)]),
    serviceDelete("trainers", [like("employee_code", `${seed.runId}%`)]),
    serviceDelete("members", [like("member_code", `${seed.runId}%`)])
  ]);

  await Promise.allSettled([
    serviceDelete("tenant_domains", [like("domain", `p12-${seed.suffix}%`)]),
    serviceDelete("tenant_configs", [like("tenant_key", `p12-${seed.suffix}%`)]),
    serviceDelete("branch_users", [eq("permissions->>run_id", seed.runId)]),
    serviceDelete("branches", [like("slug", `p12-${seed.suffix}%`)]),
    serviceDelete("gyms", [like("slug", `p12-${seed.suffix}%`)]),
    serviceDelete("organizations", [like("slug", `p12-${seed.suffix}%`)]),
    serviceDelete("organizations", [like("slug", `p12-stress-${seed.suffix}%`)])
  ]);

  await Promise.allSettled(seed.organizations.flatMap((org) => [
    deleteAuthUser(org.ownerUserId),
    deleteAuthUser(org.gymAdminUserId),
    deleteAuthUser(org.trainerUserId),
    deleteAuthUser(org.memberUserId)
  ]));
}

async function resolveTenant(host: string) {
  const { payload } = await restRequest<Array<Record<string, unknown>>>("/rest/v1/rpc/resolve_tenant_by_host", {
    method: "POST",
    body: JSON.stringify({ request_host: host })
  });

  return payload[0] ?? null;
}

async function createAuthUser(email: string, password: string, role: string, gymId: string | null, fullName: string) {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { default_role: role, gym_id: gymId }
    })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Auth user create failed for ${email}: ${payload.message ?? payload.error_description ?? response.status}`);
  }
  return payload as { id: string; email: string };
}

async function deleteAuthUser(userId: string) {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });
  return response.ok;
}

async function rawSupabaseSignIn(email: string) {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publicSupabaseAnonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password: defaultPassword })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || `Supabase auth failed with ${response.status}`);
  }

  return payload.access_token as string;
}

async function loadRoleIds() {
  const rows = await serviceSelect<{ id: string; name: string }>("roles", "id,name", []);
  const roleMap = Object.fromEntries(rows.map((row) => [row.name, row.id]));
  for (const role of ["organization_owner", "gym_admin", "trainer", "member"]) {
    if (!roleMap[role]) {
      throw new Error(`Missing role ${role}.`);
    }
  }
  return roleMap as Record<"organization_owner" | "gym_admin" | "trainer" | "member", string>;
}

async function getProfileByEmail(email: string) {
  return getSingle<ProfileRow>("profiles", "id,gym_id,email,full_name,status", [eq("email", email)], `profile ${email}`);
}

async function upsertProfile(userId: string, gymId: string | null, email: string, fullName: string) {
  return restRequest<ProfileRow[]>("/rest/v1/profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      id: userId,
      gym_id: gymId,
      full_name: fullName,
      email,
      phone: `91${randomDigits(8)}`,
      status: "active"
    })
  });
}

async function insertUserRole(userId: string, roleId: string, gymId: string | null, assignedBy: string) {
  return serviceInsertSafe("user_roles", {
    user_id: userId,
    role_id: roleId,
    gym_id: gymId,
    assigned_by: assignedBy
  });
}

async function insertBranchUser(organizationId: string, branchId: string, userId: string, roleName: string, branchRole: string, accessScope: string, assignedBy: string) {
  return serviceInsert("branch_users", {
    organization_id: organizationId,
    branch_id: branchId,
    user_id: userId,
    role_name: roleName,
    branch_role: branchRole,
    access_scope: accessScope,
    status: "active",
    permissions: { run_id: "P12", phase: 12 },
    assigned_by: assignedBy
  });
}

async function insertTenantDomain(
  organizationId: string,
  tenantConfigId: string,
  branchId: string | null,
  gymId: string | null,
  domain: string,
  domainType: string,
  routingMode: string,
  isPrimary: boolean,
  createdBy: string
) {
  return serviceInsert("tenant_domains", {
    organization_id: organizationId,
    branch_id: branchId,
    gym_id: gymId,
    tenant_config_id: tenantConfigId,
    domain,
    domain_type: domainType,
    routing_mode: routingMode,
    status: "verified",
    is_primary: isPrimary,
    ssl_status: "managed_by_vercel",
    verified_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    metadata: { run_id: "P12", source: "phase12_audit" },
    created_by: createdBy
  });
}

async function verifyTenantDomain(domain: string, isPrimary: boolean) {
  return serviceUpdate("tenant_domains", [eq("domain", domain)], {
    status: "verified",
    is_primary: isPrimary,
    ssl_status: "managed_by_vercel",
    verified_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    metadata: { run_id: "P12", source: "phase12_audit", verified_by_test: true }
  });
}

async function restRequest<T>(
  path: string,
  init: RequestInit & { service?: boolean; expectFailure?: boolean } = {}
) {
  const key = init.service === false ? publicSupabaseAnonKey : serviceRoleKey;
  const response = await fetchWithRetry(`${publicSupabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok && !init.expectFailure) {
    throw new Error(`${path} failed with ${response.status}: ${payload?.message ?? payload?.error_description ?? text}`);
  }

  return {
    ok: response.ok,
    status: response.status,
    payload: payload as T
  };
}

async function serviceSelect<T = Record<string, unknown>>(table: string, select: string, filters: string[] = []) {
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}?${query}`, { method: "GET" });
  return payload;
}

async function serviceCount(table: string, filters: string[] = []) {
  const query = ["select=id", ...filters].join("&");
  const response = await fetchWithRetry(`${publicSupabaseUrl}/rest/v1/${table}?${query}`, {
    method: "HEAD",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "count=exact"
    }
  });
  if (!response.ok) {
    throw new Error(`${table} count failed with ${response.status}`);
  }
  return Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
}

async function serviceInsert<T>(table: string, body: Record<string, unknown>) {
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return requireRow(payload, `insert ${table}`);
}

async function serviceInsertSafe<T>(table: string, body: Record<string, unknown>) {
  const { ok, status, payload } = await restRequest<T[]>(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
    expectFailure: true
  });
  return { ok, status, payload };
}

async function serviceUpdate<T = Record<string, unknown>>(table: string, filters: string[], body: Record<string, unknown>) {
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}?${filters.join("&")}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return payload;
}

async function serviceInsertMany<T>(table: string, rows: Array<Record<string, unknown>>, batchSize = 500) {
  const inserted: T[] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { payload } = await restRequest<T[]>(`/rest/v1/${table}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(batch)
    });
    inserted.push(...payload);
  }
  return inserted;
}

async function serviceDelete(table: string, filters: string[]) {
  return restRequest<unknown>(`/rest/v1/${table}?${filters.join("&")}`, {
    method: "DELETE",
    expectFailure: true
  });
}

async function anonSelect<T = Record<string, unknown>>(token: string, table: string, select: string, filters: string[] = []) {
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const response = await fetchWithRetry(`${publicSupabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: publicSupabaseAnonKey,
      authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || `${table} select failed with ${response.status}`);
  }
  return payload as T[];
}

async function anonInsert<T>(token: string, table: string, body: Record<string, unknown>) {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: publicSupabaseAnonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  return {
    ok: response.ok,
    status: response.status,
    payload: payload as T | { message?: string; code?: string }
  };
}

async function uploadStorageObject(bucket: string, path: string, body: string, contentType = "application/pdf") {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": contentType,
      "x-upsert": "true"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`Storage upload failed ${bucket}/${path}: ${response.status} ${await response.text()}`);
  }
}

async function downloadStorageObject(token: string, bucket: string, path: string) {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: "GET",
    headers: {
      apikey: publicSupabaseAnonKey,
      authorization: `Bearer ${token}`
    }
  });
  return { ok: response.ok, status: response.status };
}

async function deleteStoragePrefix(bucket: string, prefix: string) {
  return fetchWithRetry(`${publicSupabaseUrl}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ prefixes: [prefix] })
  }).catch(() => null);
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.status < 500 || attempt === retries) {
        clearTimeout(timeout);
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        clearTimeout(timeout);
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750 * (attempt + 1)));
  }

  throw lastError instanceof Error ? lastError : new Error("Fetch failed after retries.");
}

async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json"
  });
}

async function getSingle<T>(table: string, select: string, filters: string[], label: string) {
  const rows = await serviceSelect<T>(table, select, [...filters, limit(1)]);
  if (!rows[0]) {
    throw new Error(`Missing required ${label}.`);
  }
  return rows[0];
}

function requireRow<T>(rows: T[], label: string) {
  const row = rows[0];
  if (!row) {
    throw new Error(`Supabase returned no row for ${label}.`);
  }
  return row;
}

function userEmail(runId: string, tenantKey: string, role: string) {
  return `hthitame+${runId.toLowerCase()}-${tenantKey}-${role}@gmail.com`;
}

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function like(column: string, value: string) {
  return `${column}=like.${encodeURIComponent(value)}`;
}

function inList(column: string, values: string[]) {
  return `${column}=in.(${values.map(encodeURIComponent).join(",")})`;
}

function limit(count: number) {
  return `limit=${count}`;
}

function today(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function randomDigits(count: number) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join("");
}

function readEnv(name: string) {
  return process.env[name] ?? localEnv[name] ?? null;
}

function requiredEnv(name: string, fallbackName?: string) {
  const value = readEnv(name) ?? (fallbackName ? readEnv(fallbackName) : null);
  if (!value) {
    throw new Error(`Missing required environment variable ${fallbackName ? `${name} or ${fallbackName}` : name}.`);
  }
  return value;
}

function readLocalEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");

    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index).trim();
          const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
          return [key, value];
        })
    );
  } catch {
    return {} as Record<string, string>;
  }
}
