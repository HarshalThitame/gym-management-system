import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { KioskTerminal } from "@/features/attendance/components/kiosk-terminal";
import { requireReceptionScope } from "@/features/reception/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { requireOrganizationFeatureAccess } from "@/features/entitlement";
import { listAccessDevices } from "@/features/attendance/services/attendance-service";

export const metadata: Metadata = createMetadata({
  title: "Attendance Kiosk",
  description: "Dedicated kiosk screen for RFID, NFC, and device-auth attendance check-in/out.",
  path: "/reception/attendance/kiosk",
});

export default async function ReceptionAttendanceKioskPage() {
  const scope = await requireReceptionScope("/reception/attendance/kiosk");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  if (!organizationId) throw new Error("Organization scope required.");

  await requireOrganizationFeatureAccess({
    organizationId,
    featureKey: "attendance_api",
    actionName: "reception.attendance.kiosk",
  });

  const devices = await listAccessDevices(scope.gymId);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Attendance</p>
          <h1 className="mt-2 text-3xl font-black">Kiosk Mode</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Dedicated reader screen for wall-mounted devices, reception terminals, and branch kiosks.
          </p>
        </div>
        <ButtonLink href="/reception/attendance" variant="secondary">
          <ArrowLeft className="size-4" />
          Back to desk
        </ButtonLink>
      </div>

      <Card className="border-white/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="size-5" />
            <h2 className="text-2xl font-black">Reader Terminal</h2>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Enter the kiosk device API key, scan a UID, or use the fallback member ID path for staff-assisted entries.
          </p>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-muted p-20" />}>
            <KioskTerminal devices={devices.map((device) => ({
              id: device.id,
              device_name: device.name,
              device_code: device.device_code,
              device_type: device.device_type,
              status: device.status,
              location: device.location,
              last_seen_at: device.last_seen_at,
            }))} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
