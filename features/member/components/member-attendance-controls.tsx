"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SelfCheckInButton } from "@/features/member/components/self-checkin-button";
import { formatLocationSummary } from "@/features/member/lib/location-tracking";
import { useMemberLocationTracker } from "@/features/member/hooks/use-member-location-tracker";
import type { MemberAttendancePortal } from "@/types/attendance";

type MemberAttendanceControlsProps = {
  portal: MemberAttendancePortal;
};

export function MemberAttendanceControls({ portal }: MemberAttendanceControlsProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(portal.activeSession?.id ?? null);

  const tracker = useMemberLocationTracker({
    memberId: portal.member.id,
    activeSessionId,
    branchId: portal.locationTracking.branchId,
    branchName: portal.locationTracking.branchName,
    geofenceEnabled: portal.locationTracking.enabled,
    radiusMeters: portal.locationTracking.radiusMeters,
    coordinatesConfigured: portal.locationTracking.coordinatesConfigured,
    onSessionEnded: () => setActiveSessionId(null)
  });

  const statusTone = useMemo(() => {
    switch (tracker.status) {
      case "tracking":
        return "text-emerald-300";
      case "requesting":
        return "text-cyan-300";
      case "offline":
        return "text-amber-300";
      case "permission_denied":
      case "unsupported":
      case "error":
        return "text-red-300";
      default:
        return "text-slate-300";
    }
  }, [tracker.status]);

  return (
    <div className="space-y-4">
      <SelfCheckInButton
        memberId={portal.member.id}
        onSuccess={({ sessionId }) => {
          setActiveSessionId(sessionId);
        }}
      />

      <Card variant="glass">
        <CardHeader>
          <h3 className="text-2xl font-black">Checkout Location Tracker</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            This tracker is used only to close an active session when you leave the branch radius. Check-in still uses the button or QR flow.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoTile label="Branch" value={portal.locationTracking.branchName ?? "Not configured"} />
            <InfoTile label="Radius" value={`${portal.locationTracking.radiusMeters}m`} />
            <InfoTile label="Permission" value={tracker.permissionState} />
            <InfoTile label="Queue" value={`${tracker.pendingCount} pending`} />
          </div>

          <div className={`rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm font-semibold ${statusTone}`}>
            <p className="font-black uppercase tracking-[0.12em]">Status: {tracker.status}</p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{tracker.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">Last sample: {formatLocationSummary(tracker.lastSample)}</p>
            {tracker.lastSentAt ? <p className="mt-1 text-xs text-muted-foreground">Last report sent at {new Date(tracker.lastSentAt).toLocaleTimeString("en-IN")}</p> : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!activeSessionId || !portal.locationTracking.enabled || tracker.status === "unsupported" || tracker.status === "permission_denied"}
              onClick={() => void tracker.reportNow()}
              type="button"
              variant="secondary"
            >
              Report location now
            </Button>
            <Button disabled={tracker.pendingCount === 0} onClick={() => void tracker.retryPendingReports()} type="button" variant="outline">
              Retry queued samples
            </Button>
            {tracker.status === "permission_denied" ? (
              <Button onClick={() => void tracker.retryLocationAccess()} type="button" variant="outline">
                Retry location access
              </Button>
            ) : null}
          </div>

          {!portal.locationTracking.enabled ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted p-4 text-sm text-muted-foreground">
              Checkout geofence is disabled for this branch or the branch does not have coordinates configured.
            </div>
          ) : null}
          {tracker.status === "permission_denied" ? (
            <div className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              Location permission is blocked in the browser. Open the browser site settings, allow location access, then retry.
            </div>
          ) : null}
          {!activeSessionId ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-muted p-4 text-sm text-muted-foreground">
              No active attendance session is currently open, so location tracking is idle.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
