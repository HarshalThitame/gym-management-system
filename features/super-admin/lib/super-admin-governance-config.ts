export function getCriticalSuperAdminEmail(): string {
  const email = process.env.SUPER_ADMIN_CRITICAL_EMAIL;
  if (!email) throw new Error("SUPER_ADMIN_CRITICAL_EMAIL is not configured. Set it in your environment.");
  return email.trim().toLowerCase();
}

export async function verifyCriticalEmailServerSide(email: string): Promise<boolean> {
  const criticalEmail = process.env.SUPER_ADMIN_CRITICAL_EMAIL;
  if (!criticalEmail) return false;
  return email.toLowerCase().trim() === criticalEmail.toLowerCase().trim();
}
