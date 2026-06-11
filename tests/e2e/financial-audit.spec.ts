import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

type AuditLog = {
  console: Array<{ type: string; text: string; location: unknown }>;
  pageErrors: string[];
  network: Array<{ status: number; method: string; url: string }>;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  gym_id: string | null;
};

type GymRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

type BranchRow = {
  id: string;
  organization_id: string;
  gym_id: string | null;
};

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  price_amount: number;
  duration_days: number;
  status: string;
};

type InvoiceRow = {
  id: string;
  gym_id: string | null;
  member_id: string;
  membership_id: string | null;
  invoice_number: string;
  status: string;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
};

type PaymentRow = {
  id: string;
  gym_id: string | null;
  member_id: string;
  membership_id: string | null;
  invoice_id: string | null;
  payment_number: string;
  payment_type: string;
  status: string;
  method: string;
  provider: string;
  amount: number;
  currency: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  receipt_number: string | null;
};

type RefundRow = {
  id: string;
  payment_id: string;
  invoice_id: string | null;
  member_id: string;
  amount: number;
  status: string;
  provider_refund_id: string | null;
};

type FinancialSeed = {
  runId: string;
  suffix: string;
  gymId: string;
  gymAdminUserId: string;
  receptionUserId: string;
  memberUserId: string;
  otherGymId: string;
  otherOrganizationId: string;
  otherBranchId: string;
  primaryMemberId: string;
  partialMemberId: string;
  frozenMemberId: string;
  expiredMemberId: string;
  cancelledMemberId: string;
  otherTenantMemberId: string;
  basicPlanId: string;
  premiumPlanId: string;
  annualPlanId: string;
  archivedPlanId: string;
  membershipId: string;
  partialMembershipId: string;
  frozenMembershipId: string;
  expiredMembershipId: string;
  cancelledMembershipId: string;
  otherMembershipId: string;
  paidInvoiceId: string;
  paidInvoiceTotal: number;
  partialInvoiceId: string;
  partialInvoiceTotal: number;
  onlineInvoiceId: string;
  razorpayInvoiceId: string;
  otherInvoiceId: string;
  cashPaymentId: string;
  upiPartialPaymentId: string;
  upiFailedPaymentId: string;
  cardFailedPaymentId: string;
  onlinePendingPaymentId: string;
  razorpayPaidPaymentId: string;
  otherPaymentId: string;
  processedRefundId: string;
  requestedRefundId: string;
};

type ApiTiming = {
  name: string;
  route: string;
  status: number | null;
  durationMs: number;
};

const localEnv = readLocalEnv();
const password = requiredEnv("E2E_AUTH_PASSWORD");
const gymAdminEmail = readEnv("E2E_GYM_ADMIN_EMAIL") ?? "hthitame+qa.admin@gmail.com";
const receptionEmail = readEnv("E2E_RECEPTION_EMAIL") ?? "hthitame+qa.reception@gmail.com";
const memberEmail = readEnv("E2E_MEMBER_EMAIL") ?? "hthitame+qa.member@gmail.com";
const publicSupabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const publicSupabaseAnonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

test.use({ screenshot: "on", serviceWorkers: "block", trace: "on", video: "on" });

