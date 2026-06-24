"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { AuthActionState } from "@/features/auth/actions/action-state";
import { getOrgOwnerContext, revalidateOrgModules, auditOrgAction } from "./action-utils";
import { requireOrganizationFeatureAccess, entitlementActionCatch } from "@/features/entitlement";

type CorporateAccount = Database["public"]["Tables"]["corporate_accounts"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];

function gate(organizationId: string, actionName: string) {
  return requireOrganizationFeatureAccess({ organizationId, featureKey: "corporate_bulk_memberships", actionName });
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type EmployeeInput = {
  fullName: string;
  phone: string;
  email?: string | undefined;
  gymId: string;
  membershipPlanId?: string | undefined;
};

export type BulkAddResult = {
  created: number;
  failed: number;
  errors: { index: number; message: string }[];
};

export type CorporateAccountWithEmployees = CorporateAccount & {
  employee_count: number;
};

export type CorporateListResult = {
  accounts: CorporateAccountWithEmployees[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalCompanies: number;
    totalEmployees: number;
    totalRevenue: number;
  };
};

// ─── Corporate Account CRUD ─────────────────────────────────────────────────

export async function getCorporateAccounts(
  organizationId: string,
  filters?: { q?: string; page?: number; pageSize?: number }
): Promise<CorporateListResult> {
  await gate(organizationId, "corporate_accounts.list");
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filters?.pageSize ?? 12));

  let query = supabase
    .from("corporate_accounts")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters?.q) {
    query = query.ilike("company_name", `%${filters.q}%`);
  }

  const { data: accounts, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const typed = (accounts ?? []) as CorporateAccount[];

  // Enrich with employee counts and revenue
  const accountIds = typed.map((a) => a.id);

  const { data: memberCounts } = await supabase
    .from("members")
    .select("corporate_account_id")
    .in("corporate_account_id", accountIds);

  const countMap = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    if (m.corporate_account_id) {
      countMap.set(m.corporate_account_id, (countMap.get(m.corporate_account_id) ?? 0) + 1);
    }
  }

  // Total employees and revenue - filter by org's gyms
  const { data: orgGyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);
  const orgGymIds = (orgGyms ?? []).map((g) => g.id);

  const { data: corpMemberData } = orgGymIds.length > 0
    ? await supabase
        .from("members")
        .select("id")
        .in("gym_id", orgGymIds)
        .not("corporate_account_id", "is", null)
    : { data: [] };

  const totalEmployees = (corpMemberData ?? []).length;
  let totalRevenue = 0;
  if (corpMemberData && corpMemberData.length > 0) {
    const memberIds = corpMemberData.map((m) => m.id);
    const { data: corpMemberships } = await supabase
      .from("memberships")
      .select("price_amount, joining_fee_amount")
      .in("member_id", memberIds)
      .eq("status", "active");

    totalRevenue = (corpMemberships ?? []).reduce(
      (sum, ms) => sum + Number(ms.price_amount ?? 0) + Number(ms.joining_fee_amount ?? 0),
      0
    );
  }

  // Total companies (active)
  const { count: totalCompanies } = await supabase
    .from("corporate_accounts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const result: CorporateAccountWithEmployees[] = typed.map((a) => ({
    ...a,
    employee_count: countMap.get(a.id) ?? 0,
  }));

  return {
    accounts: result,
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
    summary: {
      totalCompanies: totalCompanies ?? 0,
      totalEmployees,
      totalRevenue,
    },
  };
}

