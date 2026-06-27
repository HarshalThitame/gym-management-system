"use server";

import { revalidatePath } from "next/cache";
import { runFullAudit } from "@/features/super-admin/services/ux-governance-service";

export async function rerunUxAudit() {
  const result = runFullAudit();
  revalidatePath("/super-admin/ux-governance");
  return result;
}