test.describe.serial("QA Phase 10 financial systems audit", () => {
  let financial: FinancialSeed;

  test.beforeAll(async () => {
    financial = await seedFinancialAudit();
  });

  test.afterAll(async () => {
    if (financial) {
      await cleanupFinancialAudit(financial);
    }
  });

  test("membership plans, lifecycle states, invoices, payments, receipts, refunds, and billing events are seeded consistently", async ({}, testInfo) => {
    const [
      plans,
      memberships,
      invoices,
      payments,
      refunds,
      invoiceItems,
      transactions,
      billingEvents,
      attempts,
      notifications
    ] = await Promise.all([
      serviceSelect<PlanRow>("membership_plans", "id,slug,name,price_amount,duration_days,status", [like("slug", `f10-${financial.suffix}%`)]),
      serviceSelect("memberships", "id,status,payment_status,total_amount,invoice_number", [like("invoice_number", `${financial.runId}%`)]),
      serviceSelect<InvoiceRow>("invoices", "id,gym_id,member_id,membership_id,invoice_number,status,subtotal_amount,discount_amount,tax_amount,total_amount,amount_paid,amount_due", [like("invoice_number", `${financial.runId}%`)]),
      serviceSelect<PaymentRow>("payments", "id,gym_id,member_id,membership_id,invoice_id,payment_number,payment_type,status,method,provider,amount,currency,provider_order_id,provider_payment_id,receipt_number", [like("payment_number", `${financial.runId}%`)]),
      serviceSelect<RefundRow>("refunds", "id,payment_id,invoice_id,member_id,amount,status,provider_refund_id", [eq("member_id", financial.primaryMemberId)]),
      serviceSelect("invoice_items", "id,invoice_id,item_type,total_amount", [inList("invoice_id", [financial.paidInvoiceId, financial.partialInvoiceId, financial.onlineInvoiceId, financial.razorpayInvoiceId])]),
      serviceSelect("transactions", "id,transaction_type,direction,amount", [eq("member_id", financial.primaryMemberId)]),
      serviceSelect("billing_events", "id,event_type,entity_type,entity_id,status", [eq("gym_id", financial.gymId)]),
      serviceSelect("payment_attempts", "id,payment_id,status,amount", [inList("payment_id", [financial.onlinePendingPaymentId, financial.cardFailedPaymentId])]),
      serviceSelect("membership_notification_events", "id,event_type,status", [eq("member_id", financial.primaryMemberId)])
    ]);

    expect(plans).toHaveLength(5);
    expect(memberships.length).toBeGreaterThanOrEqual(6);
    expect(invoices.length).toBeGreaterThanOrEqual(5);
    expect(payments.length).toBeGreaterThanOrEqual(7);
    expect(refunds.length).toBeGreaterThanOrEqual(2);
    expect(invoiceItems.length).toBeGreaterThanOrEqual(4);
    expect(transactions.length).toBeGreaterThanOrEqual(4);
    expect(billingEvents.length).toBeGreaterThanOrEqual(4);
    expect(attempts.length).toBeGreaterThanOrEqual(2);
    expect(notifications.length).toBeGreaterThanOrEqual(2);

    await attachJson(testInfo, "phase10-financial-seed-inventory", {
      plans: plans.map((plan) => ({ slug: plan.slug, price: plan.price_amount, status: plan.status })),
      memberships: memberships.length,
      invoices: invoices.map((invoice) => ({ number: invoice.invoice_number, status: invoice.status, total: invoice.total_amount, due: invoice.amount_due })),
      payments: payments.map((payment) => ({ number: payment.payment_number, status: payment.status, method: payment.method, amount: payment.amount })),
      refunds: refunds.map((refund) => ({ status: refund.status, amount: refund.amount })),
      invoiceItems: invoiceItems.length,
      transactions: transactions.length,
      billingEvents: billingEvents.length,
      attempts: attempts.length,
      notifications: notifications.length
    });
  });

  test("invoice, receipt, partial payment, tax, refund, and analytics calculations remain accurate", async ({}, testInfo) => {
    const [paidInvoice] = await serviceSelect<InvoiceRow>(
      "invoices",
      "id,gym_id,member_id,membership_id,invoice_number,status,subtotal_amount,discount_amount,tax_amount,total_amount,amount_paid,amount_due",
      [eq("id", financial.paidInvoiceId)]
    );
    const [partialInvoice] = await serviceSelect<InvoiceRow>(
      "invoices",
      "id,gym_id,member_id,membership_id,invoice_number,status,subtotal_amount,discount_amount,tax_amount,total_amount,amount_paid,amount_due",
      [eq("id", financial.partialInvoiceId)]
    );
    const methodBreakdown = requireRow(await serviceSelect<{ method: string; payment_count: number; total_amount: number }>(
      "payment_method_breakdown",
      "method,payment_count,total_amount",
      [eq("gym_id", financial.gymId), eq("method", "cash")]
    ), "cash payment method breakdown");
    const dailyRevenue = await serviceSelect<{ gross_revenue: number; discounts: number; payment_count: number }>(
      "revenue_daily_summary",
      "gross_revenue,discounts,payment_count",
      [eq("gym_id", financial.gymId)]
    );
    const refunds = await serviceSelect<RefundRow>(
      "refunds",
      "id,payment_id,invoice_id,member_id,amount,status,provider_refund_id",
      [eq("payment_id", financial.razorpayPaidPaymentId)]
    );

    expect(paidInvoice).toMatchObject({
      subtotal_amount: 3000,
      discount_amount: 300,
      tax_amount: 486,
      total_amount: 3186,
      amount_paid: 3186,
      amount_due: 0,
      status: "paid"
    });
    expect(partialInvoice).toMatchObject({
      subtotal_amount: 5000,
      discount_amount: 0,
      tax_amount: 900,
      total_amount: 5900,
      amount_paid: 2000,
      amount_due: 3900,
      status: "partially_paid"
    });
    expect(methodBreakdown.total_amount).toBeGreaterThanOrEqual(financial.paidInvoiceTotal);
    expect(dailyRevenue.reduce((total, row) => total + Number(row.gross_revenue ?? 0), 0)).toBeGreaterThanOrEqual(financial.paidInvoiceTotal + 2000);
    expect(refunds.reduce((total, refund) => total + refund.amount, 0)).toBe(500);
    expect(refunds[0]?.provider_refund_id).toMatch(/^rfnd_/);

    await attachJson(testInfo, "phase10-financial-calculations", {
      paidInvoice,
      partialInvoice,
      cashMethodBreakdown: methodBreakdown,
      dailyRevenue,
      refunds
    });
  });

  test("duplicate financial identifiers and provider idempotency are blocked", async ({}, testInfo) => {
    const duplicatePlan = await serviceInsertExpectFailure("membership_plans", {
      gym_id: financial.gymId,
      name: `${financial.runId} Duplicate Plan`,
      slug: `f10-${financial.suffix}-basic`,
      description: "Duplicate slug must be rejected.",
      plan_type: "monthly",
      duration_days: 30,
      price_amount: 3000,
      status: "active",
      created_by: financial.gymAdminUserId
    });
    const duplicateInvoice = await serviceInsertExpectFailure("invoices", {
      gym_id: financial.gymId,
      member_id: financial.primaryMemberId,
      membership_id: financial.membershipId,
      invoice_number: `${financial.runId}-INV-PAID`,
      status: "issued",
      subtotal_amount: 1000,
      amount_paid: 0,
      created_by: financial.gymAdminUserId
    });
    const duplicatePayment = await serviceInsertExpectFailure("payments", {
      gym_id: financial.gymId,
      member_id: financial.primaryMemberId,
      membership_id: financial.membershipId,
      invoice_id: financial.paidInvoiceId,
      payment_number: `${financial.runId}-PAY-CASH`,
      payment_type: "membership_purchase",
      status: "paid",
      method: "cash",
      provider: "manual",
      amount: 1000,
      paid_at: new Date().toISOString(),
      created_by: financial.receptionUserId
    });
    const providerEvent = await serviceInsert<{ id: string }>("payment_provider_events", {
      provider: "razorpay",
      event_id: `${financial.runId}-EVT-IDEMPOTENT`,
      event_type: "payment.captured",
      signature: "phase10-signature",
      payload: { runId: financial.runId }
    });
    const duplicateProviderEvent = await serviceInsertExpectFailure("payment_provider_events", {
      provider: "razorpay",
      event_id: `${financial.runId}-EVT-IDEMPOTENT`,
      event_type: "payment.captured",
      signature: "phase10-signature",
      payload: { runId: financial.runId, duplicate: true }
    });

    expect(duplicatePlan.ok).toBe(false);
    expect(duplicateInvoice.ok).toBe(false);
    expect(duplicatePayment.ok).toBe(false);
    expect(providerEvent.id).toBeTruthy();
    expect(duplicateProviderEvent.ok).toBe(false);

    await attachJson(testInfo, "phase10-duplicate-guards", {
      duplicatePlan,
      duplicateInvoice,
      duplicatePayment,
      providerEvent,
      duplicateProviderEvent
    });
  });

  test("multi-tenant billing isolation blocks cross-gym revenue, invoice, payment, and refund visibility", async ({}, testInfo) => {
    const [gymAdminToken, receptionToken, memberToken] = await Promise.all([
      rawSupabaseSignIn(gymAdminEmail),
      rawSupabaseSignIn(receptionEmail),
      rawSupabaseSignIn(memberEmail)
    ]);

    const [
      adminOwnPayments,
      adminOtherPayments,
      adminOtherInvoices,
      receptionOwnPayments,
      receptionOtherPayments,
      memberOwnSeedPayment,
      memberOtherSeedPayment,
      memberOtherTenantPayment,
      memberOwnPayments
    ] = await Promise.all([
      anonSelect<{ id: string }>(gymAdminToken, "payments", "id", [like("payment_number", `${financial.runId}%`)]),
      anonSelect<{ id: string }>(gymAdminToken, "payments", "id", [eq("id", financial.otherPaymentId)]),
      anonSelect<{ id: string }>(gymAdminToken, "invoices", "id", [eq("id", financial.otherInvoiceId)]),
      anonSelect<{ id: string }>(receptionToken, "payments", "id", [like("payment_number", `${financial.runId}%`)]),
      anonSelect<{ id: string }>(receptionToken, "payments", "id", [eq("id", financial.otherPaymentId)]),
      anonSelect<{ id: string }>(memberToken, "payments", "id", [eq("id", financial.cashPaymentId)]),
      anonSelect<{ id: string }>(memberToken, "payments", "id", [eq("id", financial.upiPartialPaymentId)]),
      anonSelect<{ id: string }>(memberToken, "payments", "id", [eq("id", financial.otherPaymentId)]),
      anonSelect<{ id: string }>(memberToken, "payments", "id")
    ]);

    expect(adminOwnPayments.length).toBeGreaterThanOrEqual(6);
    expect(adminOtherPayments).toEqual([]);
    expect(adminOtherInvoices).toEqual([]);
    expect(receptionOwnPayments.length).toBeGreaterThanOrEqual(6);
    expect(receptionOtherPayments).toEqual([]);
    expect(memberOwnSeedPayment).toHaveLength(1);
    expect(memberOtherSeedPayment).toEqual([]);
    expect(memberOtherTenantPayment).toEqual([]);
    expect(memberOwnPayments.some((payment) => payment.id === financial.cashPaymentId)).toBe(true);

    await attachJson(testInfo, "phase10-billing-isolation", {
      adminOwnPayments: adminOwnPayments.length,
      adminOtherPayments: adminOtherPayments.length,
      adminOtherInvoices: adminOtherInvoices.length,
      receptionOwnPayments: receptionOwnPayments.length,
      receptionOtherPayments: receptionOtherPayments.length,
      memberOwnSeedPayment: memberOwnSeedPayment.length,
      memberOtherSeedPayment: memberOtherSeedPayment.length,
      memberOtherTenantPayment: memberOtherTenantPayment.length,
      memberVisiblePayments: memberOwnPayments.length
    });
  });

  test("financial tampering through authenticated REST is blocked at database policy and integrity layers", async ({}, testInfo) => {
    const [gymAdminToken, receptionToken, memberToken] = await Promise.all([
      rawSupabaseSignIn(gymAdminEmail),
      rawSupabaseSignIn(receptionEmail),
      rawSupabaseSignIn(memberEmail)
    ]);
    const attemptedAt = new Date().toISOString();

    const overpaidInvoice = await anonInsert(gymAdminToken, "invoices", {
      gym_id: financial.gymId,
      member_id: financial.primaryMemberId,
      membership_id: financial.membershipId,
      invoice_number: `${financial.runId}-TAMPER-OVERPAID`,
      status: "paid",
      subtotal_amount: 1000,
      discount_amount: 0,
      tax_amount: 0,
      amount_paid: 9999,
      issued_at: attemptedAt,
      paid_at: attemptedAt,
      created_by: financial.gymAdminUserId
    });
    const crossTenantInvoicePayment = await anonInsert(gymAdminToken, "payments", {
      gym_id: financial.gymId,
      member_id: financial.primaryMemberId,
      membership_id: financial.membershipId,
      invoice_id: financial.otherInvoiceId,
      payment_number: `${financial.runId}-TAMPER-CROSS-INVOICE`,
      payment_type: "membership_purchase",
      status: "paid",
      method: "cash",
      provider: "manual",
      amount: 100,
      paid_at: attemptedAt,
      created_by: financial.gymAdminUserId
    });
    const overInvoicePayment = await anonInsert(gymAdminToken, "payments", {
      gym_id: financial.gymId,
      member_id: financial.primaryMemberId,
      membership_id: financial.membershipId,
      invoice_id: financial.paidInvoiceId,
      payment_number: `${financial.runId}-TAMPER-OVERPAYMENT`,
      payment_type: "membership_purchase",
      status: "paid",
      method: "cash",
      provider: "manual",
      amount: financial.paidInvoiceTotal + 1,
      paid_at: attemptedAt,
      created_by: financial.gymAdminUserId
    });
    const processedRefundBypass = await anonInsert(gymAdminToken, "refunds", {
      gym_id: financial.gymId,
      payment_id: financial.cashPaymentId,
      invoice_id: financial.paidInvoiceId,
      member_id: financial.primaryMemberId,
      amount: financial.paidInvoiceTotal + 1,
      status: "processed",
      reason: "Phase 10 direct processed refund bypass",
      approved_by: financial.gymAdminUserId,
      requested_by: financial.gymAdminUserId,
      processed_at: attemptedAt,
      metadata: { run_id: financial.runId, tamper: true }
    });
    const receptionRefund = await anonInsert(receptionToken, "refunds", {
      gym_id: financial.gymId,
      payment_id: financial.cashPaymentId,
      invoice_id: financial.paidInvoiceId,
      member_id: financial.primaryMemberId,
      amount: 1,
      status: "requested",
      reason: "Phase 10 reception refund bypass",
      requested_by: financial.receptionUserId,
      metadata: { run_id: financial.runId, tamper: true }
    });
    const memberPaymentWrite = await anonInsert(memberToken, "payments", {
      gym_id: financial.gymId,
      member_id: financial.primaryMemberId,
      membership_id: financial.membershipId,
      invoice_id: financial.paidInvoiceId,
      payment_number: `${financial.runId}-TAMPER-MEMBER-PAY`,
      payment_type: "membership_purchase",
      status: "paid",
      method: "cash",
      provider: "manual",
      amount: 1,
      paid_at: attemptedAt
    });

    const attempts = {
      overpaidInvoice,
      crossTenantInvoicePayment,
      overInvoicePayment,
      processedRefundBypass,
      receptionRefund,
      memberPaymentWrite
    };

    await attachJson(testInfo, "phase10-financial-tamper-attempts", attempts);

    expect(Object.values(attempts).every((attempt) => !attempt.ok)).toBe(true);
  });

  test("Razorpay APIs validate malformed, unauthorized, and duplicate-sensitive payment requests", async ({ page }, testInfo) => {
    await loginAs(page, memberEmail, "/member");
    const invalidOrder = await requestTimedPost(page, "invalid-order-payload", "/api/billing/razorpay/orders", { paymentId: "not-a-uuid" });
    const inaccessibleOrder = await requestTimedPost(page, "inaccessible-order", "/api/billing/razorpay/orders", { paymentId: financial.otherPaymentId });
    const invalidVerify = await requestTimedPost(page, "invalid-verify", "/api/billing/razorpay/verify", { orderId: "short", paymentId: "pay_bad", signature: "short" });
    const memberRefund = await requestTimedPost(page, "member-refund-forbidden", "/api/billing/razorpay/refunds", { paymentId: financial.razorpayPaidPaymentId, amount: 1, reason: "Member cannot refund" });

    expect(invalidOrder.status).toBe(400);
    expect(inaccessibleOrder.status).toBe(404);
    expect(invalidVerify.status).toBe(400);
    expect(memberRefund.status).toBe(403);

    await attachJson(testInfo, "phase10-razorpay-api-validation", {
      invalidOrder,
      inaccessibleOrder,
      invalidVerify,
      memberRefund
    });
  });

  test("financial production pages and reporting endpoints load without server crashes", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const audit = setupAudit(page);
    const timings: ApiTiming[] = [];

    await loginAs(page, gymAdminEmail, "/admin");
    for (const route of ["/admin", "/admin/payments", "/admin/membership-plans", "/admin/reports"]) {
      timings.push(await gotoTimed(page, route));
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }
    timings.push(await requestTimed(page, "revenue-csv", "/api/analytics/reports?key=revenue_sources&format=csv"));
    timings.push(await requestTimed(page, "membership-csv", "/api/memberships/reports?format=csv"));
    await page.screenshot({ fullPage: true, path: testInfo.outputPath("phase10-admin-financial-pages.png") });

    await loginAs(page, memberEmail, "/member");
    for (const route of ["/member/membership", "/member/payments"]) {
      timings.push(await gotoTimed(page, route));
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }
    await page.screenshot({ fullPage: true, path: testInfo.outputPath("phase10-member-financial-pages.png") });

    for (const timing of timings) {
      expect(timing.status, `${timing.name} status`).toBeLessThan(500);
    }
    await attachJson(testInfo, "phase10-financial-performance", {
      timings,
      targets: {
        paymentProcessing: "< 2000ms",
        invoiceGeneration: "< 1000ms",
        reports: "< 5000ms",
        financialPageLoad: "< 2000ms target where production cold starts allow"
      }
    });
    await expectNoClientCrashes(audit);
  });
});

