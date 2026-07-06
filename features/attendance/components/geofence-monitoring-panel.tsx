"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldAlert, ShieldCheck, ShieldQuestion, ExternalLink } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type GeofenceMonitoringData = {
  totals: {
    branchesMonitored: number;
    branchesConfigured: number;
    branchesMissingCoordinates: number;
    branchesDisabled: number;
    activeTrackedSessions: number;
    staleTrackedSessions: number;
    recentExits: number;
    recentPendingReports: number;
    recentLowConfidenceReports: number;
    recentAutoCheckouts: number;
  };
  branches: Array<{
    branchId: string;
    branchName: string | null;
    gymId: string | null;
    geofenceEnabled: boolean;
    coordinatesConfigured: boolean;
    radiusMeters: number;
    activeSessions: number;
    staleSessions: number;
    recentExits: number;
    pendingReports: number;
    lowConfidenceReports: number;
    recentAutoCheckouts: number;
    lastLocationAt: string | null;
    status: "healthy" | "watch" | "critical";
    note: string;
  }>;
  recentEvents: Array<{
    id: string;
    type: "geo_fence_exit" | "auto_checkout";
    memberId: string;
    memberName: string;
    memberCode: string | null;
    sessionId: string | null;
    branchId: string | null;
    branchName: string | null;
    occurredAt: string;
    distanceMeters: number | null;
      radiusMeters: number | null;
    }>;
  pendingSamples: Array<{
    id: string;
    memberId: string;
    memberName: string;
    memberCode: string | null;
    sessionId: string | null;
    branchId: string | null;
    branchName: string | null;
    occurredAt: string;
    distanceMeters: number | null;
    radiusMeters: number | null;
    reasonCode: "outside_pending" | "low_accuracy";
  }>;
  staleSessions: Array<{
    sessionId: string;
    memberId: string;
    memberName: string;
    memberCode: string | null;
    branchId: string | null;
    branchName: string | null;
    lastLocationAt: string | null;
    minutesSinceLastLocation: number | null;
  }>;
};

type GeofenceMonitoringPanelProps = {
  gymId: string | null;
  branchId: string | null;
};

