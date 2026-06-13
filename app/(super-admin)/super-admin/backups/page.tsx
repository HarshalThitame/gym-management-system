import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";
import { requireRole } from "@/lib/auth/guards";
import { getBackupDashboard } from "@/features/backup/services/backup-service";
import { BackupDashboardClient } from "./backup-dashboard";

export const metadata: Metadata = createMetadata({
  title: "Enterprise Backup, Recovery & Disaster Recovery Center",
  description: "Backup operations, recovery management, DR readiness, cross-region replication, point-in-time recovery, ransomware protection, and compliance reporting.",
  path: "/super-admin/backups"
});

export default async function BackupPage() {
  const context = await requireRole(["super_admin"], "/super-admin/backups");
  const dashboard = await getBackupDashboard();
  return <BackupDashboardClient context={context} dashboard={dashboard} />;
}
