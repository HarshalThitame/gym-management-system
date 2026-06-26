"use server";

import { revalidatePath } from "next/cache";
import { runAllComplianceChecks } from "@/features/security/services/compliance-checker-service";

export async function rerunComplianceChecks() {
  await runAllComplianceChecks();
  revalidatePath("/super-admin/security/compliance");
}