function setupAudit(page: Page) {
  const audit: AuditLog = {
    console: [],
    pageErrors: [],
    network: []
  };

  page.on("console", (message) => {
    audit.console.push({
      type: message.type(),
      text: message.text(),
      location: message.location()
    });
  });

  page.on("pageerror", (error) => {
    audit.pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      audit.network.push({
        status: response.status(),
        method: response.request().method(),
        url: response.url()
      });
    }
  });

  return audit;
}

function clientErrors(audit: AuditLog) {
  return audit.console
    .filter((entry) => entry.type === "error")
    .map((entry) => entry.text)
    .filter((text) => !text.includes("Failed to load resource: the server responded with a status of 403"));
}

async function expectNoClientCrashes(audit: AuditLog) {
  expect(clientErrors(audit)).toEqual([]);
  expect(audit.pageErrors).toEqual([]);
  expect(audit.network).toEqual([]);
}

async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json"
  });
}

async function currentPath(page: Page) {
  return new URL(page.url()).pathname;
}

async function expectPath(page: Page, path: string) {
  await expect.poll(() => currentPath(page), { timeout: 30_000 }).toBe(path);
}

async function loginAs(page: Page, email: string, expectedPath: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(signInButton).toBeEnabled({ timeout: 10_000 });
  await signInButton.click();
  await expectPath(page, expectedPath);
}