export async function getCorporateAccount(
  organizationId: string,
  accountId: string
): Promise<CorporateAccountWithEmployees & { employees: (MemberRow & { membership?: MembershipRow })[] }> {
  await gate(organizationId, "corporate_accounts.read");

  const supabase = await createSupabaseServerClient();

  const { data: account } = await supabase
    .from("corporate_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("organization_id", organizationId)
    .single();

  if (!account) throw new Error("Corporate account not found.");

  const { data: employees } = await supabase
    .from("members")
    .select("*")
    .eq("corporate_account_id", accountId)
    .order("created_at", { ascending: false });

  const typedEmployees = (employees ?? []) as MemberRow[];

  return {
    ...(account as CorporateAccount),
    employee_count: typedEmployees.length,
    employees: typedEmployees as (MemberRow & { membership?: MembershipRow })[],
  };
}

export async function getCorporateEmployees(
  organizationId: string,
  accountId: string
): Promise<MemberRow[]> {
  await gate(organizationId, "corporate_accounts.read");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("corporate_account_id", accountId)
    .order("created_at", { ascending: false });

  return (data ?? []) as MemberRow[];
}

export async function createCorporateAccountAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    await gate(ctx.organizationId, "corporate_accounts.create");

    const companyName = (formData.get("companyName") as string)?.trim();
    if (!companyName) return { ...prevState, status: "error", message: "Company name is required." };

    const discountPercentage = parseFloat((formData.get("discountPercentage") as string) || "0");
    if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
      return { ...prevState, status: "error", message: "Discount must be between 0 and 100." };
    }

    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("corporate_accounts")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .ilike("company_name", companyName)
      .maybeSingle();

    if (existing) return { ...prevState, status: "error", message: "A company with this name already exists." };

    const { data, error } = await supabase
      .from("corporate_accounts")
      .insert({
        organization_id: ctx.organizationId,
        company_name: companyName,
        contact_person: (formData.get("contactPerson") as string)?.trim() || null,
        contact_email: (formData.get("contactEmail") as string)?.trim() || null,
        contact_phone: (formData.get("contactPhone") as string)?.trim() || null,
        billing_email: (formData.get("billingEmail") as string)?.trim() || null,
        discount_percentage: discountPercentage,
        address: (formData.get("address") as string)?.trim() || null,
        notes: (formData.get("notes") as string)?.trim() || null,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await auditOrgAction(ctx.userId, "create_corporate_account", "corporate_account", data.id, {
      company: companyName,
    });
    revalidateOrgModules(["/organization/members"]);
    return { ...prevState, status: "success", message: `Company "${companyName}" created.` };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to create corporate account.");
  }
}

