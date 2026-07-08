import type { DbClient } from "./db-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRazorpayOrder } from "../razorpay/razorpay-service";


function getDb(supabase: unknown): DbClient { return supabase as never as DbClient; }

export type UsageSnapshot = {
  organizationId: string;
  subscriptionId: string;
  packageId: string;
  currentMembers: number;
  maxMembers: number;
  currentBranches: number;
  maxBranches: number;
  membersOverLimit: boolean;
  branchesOverLimit: boolean;
  snapshotDate: string;
};

const OVERAGE_UNIT_PRICES: Record<string, { member: number; branch: number }> = {
  starter: { member: 5000, branch: 50000 },
  growth: { member: 3000, branch: 30000 },
  professional: { member: 2000, branch: 20000 },
  enterprise: { member: 1000, branch: 10000 },
};

export async function takeUsageSnapshot(): Promise<{ snapshotCount: number; overLimitCount: number; errors: string[] }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { snapshotCount: 0, overLimitCount: 0, errors: ["Admin client unavailable"] };
  const db = getDb(admin);
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const { data: subs } = await db.from("organization_subscriptions").select("*").eq("status", ["active", "trial"]);
  const { data: pkgs } = await db.from("packages").select("*").in("id", [...new Set((subs ?? []).map((s) => (s as Record<string, unknown>).package_id as string))]);

  const pkgMap = new Map<string, { max_members: number; max_branches: number; name: string }>();
  for (const p of pkgs ?? []) {
    pkgMap.set(p.id as string, {
      max_members: (p.max_members as number) ?? -1,
      max_branches: (p.max_branches as number) ?? -1,
      name: (p.name as string) ?? "unknown",
    });
  }

  let snapshotCount = 0;
  let overLimitCount = 0;

  for (const sub of subs ?? []) {
    try {
      const orgId = sub.organization_id as string;
      const pkgId = sub.package_id as string;
      const pkg = pkgMap.get(pkgId);
      if (!pkg) continue;

      const maxMembers = pkg.max_members;
      const maxBranches = pkg.max_branches;

      const rawProf = admin as never as {
        from(t: string): {
          select(c: string, o: { count: string; head: boolean }): {
            eq(c: string, v: string): Promise<{ count: number | null; error: { message: string } | null }>;
          };
        };
      };
      const { count: memberCount } = await rawProf.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", orgId);

      const rawGym = admin as never as {
        from(t: string): {
          select(c: string, o: { count: string; head: boolean }): {
            eq(c: string, v: string): { eq(c2: string, v2: string): Promise<{ count: number | null; error: { message: string } | null }> };
          };
        };
      };
      const { count: branchCount } = await rawGym.from("gyms").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active");

      const currentMembers = memberCount ?? 0;
      const currentBranches = branchCount ?? 0;
      const membersOver = maxMembers !== -1 && currentMembers > maxMembers;
      const branchesOver = maxBranches !== -1 && currentBranches > maxBranches;

      const raw = db.from("subscription_usage_snapshots");
      await raw.insert({
        organization_id: orgId,
        subscription_id: sub.id,
        package_id: pkgId,
        snapshot_date: today,
        current_members: currentMembers,
        max_members: maxMembers,
        current_branches: currentBranches,
        max_branches: maxBranches,
        members_over_limit: membersOver,
        branches_over_limit: branchesOver,
        overage_member_count: membersOver ? currentMembers - maxMembers : 0,
        overage_branch_count: branchesOver ? currentBranches - maxBranches : 0,
      });

      snapshotCount++;
      if (membersOver || branchesOver) overLimitCount++;
    } catch (err) {
      errors.push(`Sub ${sub.id as string}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return { snapshotCount, overLimitCount, errors };
}

export async function calculateOverageCharges(subscriptionId: string): Promise<{
  hasOverage: boolean;
  memberOverage: number;
  branchOverage: number;
  memberCharge: number;
  branchCharge: number;
  totalCharge: number;
  details: string[];
}> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { hasOverage: false, memberOverage: 0, branchOverage: 0, memberCharge: 0, branchCharge: 0, totalCharge: 0, details: [] };
  const db = getDb(admin);

  const { data: sub } = await db.from("organization_subscriptions").select("*").eq("id", subscriptionId).single();
  if (!sub) return { hasOverage: false, memberOverage: 0, branchOverage: 0, memberCharge: 0, branchCharge: 0, totalCharge: 0, details: [] };

  const orgId = sub.organization_id as string;
  const pkgId = sub.package_id as string;
  const { data: pkg } = await db.from("packages").select("*").eq("id", pkgId).single();
  if (!pkg) return { hasOverage: false, memberOverage: 0, branchOverage: 0, memberCharge: 0, branchCharge: 0, totalCharge: 0, details: [] };

  const maxMembers = (pkg.max_members as number) ?? -1;
  const maxBranches = (pkg.max_branches as number) ?? -1;
  const pkgName = (pkg.name as string)?.toLowerCase() ?? "enterprise";

  const raw = admin as never as {
    from(t: string): {
      select(c: string, o: { count: "exact"; head: true }): {
        eq(c: string, v: string): Promise<{ count: number | null; error: { message: string } | null }>;
      };
    };
  };

  const { count: memberCount } = await raw.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  const currentMembers = memberCount ?? 0;

  const rawGym = admin as never as {
    from(t: string): {
      select(c: string, o: { count: "exact"; head: true }): {
        eq(c: string, v: string): { eq(c2: string, v2: string): Promise<{ count: number | null; error: { message: string } | null }> };
      };
    };
  };
  const { count: branchCount } = await rawGym.from("gyms").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active");
  const currentBranches = branchCount ?? 0;

  const unitPrices = (OVERAGE_UNIT_PRICES[pkgName] ?? OVERAGE_UNIT_PRICES.enterprise)!;
  const details: string[] = [];

  const memberOverage = maxMembers !== -1 ? Math.max(0, currentMembers - maxMembers) : 0;
  const memberCharge = memberOverage * unitPrices.member;
  if (memberOverage > 0) details.push(`${memberOverage} extra member(s) × ₹${unitPrices.member} = ₹${memberCharge}`);

  const branchOverage = maxBranches !== -1 ? Math.max(0, currentBranches - maxBranches) : 0;
  const branchCharge = branchOverage * unitPrices.branch;
  if (branchOverage > 0) details.push(`${branchOverage} extra branch(es) × ₹${unitPrices.branch} = ₹${branchCharge}`);

  const totalCharge = memberCharge + branchCharge;

  return {
    hasOverage: totalCharge > 0,
    memberOverage, branchOverage, memberCharge, branchCharge, totalCharge, details,
  };
}

export async function generateOverageInvoice(subscriptionId: string): Promise<{ ok: boolean; message: string; invoiceId?: string }> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, message: "Admin client unavailable" };
  const db = getDb(admin);

  const { data: sub } = await db.from("organization_subscriptions").select("*").eq("id", subscriptionId).single();
  if (!sub) return { ok: false, message: "Subscription not found." };

  const overage = await calculateOverageCharges(subscriptionId);
  if (!overage.hasOverage) return { ok: false, message: "No overage charges to invoice." };

  const year = new Date().getFullYear();
  const ts = String(Date.now()).slice(-6);
  const invoiceNumber = `OVG-INV-${year}-${ts}`;

  const invoicePayload: Record<string, unknown> = {
    organization_id: sub.organization_id as string,
    subscription_id: subscriptionId,
    invoice_number: invoiceNumber,
    status: "issued",
    currency: "INR",
    subtotal_amount: overage.totalCharge,
    discount_amount: 0,
    tax_amount: 0,
    billing_period_start: new Date().toISOString().slice(0, 10),
    billing_period_end: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    issued_at: new Date().toISOString(),
    due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    notes: `Overage charges: ${overage.details.join("; ")}`,
  };

  const { data: invoice } = await db.from("org_subscription_invoices").insert(invoicePayload);
  if (!invoice) return { ok: false, message: "Failed to create overage invoice." };

  return { ok: true, message: `Overage invoice ${invoiceNumber} created for ₹${(overage.totalCharge / 100).toFixed(2)}.`, invoiceId: invoice.id as string };
}
