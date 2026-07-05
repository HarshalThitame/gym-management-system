import { createAdminClient } from "@/lib/supabase/admin";

type BranchPolicyInput = {
  gymId: string;
  deviceBranchId: string | null;
  memberBranchId: string | null;
  actorBranchId?: string | null;
  persistMemberBranch?: boolean;
};

type BranchPolicyResult =
  | {
      ok: true;
      branchId: string;
      branchSource: "device" | "member" | "actor" | "fallback";
      shouldPersistMemberBranch: boolean;
    }
  | {
      ok: false;
      code: "BRANCH_SCOPE_DENIED" | "BRANCH_SCOPE_REQUIRED";
      message: string;
      expectedBranchId?: string | null;
      actualBranchId?: string | null;
    };

export async function resolveDeviceBranchPolicy(input: BranchPolicyInput): Promise<BranchPolicyResult> {
  const supabase = createAdminClient();
  const { gymId, deviceBranchId, memberBranchId, actorBranchId, persistMemberBranch = true } = input;

  if (deviceBranchId && memberBranchId && deviceBranchId !== memberBranchId) {
    return {
      ok: false,
      code: "BRANCH_SCOPE_DENIED",
      message: "Member is assigned to a different branch than this kiosk.",
      expectedBranchId: memberBranchId,
      actualBranchId: deviceBranchId,
    };
  }

  const preferredBranchId = deviceBranchId ?? memberBranchId ?? actorBranchId;
  if (preferredBranchId) {
    const { data, error } = await supabase
      .from("branches")
      .select("id, gym_id, status")
      .eq("id", preferredBranchId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.gym_id !== gymId || data.status === "archived") {
      return {
        ok: false,
        code: "BRANCH_SCOPE_REQUIRED",
        message: "Selected branch is not available for this gym.",
      };
    }

    return {
      ok: true,
      branchId: data.id,
      branchSource: data.id === deviceBranchId ? "device" : data.id === memberBranchId ? "member" : "actor",
      shouldPersistMemberBranch: persistMemberBranch && !memberBranchId && !!deviceBranchId,
    };
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("branches")
    .select("id")
    .eq("gym_id", gymId)
    .neq("status", "archived")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw new Error(fallbackError.message);
  }

  if (!fallback) {
    return {
      ok: false,
      code: "BRANCH_SCOPE_REQUIRED",
      message: "No active branch is configured for this gym.",
    };
  }

  return {
    ok: true,
    branchId: fallback.id,
    branchSource: "fallback",
    shouldPersistMemberBranch: persistMemberBranch && !memberBranchId && !!deviceBranchId,
  };
}