export function GeofenceMonitoringPanel({ gymId, branchId }: GeofenceMonitoringPanelProps) {
  const [data, setData] = useState<GeofenceMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (gymId) params.set("gymId", gymId);
        if (branchId) params.set("branchId", branchId);

        const response = await fetch(`/api/v1/analytics/geofence?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(json?.error?.message ?? "Unable to load geofence monitoring.");
        }

        if (!active) return;
        setData(json.data ?? null);
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load geofence monitoring.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [branchId, gymId, refreshTick]);

  const branchSummary = useMemo(() => {
    if (!data) return [];
    return data.branches.slice().sort((a, b) => {
      const score = { critical: 0, watch: 1, healthy: 2 } as const;
      return score[a.status] - score[b.status];
    });
  }, [data]);

  const incidentLabel = data && data.recentEvents.length > 0 ? `${data.recentEvents.length} recent incidents` : "No recent incidents";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Geofence Ops</p>
            <h3 className="mt-1 text-2xl font-black">Checkout geofence monitoring</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Live branch geofence health, stale trackers, and exit-triggered auto-checkouts. Configuration stays in branch settings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={loading} onClick={() => setRefreshTick((value) => value + 1)} variant="secondary">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ButtonLink href="/organization/branches" variant="secondary">
              <ExternalLink className="size-4" />
              Open branch settings
            </ButtonLink>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <p>{error}</p>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <InfoCard label="Branches" value={data ? String(data.totals.branchesMonitored) : "—"} detail={data ? `${data.totals.branchesConfigured} configured` : "Loading"} />
          <InfoCard label="Active trackers" value={data ? String(data.totals.activeTrackedSessions) : "—"} detail={data ? `${data.totals.staleTrackedSessions} stale` : "Loading"} />
          <InfoCard label="Recent exits" value={data ? String(data.totals.recentExits) : "—"} detail={data ? `${data.totals.recentAutoCheckouts} auto-checkouts` : "Loading"} />
          <InfoCard label="Pending samples" value={data ? String(data.totals.recentPendingReports) : "—"} detail={data ? `${data.totals.recentLowConfidenceReports} low confidence` : "Loading"} />
          <InfoCard label="Config issues" value={data ? String(data.totals.branchesMissingCoordinates + data.totals.branchesDisabled) : "—"} detail={data ? `${data.totals.branchesMissingCoordinates} missing coords` : "Loading"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/70">
            <CardHeader>
              <h4 className="text-xl font-black">Branch health</h4>
              <p className="text-sm leading-6 text-muted-foreground">Each branch shows geofence configuration, active sessions, stale trackers, and recent exit volume.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-sm text-muted-foreground">Loading geofence status…</div>
              ) : branchSummary.length > 0 ? (
                branchSummary.map((branch) => (
                  <div key={branch.branchId} className="rounded-xl border border-border bg-surface-muted p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{branch.branchName ?? "Unnamed branch"}</p>
                        <p className="text-xs font-semibold text-muted-foreground">{branch.branchId}</p>
                      </div>
                      <StatusPill status={branch.status} />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      <SmallStat label="Active" value={String(branch.activeSessions)} />
                      <SmallStat label="Stale" value={String(branch.staleSessions)} />
                      <SmallStat label="Exits" value={String(branch.recentExits)} />
                      <SmallStat label="Pending" value={String(branch.pendingReports)} />
                      <SmallStat label="Auto-checkouts" value={String(branch.recentAutoCheckouts)} />
                      <SmallStat label="Low confidence" value={String(branch.lowConfidenceReports)} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs font-semibold text-muted-foreground md:grid-cols-2">
                      <p>Radius: {branch.coordinatesConfigured ? `${branch.radiusMeters}m` : "No coordinates"}</p>
                      <p>Last location: {branch.lastLocationAt ? new Date(branch.lastLocationAt).toLocaleString("en-IN") : "No reports yet"}</p>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{branch.note}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-sm text-muted-foreground">No geofence branches found for this scope.</div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70">
              <CardHeader>
                <h4 className="text-xl font-black">Recent incidents</h4>
                <p className="text-sm leading-6 text-muted-foreground">{incidentLabel}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-sm text-muted-foreground">Loading incidents…</div>
                ) : data?.recentEvents.length ? (
                  data.recentEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">{event.memberName}</p>
                        <StatusPill status={event.type === "geo_fence_exit" ? "watch" : "critical"} />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {event.branchName ?? "Branch"} · {new Date(event.occurredAt).toLocaleString("en-IN")}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {event.type === "geo_fence_exit" ? "Exited branch radius." : "Auto-checkout recorded after geofence exit or timeout."}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-sm text-muted-foreground">No recent geofence incidents.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <h4 className="text-xl font-black">Pending samples</h4>
                <p className="text-sm leading-6 text-muted-foreground">Outside and low-confidence samples that have not been confirmed as exits yet.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-sm text-muted-foreground">Loading pending samples…</div>
                ) : data?.pendingSamples.length ? (
                  data.pendingSamples.map((sample) => (
                    <div key={sample.id} className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">{sample.memberName}</p>
                        <StatusPill status="watch" />
                      </div>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {sample.branchName ?? "Branch"} · {new Date(sample.occurredAt).toLocaleString("en-IN")}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {sample.reasonCode === "low_accuracy" ? "Low confidence sample. Not counted as an exit yet." : "Outside sample waiting for confirmation before auto-checkout."}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-sm text-muted-foreground">No pending geofence samples.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <h4 className="text-xl font-black">Stale trackers</h4>
                <p className="text-sm leading-6 text-muted-foreground">Active sessions that have not sent a recent location sample.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-sm text-muted-foreground">Loading stale tracker list…</div>
                ) : data?.staleSessions.length ? (
                  data.staleSessions.map((session) => (
                    <div key={session.sessionId} className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
                      <p className="font-bold">{session.memberName}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {session.branchName ?? "Branch"} · {session.minutesSinceLastLocation ?? "?"}m since last sample
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-surface-muted p-6 text-sm text-muted-foreground">No stale location trackers right now.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <InfoCard label="Missing coords" value={data ? String(data.totals.branchesMissingCoordinates) : "—"} detail="Branches need latitude and longitude" />
          <InfoCard label="Geofence disabled" value={data ? String(data.totals.branchesDisabled) : "—"} detail="Configured but not enabled" />
          <InfoCard label="Checkout-only" value="Yes" detail="Self check-in is not geofence-gated" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: "healthy" | "watch" | "critical" }) {
  const tone = status === "healthy" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : status === "watch" ? "border-amber-500/20 bg-amber-500/10 text-amber-100" : "border-red-500/20 bg-red-500/10 text-red-100";
  const icon = status === "healthy" ? <ShieldCheck className="size-3.5" /> : status === "watch" ? <ShieldQuestion className="size-3.5" /> : <ShieldAlert className="size-3.5" />;
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${tone}`}>
      {icon}
      {status}
    </div>
  );
}

function InfoCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}
