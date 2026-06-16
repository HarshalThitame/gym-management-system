import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { getGymBranchManagementData } from "@/features/super-admin/services/gym-branch-management-service";
import type { GymBranchManagementData } from "@/features/super-admin/services/gym-branch-management-service";
import { BranchesClient } from "./branches-client";

export const metadata: Metadata = createMetadata({
  title: "Branch & Location Management",
  description: "Manage branches, locations, status, assignments, capacity, and operational visibility across all organizations.",
  path: "/super-admin/branches",
});

export const dynamic = "force-dynamic";

async function BranchesContent() {
  await requireRole(["super_admin"], "/super-admin/branches");
  const data: GymBranchManagementData = await getGymBranchManagementData();

  return <BranchesClient data={data} />;
}

export default function SuperAdminBranchesPage() {
  return (
    <Suspense fallback={<BranchesFallback />}>
      <BranchesContent />
    </Suspense>
  );
}

function BranchesFallback() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface p-6">
        <Skeleton className="h-6 w-48" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
