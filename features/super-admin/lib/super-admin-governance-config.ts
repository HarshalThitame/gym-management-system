export const fallbackCriticalSuperAdminEmail = "hthitame@gmail.com";

export function getCriticalSuperAdminEmail() {
  return (
    process.env.SUPER_ADMIN_CRITICAL_EMAIL ??
    process.env.NEXT_PUBLIC_SUPER_ADMIN_CRITICAL_EMAIL ??
    fallbackCriticalSuperAdminEmail
  ).trim().toLowerCase();
}
