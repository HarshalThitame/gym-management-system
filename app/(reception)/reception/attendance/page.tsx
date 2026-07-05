import { Suspense } from "react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { AttendanceDesk } from "@/features/attendance/components/attendance-desk";
import { ErrorBoundary } from "@/features/attendance/components/error-boundary";
import { getAttendanceDashboard, listAccessDevices } from "@/features/attendance/services/attendance-service";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";

export const metadata: Metadata = createMetadata({
  title: "Reception Attendance",
  description: "Reception attendance and check-in workspace for assigned branch front desk operations.",
  path: "/reception/attendance"
});

export default async function ReceptionAttendancePage() {
  const scope = await requireReceptionScope("/reception/attendance");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");
  await requireOrganizationFeatureAccess({ organizationId, featureKey: "manual_attendance", actionName: "reception.attendance.read" });

  const [dashboard, devices] = await Promise.all([
    getAttendanceDashboard(scope.gymId),
    listAccessDevices(scope.gymId)
  ]);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Attendance</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black">Attendance Desk</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Search for members, validate membership, check in via QR or manual entry, and manage active sessions — all from one place.
            </p>
          </div>
          <ButtonLink href="/reception/attendance/kiosk" variant="secondary">
            Open kiosk mode
          </ButtonLink>
        </div>
      </section>

      <ErrorBoundary>
        <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-muted p-20" />}>
          <AttendanceDesk
            currentSessions={dashboard.currentSessions}
            devices={devices}
            gymId={scope.gymId}
            branchId={scope.branchId}
            metrics={{
              currentInside: dashboard.metrics.currentInside,
              todayCheckIns: dashboard.metrics.todayCheckIns,
              capacityPercentage: dashboard.metrics.capacityPercentage,
            }}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