async function gotoTimed(page: Page, route: string): Promise<ApiTiming> {
  const startedAt = performance.now();
  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((error: Error) => {
    if (!error.message.includes("ERR_ABORTED") && !error.message.includes("frame was detached")) {
      throw error;
    }
    return null;
  });

  return {
    name: route,
    route,
    status: response?.status() ?? null,
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function requestTimed(page: Page, name: string, route: string): Promise<ApiTiming> {
  const startedAt = performance.now();
  const response = await page.request.get(route, { timeout: 60_000 });

  return {
    name,
    route,
    status: response.status(),
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function requestTimedPost(page: Page, name: string, route: string, data: Record<string, unknown>): Promise<ApiTiming> {
  const startedAt = performance.now();
  const response = await page.request.post(route, { data, timeout: 60_000 });

  return {
    name,
    route,
    status: response.status(),
    durationMs: Math.round(performance.now() - startedAt)
  };
}

async function rawSupabaseSignIn(email: string) {
  const response = await fetchWithRetry(`${publicSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publicSupabaseAnonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || `Supabase auth failed with ${response.status}`);
  }

  return payload.access_token as string;
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

async function serviceSelect<T>(table: string, select: string, filters: string[] = []) {
  const query = [`select=${encodeURIComponent(select)}`, ...filters].join("&");
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}?${query}`, { method: "GET" });
  return payload;
}

async function serviceInsert<T>(table: string, body: Record<string, unknown>) {
  const { payload } = await restRequest<T[]>(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return requireRow(payload, `insert ${table}`);
}

async function serviceInsertExpectFailure(table: string, body: Record<string, unknown>) {
  const response = await restRequest<unknown>(`/rest/v1/${table}`, {
    method: "POST",
    expectFailure: true,
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });

  return {
    ok: response.ok,
    status: response.status,
    payload: response.payload
  };
}

async function serviceDelete(table: string, filters: string[]) {
  return restRequest<unknown>(`/rest/v1/${table}?${filters.join("&")}`, {
    method: "DELETE",
    expectFailure: true
  });
}

async function anonSelect<T>(token: string, table: string, select: string, filters: string[] = []) {
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
    payload: payload as T[] | { message?: string; code?: string }
  };
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

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

function eq(column: string, value: string) {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function like(column: string, value: string) {
  return `${column}=like.${encodeURIComponent(value)}`;
}

function inList(column: string, values: string[]) {
  return `${column}=in.(${values.map((value) => `"${value}"`).join(",")})`;
}

function limit(count: number) {
  return `limit=${count}`;
}

function today(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isoPlusHours(hours: number) {
  const date = new Date();
  date.setUTCHours(date.getUTCHours() + hours, 0, 0, 0);
  return date.toISOString();
}

function requireRow<T>(rows: T[], label: string) {
  const row = rows[0];
  if (!row) {
    throw new Error(`Supabase returned no row for ${label}.`);
  }
  return row;
}

async function getSingle<T>(table: string, select: string, filters: string[], label: string) {
  const rows = await serviceSelect<T>(table, select, [...filters, limit(1)]);
  if (!rows[0]) {
    throw new Error(`Missing required ${label}.`);
  }
  return rows[0];
}

async function getProfileByEmail(email: string) {
  return getSingle<ProfileRow>("profiles", "id,email,full_name,gym_id", [eq("email", email)], `profile ${email}`);
}

async function seedFinancialAudit(): Promise<FinancialSeed> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.replace(/[^a-z0-9-]/g, "-");
  const runId = `F10-${suffix}`;
  const gymAdmin = await getProfileByEmail(gymAdminEmail);
  const reception = await getProfileByEmail(receptionEmail);
  const memberProfile = await getProfileByEmail(memberEmail);
  const gymId = gymAdmin.gym_id;

  if (!gymId) {
    throw new Error("QA Gym Admin is not linked to a gym.");
  }

  await getSingle<GymRow>("gyms", "id,name,slug,status", [eq("id", gymId)], "QA gym");
  const otherGym = await serviceInsert<GymRow>("gyms", {
    name: `${runId} Billing Isolation Gym`,
    slug: `f10-isolation-${suffix}`,
    timezone: "Asia/Kolkata",
    currency: "INR",
    status: "active"
  });
  const otherOrg = await serviceInsert<{ id: string }>("organizations", {
    name: `${runId} Billing Isolation Organization`,
    slug: `f10-isolation-org-${suffix}`,
    organization_type: "single_gym",
    status: "active",
    billing_email: `billing-${suffix}@example.com`,
    created_by: gymAdmin.id
  });
  const otherBranch = await serviceInsert<BranchRow>("branches", {
    organization_id: otherOrg.id,
    gym_id: otherGym.id,
    name: `${runId} Billing Isolation Branch`,
    slug: `f10-isolation-branch-${suffix}`,
    branch_code: `F10${suffix.slice(-6).toUpperCase()}`,
    status: "active",
    city: "Pune",
    state: "Maharashtra",
    phone: "9300000000",
    email: `branch-${suffix}@example.com`
  });

  const [basicPlan, premiumPlan, annualPlan, archivedPlan] = await Promise.all([
    createPlan(runId, suffix, gymId, "basic", "monthly", 30, 3000, "active", gymAdmin.id),
    createPlan(runId, suffix, gymId, "premium", "monthly", 30, 5000, "active", gymAdmin.id),
    createPlan(runId, suffix, gymId, "annual", "annual", 365, 45000, "active", gymAdmin.id),
    createPlan(runId, suffix, gymId, "archived", "custom", 45, 2500, "archived", gymAdmin.id)
  ]);
  const otherPlan = await createPlan(runId, suffix, otherGym.id, "other", "monthly", 30, 2500, "active", gymAdmin.id);

  const [primaryMember, partialMember, frozenMember, expiredMember, cancelledMember, otherTenantMember] = await Promise.all([
    createMember(runId, suffix, gymId, memberProfile.id, gymAdmin.id, "Primary"),
    createMember(runId, suffix, gymId, null, gymAdmin.id, "Partial"),
    createMember(runId, suffix, gymId, null, gymAdmin.id, "Frozen"),
    createMember(runId, suffix, gymId, null, gymAdmin.id, "Expired"),
    createMember(runId, suffix, gymId, null, gymAdmin.id, "Cancelled"),
    createMember(runId, suffix, otherGym.id, null, gymAdmin.id, "OtherTenant")
  ]);

  const membership = await createMembership(runId, gymId, primaryMember.id, basicPlan.id, "active", today(-5), today(25), 3000, "paid", gymAdmin.id, `${runId}-MEM-ACTIVE`);
  const partialMembership = await createMembership(runId, gymId, partialMember.id, premiumPlan.id, "active", today(-3), today(27), 5000, "partially_paid", gymAdmin.id, `${runId}-MEM-PARTIAL`);
  const frozenMembership = await createMembership(runId, gymId, frozenMember.id, basicPlan.id, "frozen", today(-10), today(20), 3000, "paid", gymAdmin.id, `${runId}-MEM-FROZEN`, { frozen_at: new Date().toISOString() });
  const expiredMembership = await createMembership(runId, gymId, expiredMember.id, basicPlan.id, "expired", today(-40), today(-1), 3000, "paid", gymAdmin.id, `${runId}-MEM-EXPIRED`);
  const cancelledMembership = await createMembership(runId, gymId, cancelledMember.id, basicPlan.id, "cancelled", today(-20), today(10), 3000, "paid", gymAdmin.id, `${runId}-MEM-CANCELLED`, { cancelled_at: new Date().toISOString() });
  const otherMembership = await createMembership(runId, otherGym.id, otherTenantMember.id, otherPlan.id, "active", today(-1), today(29), 2500, "paid", gymAdmin.id, `${runId}-MEM-OTHER`);

  const paidInvoice = await createInvoice(runId, gymId, primaryMember.id, membership.id, `${runId}-INV-PAID`, "paid", 3000, 300, 486, 3186, gymAdmin.id);
  const partialInvoice = await createInvoice(runId, gymId, partialMember.id, partialMembership.id, `${runId}-INV-PARTIAL`, "partially_paid", 5000, 0, 900, 2000, gymAdmin.id);
  const onlineInvoice = await createInvoice(runId, gymId, primaryMember.id, membership.id, `${runId}-INV-ONLINE`, "issued", 3000, 0, 540, 0, gymAdmin.id);
  const razorpayInvoice = await createInvoice(runId, gymId, primaryMember.id, membership.id, `${runId}-INV-RAZORPAY`, "paid", 4500, 0, 810, 5310, gymAdmin.id);
  const otherInvoice = await createInvoice(runId, otherGym.id, otherTenantMember.id, otherMembership.id, `${runId}-INV-OTHER`, "paid", 2500, 0, 450, 2950, gymAdmin.id);

  await Promise.all([
    createInvoiceItem(runId, paidInvoice.id, "membership", 3000, 300, 486),
    createInvoiceItem(runId, partialInvoice.id, "membership", 5000, 0, 900),
    createInvoiceItem(runId, onlineInvoice.id, "membership", 3000, 0, 540),
    createInvoiceItem(runId, razorpayInvoice.id, "personal_training", 4500, 0, 810),
    createInvoiceItem(runId, otherInvoice.id, "membership", 2500, 0, 450)
  ]);

  const cashPayment = await createPayment(runId, gymId, primaryMember.id, membership.id, paidInvoice.id, `${runId}-PAY-CASH`, "membership_purchase", "paid", "cash", "manual", 3186, reception.id, {
    receipt_number: `${runId}-RCPT-CASH`,
    paid_at: new Date().toISOString(),
    collected_at: new Date().toISOString()
  });
  const upiPartialPayment = await createPayment(runId, gymId, partialMember.id, partialMembership.id, partialInvoice.id, `${runId}-PAY-UPI-PARTIAL`, "membership_purchase", "paid", "upi", "manual", 2000, reception.id, {
    receipt_number: `${runId}-RCPT-UPI`,
    paid_at: new Date().toISOString(),
    collected_at: new Date().toISOString()
  });
  const upiFailedPayment = await createPayment(runId, gymId, partialMember.id, partialMembership.id, partialInvoice.id, `${runId}-PAY-UPI-FAILED`, "membership_purchase", "failed", "upi", "manual", 3900, reception.id, {
    failed_at: new Date().toISOString(),
    failure_reason: "Phase 10 failed UPI simulation"
  });
  const cardFailedPayment = await createPayment(runId, gymId, primaryMember.id, membership.id, onlineInvoice.id, `${runId}-PAY-CARD-FAILED`, "membership_renewal", "failed", "credit_card", "razorpay", 3540, memberProfile.id, {
    provider_order_id: `${runId}-ORDER-CARD-FAILED`,
    provider_payment_id: `${runId}-PAYMENT-CARD-FAILED`,
    failed_at: new Date().toISOString(),
    failure_reason: "Phase 10 card decline simulation"
  });
  const onlinePendingPayment = await createPayment(runId, gymId, primaryMember.id, membership.id, onlineInvoice.id, `${runId}-PAY-ONLINE-PENDING`, "membership_renewal", "pending", "razorpay", "razorpay", 3540, memberProfile.id, {
    provider_order_id: `${runId}-ORDER-PENDING`
  });
  const razorpayPaidPayment = await createPayment(runId, gymId, primaryMember.id, membership.id, razorpayInvoice.id, `${runId}-PAY-RAZORPAY-PAID`, "personal_training", "partially_refunded", "razorpay", "razorpay", 5310, memberProfile.id, {
    provider_order_id: `${runId}-ORDER-PAID`,
    provider_payment_id: `${runId}-PROVIDER-PAID`,
    provider_signature: `${runId}-SIGNATURE`,
    receipt_number: `${runId}-RCPT-RAZORPAY`,
    paid_at: new Date().toISOString(),
    collected_at: new Date().toISOString()
  });
  const otherPayment = await createPayment(runId, otherGym.id, otherTenantMember.id, otherMembership.id, otherInvoice.id, `${runId}-PAY-OTHER`, "membership_purchase", "paid", "cash", "manual", 2950, reception.id, {
    receipt_number: `${runId}-RCPT-OTHER`,
    paid_at: new Date().toISOString(),
    collected_at: new Date().toISOString()
  });

  await Promise.all([
    serviceInsert("payment_attempts", {
      gym_id: gymId,
      payment_id: onlinePendingPayment.id,
      invoice_id: onlineInvoice.id,
      provider: "razorpay",
      provider_order_id: `${runId}-ORDER-PENDING`,
      status: "created",
      amount: 3540,
      request_payload: { run_id: runId },
      response_payload: { status: "created" }
    }),
    serviceInsert("payment_attempts", {
      gym_id: gymId,
      payment_id: cardFailedPayment.id,
      invoice_id: onlineInvoice.id,
      provider: "razorpay",
      provider_order_id: `${runId}-ORDER-CARD-FAILED`,
      provider_payment_id: `${runId}-PAYMENT-CARD-FAILED`,
      status: "failed",
      amount: 3540,
      error_code: "card_declined",
      error_description: "Phase 10 card declined",
      request_payload: { run_id: runId },
      response_payload: { status: "failed" }
    })
  ]);

  const processedRefund = await serviceInsert<RefundRow>("refunds", {
    gym_id: gymId,
    payment_id: razorpayPaidPayment.id,
    invoice_id: razorpayInvoice.id,
    member_id: primaryMember.id,
    amount: 500,
    status: "processed",
    reason: "Phase 10 processed refund simulation",
    provider_refund_id: `rfnd_${suffix.replace(/-/g, "")}`,
    approved_by: gymAdmin.id,
    requested_by: gymAdmin.id,
    processed_at: new Date().toISOString(),
    metadata: { run_id: runId }
  });
  const requestedRefund = await serviceInsert<RefundRow>("refunds", {
    gym_id: gymId,
    payment_id: cashPayment.id,
    invoice_id: paidInvoice.id,
    member_id: primaryMember.id,
    amount: 250,
    status: "requested",
    reason: "Phase 10 requested cash refund simulation",
    requested_by: reception.id,
    metadata: { run_id: runId }
  });

  await seedFinancialEvents(runId, gymId, primaryMember.id, membership.id, paidInvoice.id, cashPayment.id, processedRefund.id, reception.id);
  await seedLifecycleHistory(runId, gymId, {
    membershipId: membership.id,
    memberId: primaryMember.id,
    basicPlanId: basicPlan.id,
    premiumPlanId: premiumPlan.id,
    annualPlanId: annualPlan.id,
    frozenMembershipId: frozenMembership.id,
    frozenMemberId: frozenMember.id,
    expiredMembershipId: expiredMembership.id,
    expiredMemberId: expiredMember.id,
    cancelledMembershipId: cancelledMembership.id,
    cancelledMemberId: cancelledMember.id,
    actorId: gymAdmin.id
  });

  return {
    runId,
    suffix,
    gymId,
    gymAdminUserId: gymAdmin.id,
    receptionUserId: reception.id,
    memberUserId: memberProfile.id,
    otherGymId: otherGym.id,
    otherOrganizationId: otherOrg.id,
    otherBranchId: otherBranch.id,
    primaryMemberId: primaryMember.id,
    partialMemberId: partialMember.id,
    frozenMemberId: frozenMember.id,
    expiredMemberId: expiredMember.id,
    cancelledMemberId: cancelledMember.id,
    otherTenantMemberId: otherTenantMember.id,
    basicPlanId: basicPlan.id,
    premiumPlanId: premiumPlan.id,
    annualPlanId: annualPlan.id,
    archivedPlanId: archivedPlan.id,
    membershipId: membership.id,
    partialMembershipId: partialMembership.id,
    frozenMembershipId: frozenMembership.id,
    expiredMembershipId: expiredMembership.id,
    cancelledMembershipId: cancelledMembership.id,
    otherMembershipId: otherMembership.id,
    paidInvoiceId: paidInvoice.id,
    paidInvoiceTotal: 3186,
    partialInvoiceId: partialInvoice.id,
    partialInvoiceTotal: 5900,
    onlineInvoiceId: onlineInvoice.id,
    razorpayInvoiceId: razorpayInvoice.id,
    otherInvoiceId: otherInvoice.id,
    cashPaymentId: cashPayment.id,
    upiPartialPaymentId: upiPartialPayment.id,
    upiFailedPaymentId: upiFailedPayment.id,
    cardFailedPaymentId: cardFailedPayment.id,
    onlinePendingPaymentId: onlinePendingPayment.id,
    razorpayPaidPaymentId: razorpayPaidPayment.id,
    otherPaymentId: otherPayment.id,
    processedRefundId: processedRefund.id,
    requestedRefundId: requestedRefund.id
  };
}

async function createPlan(runId: string, suffix: string, gymId: string, label: string, planType: string, durationDays: number, priceAmount: number, status: string, actorId: string) {
  return serviceInsert<PlanRow>("membership_plans", {
    gym_id: gymId,
    name: `${runId} ${label} Plan`,
    slug: `f10-${suffix}-${label}`,
    description: `Phase 10 ${label} membership plan for financial audit coverage.`,
    plan_type: planType,
    duration_days: durationDays,
    price_amount: priceAmount,
    joining_fee_amount: 0,
    currency: "INR",
    access_level: label === "premium" || label === "annual" ? "premium" : "standard",
    features: [`${label} access`, "Financial audit coverage"],
    status,
    is_public: status === "active",
    created_by: actorId
  });
}

async function createMember(runId: string, suffix: string, gymId: string, userId: string | null, actorId: string, label: string) {
  return serviceInsert<{ id: string }>("members", {
    gym_id: gymId,
    user_id: userId,
    member_code: `${runId}-${label.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)}`,
    full_name: `${runId} ${label} Member`,
    email: `${label.toLowerCase()}-${suffix}@example.com`,
    phone: `94${Math.floor(10000000 + Math.random() * 89999999)}`,
    status: "active",
    joined_at: today(-5),
    created_by: actorId,
    notes: runId,
    metadata: { run_id: runId }
  });
}

async function createMembership(
  runId: string,
  gymId: string,
  memberId: string,
  planId: string,
  status: string,
  startDate: string,
  endDate: string,
  priceAmount: number,
  paymentStatus: string,
  actorId: string,
  invoiceNumber: string,
  extra: Record<string, unknown> = {}
) {
  return serviceInsert<{ id: string }>("memberships", {
    gym_id: gymId,
    member_id: memberId,
    membership_plan_id: planId,
    status,
    start_date: startDate,
    end_date: endDate,
    activated_at: status === "active" ? new Date().toISOString() : null,
    source: "manual",
    price_amount: priceAmount,
    joining_fee_amount: 0,
    discount_amount: 0,
    invoice_number: invoiceNumber,
    payment_status: paymentStatus,
    notes: runId,
    created_by: actorId,
    updated_by: actorId,
    ...extra
  });
}

async function createInvoice(
  runId: string,
  gymId: string,
  memberId: string,
  membershipId: string,
  invoiceNumber: string,
  status: string,
  subtotal: number,
  discount: number,
  tax: number,
  paid: number,
  actorId: string
) {
  return serviceInsert<InvoiceRow>("invoices", {
    gym_id: gymId,
    member_id: memberId,
    membership_id: membershipId,
    invoice_number: invoiceNumber,
    status,
    currency: "INR",
    subtotal_amount: subtotal,
    discount_amount: discount,
    tax_amount: tax,
    amount_paid: paid,
    issued_at: new Date().toISOString(),
    paid_at: paid > 0 && status === "paid" ? new Date().toISOString() : null,
    notes: runId,
    created_by: actorId
  });
}

async function createInvoiceItem(runId: string, invoiceId: string, itemType: string, unitAmount: number, discountAmount: number, taxAmount: number) {
  return serviceInsert("invoice_items", {
    invoice_id: invoiceId,
    item_type: itemType,
    description: `${runId} ${itemType} invoice item`,
    quantity: 1,
    unit_amount: unitAmount,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    metadata: { run_id: runId }
  });
}

async function createPayment(
  runId: string,
  gymId: string,
  memberId: string,
  membershipId: string,
  invoiceId: string,
  paymentNumber: string,
  paymentType: string,
  status: string,
  method: string,
  provider: string,
  amount: number,
  actorId: string,
  extra: Record<string, unknown> = {}
) {
  return serviceInsert<PaymentRow>("payments", {
    gym_id: gymId,
    member_id: memberId,
    membership_id: membershipId,
    invoice_id: invoiceId,
    payment_number: paymentNumber,
    payment_type: paymentType,
    status,
    method,
    provider,
    amount,
    currency: "INR",
    discount_amount: 0,
    tax_amount: 0,
    metadata: { run_id: runId },
    created_by: actorId,
    ...extra
  });
}

async function seedFinancialEvents(
  runId: string,
  gymId: string,
  memberId: string,
  membershipId: string,
  invoiceId: string,
  paymentId: string,
  refundId: string,
  actorId: string
) {
  await Promise.all([
    serviceInsert("transactions", {
      gym_id: gymId,
      member_id: memberId,
      invoice_id: invoiceId,
      transaction_type: "invoice_created",
      direction: "debit",
      amount: 3186,
      currency: "INR",
      description: "Phase 10 invoice generated",
      metadata: { run_id: runId, membershipId },
      created_by: actorId
    }),
    serviceInsert("transactions", {
      gym_id: gymId,
      member_id: memberId,
      invoice_id: invoiceId,
      payment_id: paymentId,
      transaction_type: "payment_collected",
      direction: "credit",
      amount: 3186,
      currency: "INR",
      description: "Phase 10 payment collected",
      metadata: { run_id: runId, membershipId },
      created_by: actorId
    }),
    serviceInsert("transactions", {
      gym_id: gymId,
      member_id: memberId,
      invoice_id: invoiceId,
      payment_id: paymentId,
      refund_id: refundId,
      transaction_type: "refund_processed",
      direction: "debit",
      amount: 500,
      currency: "INR",
      description: "Phase 10 refund processed",
      metadata: { run_id: runId },
      created_by: actorId
    }),
    serviceInsert("transactions", {
      gym_id: gymId,
      member_id: memberId,
      transaction_type: "discount_applied",
      direction: "none",
      amount: 300,
      currency: "INR",
      description: "Phase 10 discount applied",
      metadata: { run_id: runId },
      created_by: actorId
    }),
    serviceInsert("billing_events", {
      gym_id: gymId,
      event_type: "invoice_generated",
      entity_type: "invoice",
      entity_id: invoiceId,
      status: "recorded",
      metadata: { run_id: runId }
    }),
    serviceInsert("billing_events", {
      gym_id: gymId,
      event_type: "payment_completed",
      entity_type: "payment",
      entity_id: paymentId,
      status: "recorded",
      metadata: { run_id: runId }
    }),
    serviceInsert("billing_events", {
      gym_id: gymId,
      event_type: "refund_issued",
      entity_type: "refund",
      entity_id: refundId,
      status: "recorded",
      metadata: { run_id: runId }
    }),
    serviceInsert("billing_events", {
      gym_id: gymId,
      event_type: "membership_renewed",
      entity_type: "membership",
      entity_id: membershipId,
      status: "recorded",
      metadata: { run_id: runId }
    }),
    serviceInsert("discounts", {
      gym_id: gymId,
      name: `${runId} Launch Discount`,
      description: "Phase 10 discount validation.",
      discount_type: "fixed",
      value_amount: 300,
      status: "active",
      created_by: actorId
    }),
    serviceInsert("coupons", {
      gym_id: gymId,
      code: `${runId}-COUPON`,
      name: `${runId} Coupon`,
      discount_type: "percentage",
      value_amount: 10,
      minimum_amount: 1000,
      usage_limit: 10,
      status: "active",
      created_by: actorId
    }),
    serviceInsert("membership_notification_events", {
      gym_id: gymId,
      membership_id: membershipId,
      member_id: memberId,
      event_type: "renewal_reminder",
      channel: "email",
      status: "queued",
      scheduled_for: isoPlusHours(48),
      metadata: { run_id: runId }
    }),
    serviceInsert("membership_notification_events", {
      gym_id: gymId,
      membership_id: membershipId,
      member_id: memberId,
      event_type: "expiry_reminder",
      channel: "push",
      status: "sent",
      metadata: { run_id: runId }
    })
  ]);
}

async function seedLifecycleHistory(
  runId: string,
  gymId: string,
  ids: {
    membershipId: string;
    memberId: string;
    basicPlanId: string;
    premiumPlanId: string;
    annualPlanId: string;
    frozenMembershipId: string;
    frozenMemberId: string;
    expiredMembershipId: string;
    expiredMemberId: string;
    cancelledMembershipId: string;
    cancelledMemberId: string;
    actorId: string;
  }
) {
  await Promise.all([
    serviceInsert("membership_history", {
      gym_id: gymId,
      membership_id: ids.membershipId,
      member_id: ids.memberId,
      event: "upgraded",
      from_plan_id: ids.basicPlanId,
      to_plan_id: ids.premiumPlanId,
      from_status: "active",
      to_status: "active",
      previous_start_date: today(-5),
      previous_end_date: today(25),
      new_start_date: today(-5),
      new_end_date: today(25),
      reason: "Phase 10 upgrade validation; proration invoice coverage reviewed separately.",
      metadata: { run_id: runId, expected_proration_invoice: true },
      created_by: ids.actorId
    }),
    serviceInsert("membership_history", {
      gym_id: gymId,
      membership_id: ids.membershipId,
      member_id: ids.memberId,
      event: "downgraded",
      from_plan_id: ids.annualPlanId,
      to_plan_id: ids.basicPlanId,
      from_status: "active",
      to_status: "active",
      reason: "Phase 10 downgrade validation.",
      metadata: { run_id: runId },
      created_by: ids.actorId
    }),
    serviceInsert("membership_history", {
      gym_id: gymId,
      membership_id: ids.frozenMembershipId,
      member_id: ids.frozenMemberId,
      event: "frozen",
      to_status: "frozen",
      reason: "Phase 10 freeze validation.",
      metadata: { run_id: runId, attendance_blocked: true },
      created_by: ids.actorId
    }),
    serviceInsert("membership_history", {
      gym_id: gymId,
      membership_id: ids.expiredMembershipId,
      member_id: ids.expiredMemberId,
      event: "expired",
      to_status: "expired",
      reason: "Phase 10 expiry validation.",
      metadata: { run_id: runId, attendance_blocked: true },
      created_by: ids.actorId
    }),
    serviceInsert("membership_history", {
      gym_id: gymId,
      membership_id: ids.cancelledMembershipId,
      member_id: ids.cancelledMemberId,
      event: "cancelled",
      to_status: "cancelled",
      reason: "Phase 10 cancellation validation.",
      metadata: { run_id: runId, access_revoked: true },
      created_by: ids.actorId
    }),
    serviceInsert("membership_status_logs", {
      gym_id: gymId,
      membership_id: ids.frozenMembershipId,
      member_id: ids.frozenMemberId,
      from_status: "active",
      to_status: "frozen",
      reason: "Phase 10 freeze validation.",
      created_by: ids.actorId
    }),
    serviceInsert("membership_status_logs", {
      gym_id: gymId,
      membership_id: ids.cancelledMembershipId,
      member_id: ids.cancelledMemberId,
      from_status: "active",
      to_status: "cancelled",
      reason: "Phase 10 cancellation validation.",
      created_by: ids.actorId
    })
  ]);
}

async function cleanupFinancialAudit(financial: FinancialSeed) {
  await Promise.allSettled([
    serviceDelete("payment_provider_events", [like("event_id", `${financial.runId}%`)]),
    serviceDelete("members", [like("member_code", `${financial.runId}%`)]),
    serviceDelete("coupons", [like("code", `${financial.runId}%`)]),
    serviceDelete("discounts", [like("name", `${financial.runId}%`)])
  ]);
  await serviceDelete("membership_plans", [like("slug", `f10-${financial.suffix}%`)]);
  await serviceDelete("branches", [eq("id", financial.otherBranchId)]);
  await serviceDelete("organizations", [eq("id", financial.otherOrganizationId)]);
  await serviceDelete("gyms", [eq("id", financial.otherGymId)]);
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
