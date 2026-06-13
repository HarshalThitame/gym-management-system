export function getCriticalSuperAdminEmail(): string {
  const email = process.env.SUPER_ADMIN_CRITICAL_EMAIL ?? process.env.NEXT_PUBLIC_SUPER_ADMIN_CRITICAL_EMAIL;
  if (!email) throw new Error("SUPER_ADMIN_CRITICAL_EMAIL is not configured. Set it in your environment.");
  return email.trim().toLowerCase();
}
