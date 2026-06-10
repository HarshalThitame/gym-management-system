import type { Metadata } from "next";
import { PackageCheck, ReceiptText, TimerReset } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { listMembers } from "@/features/memberships/services/membership-service";
import { formatMoney } from "@/features/memberships/lib/business-rules";
import { PtPackageForm, PtPurchaseForm } from "@/features/training/components/training-forms";
import { TrainingStatusBadge } from "@/features/training/components/training-status-badge";
import { listActiveTrainers, listPersonalTrainingPackages } from "@/features/training/services/training-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Personal Training Packages",
  description: "Create PT package products and assign paid or pending packages to members.",
  path: "/admin/trainers/packages"
});

export default async function AdminTrainerPackagesPage() {
  const context = await requireRole(["super_admin", "gym_admin", "reception_staff"], "/admin/trainers/packages");
  const gymId = context.profile?.gym_id ?? null;
  const [packages, trainers, membersResult] = await Promise.all([
    listPersonalTrainingPackages(gymId),
    listActiveTrainers(gymId),
    listMembers({ gymId, pageSize: 100 })
  ]);
  const activePackages = packages.filter((packageRow) => packageRow.status === "active");
  const revenuePotential = activePackages.reduce((total, packageRow) => total + packageRow.price_amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Personal Training</p>
        <h2 className="mt-2 text-3xl font-black">Packages and purchase workflow</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Build sellable PT packages, assign trainers, generate billing-ready records, and allocate sessions for tracking.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard detail="Sellable PT products" icon={<PackageCheck className="size-5" />} label="Active Packages" value={String(activePackages.length)} />
        <StatCard detail="Per active package catalog" icon={<ReceiptText className="size-5" />} label="Revenue Potential" value={formatMoney(revenuePotential)} />
        <StatCard detail="Default package validity windows" icon={<TimerReset className="size-5" />} label="Longest Validity" value={`${Math.max(0, ...packages.map((packageRow) => packageRow.validity_days))}d`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Package Catalog</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {packages.map((packageRow) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={packageRow.id}>
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-black">{packageRow.name}</h4>
                      <TrainingStatusBadge status={packageRow.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{packageRow.description}</p>
                  </div>
                  <p className="text-xl font-black">{formatMoney(packageRow.price_amount)}</p>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <Metric label="Sessions" value={String(packageRow.session_count)} />
                  <Metric label="Validity" value={`${packageRow.validity_days} days`} />
                  <Metric label="Display" value={String(packageRow.display_order)} />
                </div>
              </div>
            ))}
            {packages.length === 0 ? <div className="rounded-md border border-border bg-surface-muted p-5 text-sm font-semibold text-muted-foreground">No PT packages created yet.</div> : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Create Package</h3>
            </CardHeader>
            <CardContent>
              <PtPackageForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Assign Package</h3>
            </CardHeader>
            <CardContent>
              <PtPurchaseForm members={membersResult.members} packages={activePackages} trainers={trainers} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
