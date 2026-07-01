import type { Metadata } from "next";
import { Wrench, Package, AlertTriangle, CheckCircle, XCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getEquipmentDashboard } from "@/features/equipment/services/equipment-service";
import { EquipmentForm, EquipmentDeleteForm } from "@/features/equipment/components/equipment-forms";
import { EquipmentStatusBadge } from "@/features/equipment/components/equipment-status-badge";

export const metadata: Metadata = createMetadata({
  title: "Equipment Management",
  description: "Manage gym equipment, track maintenance schedules, and monitor asset lifecycle.",
  path: "/admin/equipment"
});

export default async function AdminEquipmentPage() {
  const scope = await requireGymAdminScope("/admin/equipment");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  const dashboard = await getEquipmentDashboard(organizationId);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Asset Management</p>
        <h2 className="mt-2 text-3xl font-black">Equipment & Maintenance</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Track all gym equipment, manage maintenance schedules, monitor warranty and AMC status, and maintain asset records.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          detail="Total equipment records"
          icon={<Package className="size-5" />}
          label="Total Equipment"
          value={String(dashboard.metrics.totalEquipment)}
        />
        <StatCard
          detail="Currently operational"
          icon={<CheckCircle className="size-5" />}
          label="Active"
          value={String(dashboard.metrics.activeEquipment)}
        />
        <StatCard
          detail="Under maintenance"
          icon={<Wrench className="size-5" />}
          label="Maintenance"
          value={String(dashboard.metrics.maintenanceEquipment)}
        />
        <StatCard
          detail="Decommissioned"
          icon={<XCircle className="size-5" />}
          label="Retired"
          value={String(dashboard.metrics.retiredEquipment)}
        />
        <StatCard
          detail="Upcoming service dates"
          icon={<Calendar className="size-5" />}
          label="Upcoming Service"
          value={String(dashboard.metrics.upcomingService)}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Equipment Inventory</h3>
            <p className="text-sm leading-6 text-muted-foreground">All equipment registered in your gym.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.equipment.length === 0 ? (
              <EmptyState simple text="No equipment registered yet. Add your first equipment to get started." />
            ) : (
              dashboard.equipment.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-surface-muted p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black">{item.name}</h4>
                        <EquipmentStatusBadge status={item.status} />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        {item.equipment_type} {item.brand ? `· ${item.brand}` : ""} {item.model ? `· ${item.model}` : ""}
                      </p>
                      {item.serial_number && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          S/N: {item.serial_number}
                        </p>
                      )}
                      {item.location && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Location: {item.location}
                        </p>
                      )}
                      {item.warranty_expiry && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          Warranty: {new Date(item.warranty_expiry).toLocaleDateString()}
                        </p>
                      )}
                      {item.amc_expiry && (
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          AMC: {item.amc_provider} · Expires {new Date(item.amc_expiry).toLocaleDateString()}
                        </p>
                      )}
                      {item.next_service_date && (
                        <p className="mt-1 text-xs font-bold text-warning">
                          Next Service: {new Date(item.next_service_date).toLocaleDateString()}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                  </div>
                  <details className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    <summary className="cursor-pointer text-xs font-black text-destructive">Delete Equipment</summary>
                    <div className="mt-2">
                      <EquipmentDeleteForm equipmentId={item.id} />
                    </div>
                  </details>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Add Equipment</h3>
          </CardHeader>
          <CardContent>
            <EquipmentForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