export async function updateCorporateAccountAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    await gate(ctx.organizationId, "corporate_accounts.update");

    const accountId = formData.get("accountId") as string;
    const companyName = (formData.get("companyName") as string)?.trim();
    if (!accountId || !companyName) return { ...prevState, status: "error", message: "Account ID and company name are required." };

    const discountPercentage = parseFloat((formData.get("discountPercentage") as string) || "0");
    if (isNaN(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
      return { ...prevState, status: "error", message: "Discount must be between 0 and 100." };
    }

    const supabase = await createSupabaseServerClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("corporate_accounts")
      .select("id, company_name")
      .eq("id", accountId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (!existing) return { ...prevState, status: "error", message: "Corporate account not found." };

    // Check name uniqueness if changed
    if (existing.company_name.toLowerCase() !== companyName.toLowerCase()) {
      const { data: duplicate } = await supabase
        .from("corporate_accounts")
        .select("id")
        .eq("organization_id", ctx.organizationId)
        .ilike("company_name", companyName)
        .maybeSingle();
      if (duplicate) return { ...prevState, status: "error", message: "A company with this name already exists." };
    }

    const { error } = await supabase
      .from("corporate_accounts")
      .update({
        company_name: companyName,
        contact_person: (formData.get("contactPerson") as string)?.trim() || null,
        contact_email: (formData.get("contactEmail") as string)?.trim() || null,
        contact_phone: (formData.get("contactPhone") as string)?.trim() || null,
        billing_email: (formData.get("billingEmail") as string)?.trim() || null,
        discount_percentage: discountPercentage,
        address: (formData.get("address") as string)?.trim() || null,
        notes: (formData.get("notes") as string)?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (error) throw new Error(error.message);

    await auditOrgAction(ctx.userId, "update_corporate_account", "corporate_account", accountId, {
      company: companyName,
    });
    revalidateOrgModules(["/organization/members"]);
    return { ...prevState, status: "success", message: `Company "${companyName}" updated.` };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to update corporate account.");
  }
}

export async function deleteCorporateAccountAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    await gate(ctx.organizationId, "corporate_accounts.delete");

    const accountId = formData.get("accountId") as string;
    if (!accountId) return { ...prevState, status: "error", message: "Account ID is required." };

    const supabase = await createSupabaseServerClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("corporate_accounts")
      .select("id, company_name")
      .eq("id", accountId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (!existing) return { ...prevState, status: "error", message: "Corporate account not found." };

    // Unlink employees first (SET NULL via on delete set null in FK)
    // The FK constraint handles this - on delete set null

    const { error } = await supabase
      .from("corporate_accounts")
      .delete()
      .eq("id", accountId);

    if (error) throw new Error(error.message);

    await auditOrgAction(ctx.userId, "delete_corporate_account", "corporate_account", accountId, {
      company: existing.company_name,
    });
    revalidateOrgModules(["/organization/members"]);
    return { ...prevState, status: "success", message: `Company "${existing.company_name}" deleted. Employees unlinked.` };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to delete corporate account.");
  }
}

// ─── Bulk Employee Creation ─────────────────────────────────────────────────

export async function bulkAddCorporateEmployeesAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    await gate(ctx.organizationId, "corporate_bulk_memberships.bulk_add");

    const accountId = formData.get("accountId") as string;
    const gymId = formData.get("gymId") as string;
    const membershipPlanId = (formData.get("membershipPlanId") as string) || null;
    const bulkInput = (formData.get("bulkInput") as string) || "";

    if (!accountId || !gymId || !bulkInput) {
      return { ...prevState, status: "error", message: "Corporate account, gym, and employee list are required." };
    }

    const supabase = await createSupabaseServerClient();

    // Validate corporate account
    const { data: corpAccount } = await supabase
      .from("corporate_accounts")
      .select("id, discount_percentage")
      .eq("id", accountId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (!corpAccount) return { ...prevState, status: "error", message: "Corporate account not found." };

    // Validate gym
    const { data: gym } = await supabase
      .from("gyms")
      .select("id")
      .eq("id", gymId)
      .eq("organization_id", ctx.organizationId)
      .single();

    if (!gym) return { ...prevState, status: "error", message: "Gym not found in your organization." };

    // Parse bulk input: one employee per line, format: "Full Name, Phone, Email"
    const lines = bulkInput.split("\n").filter((l) => l.trim());
    const employees = lines.map((line): EmployeeInput => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        fullName: parts[0] ?? "",
        phone: parts[1] ?? "",
        email: parts[2] || undefined,
        gymId,
        membershipPlanId: membershipPlanId ?? undefined,
      };
    });

    // Validate required fields
    const validated = employees.map((e, i) => {
      const errs: string[] = [];
      if (!e.fullName || e.fullName.length < 2) errs.push("Missing or invalid name");
      if (!e.phone || e.phone.length < 8) errs.push("Missing or invalid phone");
      return { index: i, employee: e, valid: errs.length === 0, errors: errs };
    });

    const toCreate = validated.filter((v) => v.valid);
    const failed = validated.filter((v) => !v.valid);

    const errors: { index: number; message: string }[] = failed.map((f) => ({
      index: f.index,
      message: f.errors.join("; "),
    }));

    // Check phone uniqueness within org for valid entries
    const phonesToCheck = toCreate.map((v) => v.employee.phone);
    if (phonesToCheck.length > 0) {
      // Scope to org's gyms for phone uniqueness
      const { data: orgGymsForPhone } = await supabase
        .from("gyms")
        .select("id")
        .eq("organization_id", ctx.organizationId);
      const orgGymIdsForPhone = (orgGymsForPhone ?? []).map((g) => g.id);

      let phoneQuery = supabase
        .from("members")
        .select("phone")
        .in("phone", phonesToCheck);
      if (orgGymIdsForPhone.length > 0) {
        phoneQuery = phoneQuery.in("gym_id", orgGymIdsForPhone);
      }
      const { data: existingMembers } = await phoneQuery;

      const existingPhones = new Set((existingMembers ?? []).map((m) => m.phone));

      const uniqueCreate: typeof toCreate = [];
      for (const item of toCreate) {
        if (existingPhones.has(item.employee.phone)) {
          errors.push({ index: item.index, message: "Phone number already exists in the organization" });
        } else {
          uniqueCreate.push(item);
        }
      }

      const createdCount = uniqueCreate.length;

      // Batch insert
      for (const item of uniqueCreate) {
        try {
          const { employee } = item;
          const memberCode = `CORP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

          const { data: newMember, error: memberErr } = await supabase
            .from("members")
            .insert({
              gym_id: employee.gymId,
              member_code: memberCode,
              full_name: employee.fullName,
              phone: employee.phone,
              email: employee.email ?? null,
              status: "active",
              joined_at: new Date().toISOString(),
              corporate_account_id: accountId,
            })
            .select("id")
            .single();

          if (memberErr) {
            errors.push({ index: item.index, message: memberErr.message });
            continue;
          }

          // Create membership if plan specified
          if (employee.membershipPlanId && newMember) {
            const { data: plan } = await supabase
              .from("membership_plans")
              .select("price_amount, joining_fee_amount, duration_days, plan_type")
              .eq("id", employee.membershipPlanId)
              .eq("gym_id", employee.gymId)
              .single();

            if (plan) {
              const discountPct = Number(corpAccount.discount_percentage);
              const discountAmount = discountPct > 0
                ? Math.round(Number(plan.price_amount) * discountPct / 100)
                : 0;

              const startDate = new Date();
              const endDate = new Date();
              endDate.setDate(endDate.getDate() + (plan.duration_days ?? 30));

              const startStr = startDate.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0] ?? "2026-01-01";
              const endStr = endDate.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0] ?? "2026-12-31";

              await supabase.from("memberships").insert({
                gym_id: employee.gymId,
                member_id: newMember.id,
                membership_plan_id: employee.membershipPlanId,
                status: "active",
                start_date: startStr,
                end_date: endStr,
                price_amount: plan.price_amount,
                joining_fee_amount: plan.joining_fee_amount ?? 0,
                discount_amount: discountAmount,
                source: "imported",
                payment_status: "paid",
              });
            }
          }
        } catch (innerErr) {
          errors.push({
            index: item.index,
            message: innerErr instanceof Error ? innerErr.message : "Unknown error creating member",
          });
        }
      }

      // Count actual created vs validation errors
      const totalFailed = errors.length;
      const totalCreated = uniqueCreate.length - (totalFailed - failed.length);

      await auditOrgAction(ctx.userId, "bulk_add_corporate_employees", "corporate_account", accountId, {
        created: totalCreated,
        failed: totalFailed,
      });
      revalidateOrgModules(["/organization/members"]);

      return {
        ...prevState,
        status: totalCreated > 0 ? "success" : "error",
        message: `${totalCreated} employee${totalCreated !== 1 ? "s" : ""} added, ${totalFailed} error${totalFailed !== 1 ? "s" : ""}.`,
      };
    }

    return {
      ...prevState,
      status: failed.length > 0 ? "error" : "success",
      message: `No valid employees to add.`,
    };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to add corporate employees.");
  }
}

export async function unlinkCorporateEmployeeAction(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    const ctx = await getOrgOwnerContext("/organization/members");
    await gate(ctx.organizationId, "corporate_bulk_memberships.update");

    const memberId = formData.get("memberId") as string;
    if (!memberId) return { ...prevState, status: "error", message: "Member ID is required." };

    const supabase = await createSupabaseServerClient();

    const { data: member } = await supabase
      .from("members")
      .select("id, corporate_account_id, full_name")
      .eq("id", memberId)
      .single();

    if (!member) return { ...prevState, status: "error", message: "Member not found." };
    if (!member.corporate_account_id) return { ...prevState, status: "error", message: "Member is not linked to any corporate account." };

    const { error } = await supabase
      .from("members")
      .update({ corporate_account_id: null, updated_at: new Date().toISOString() })
      .eq("id", memberId);

    if (error) throw new Error(error.message);

    await auditOrgAction(ctx.userId, "unlink_corporate_employee", "member", memberId, { member: member.full_name });
    revalidateOrgModules(["/organization/members"]);
    return { ...prevState, status: "success", message: `"${member.full_name}" unlinked from corporate account.` };
  } catch (e) {
    return entitlementActionCatch(prevState, e, "Failed to unlink employee.");
  }
}
