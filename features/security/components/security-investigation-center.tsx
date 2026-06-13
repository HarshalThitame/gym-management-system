"use client";

import { useState } from "react";
import { Search, Shield, AlertTriangle, Globe, Monitor, Fingerprint, Lock, RefreshCw, UserX, Ban, ArrowUpRight } from "lucide-react";

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "border-red-200 bg-red-50 text-red-700",
    high: "border-orange-200 bg-orange-50 text-orange-700",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    low: "border-blue-200 bg-blue-50 text-blue-700",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colors[severity] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>{severity}</span>;
}

function DetectionCard({ name, triggered, severity, detail }: { name: string; triggered: boolean; severity: string; detail: string }) {
  return (
    <div className={`rounded-lg border p-4 transition-all ${triggered ? "border-red-200 bg-red-50 shadow-sm" : "border-border bg-card opacity-60"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {triggered ? <AlertTriangle className="size-4 text-red-500" /> : <Shield className="size-4 text-green-500" />}
          <p className="text-sm font-bold">{name}</p>
        </div>
        {triggered && <SeverityBadge severity={severity} />}
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{triggered ? detail : "All clear — no suspicious activity detected"}</p>
    </div>
  );
}

export function SecurityInvestigationCenter({ data }: { data: Record<string, unknown> }) {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(data ?? null);

  const handleSearch = async () => {
    if (!userId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/security/investigate?userId=${userId}`);
      const json = await res.json();
      if (json.ok) setResult(json.data);
    } catch {} finally { setLoading(false); }
  };

  const handleAction = async (action: string) => {
    if (!result?.profile) return;
    const uid = String((result.profile as Record<string, unknown>).id);
    await fetch("/api/security/investigate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid, action }),
    });
  };

  const profile = result?.profile as Record<string, unknown> | null;
  const activeSessions = (result?.activeSessions ?? []) as Array<Record<string, unknown>>;
  const loginHistory = (result?.loginHistory ?? []) as Array<Record<string, unknown>>;
  const riskEvents = (result?.riskEvents ?? []) as Array<Record<string, unknown>>;
  const detectionResults = (result?.detectionResults ?? []) as Array<{ name: string; triggered: boolean; severity: string; detail: string }>;
  const avgRiskScore = (result?.avgRiskScore as number) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input type="text" placeholder="Search by User ID, email, or name..." value={userId} onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 uppercase tracking-[0.08em]">
          {loading ? <RefreshCw className="size-4 animate-spin" /> : <Search className="size-4" />}
          Investigate
        </button>
      </div>

      {result && profile ? (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary text-lg font-black">
                    {String(profile.full_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-black">{profile.full_name as string ?? "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{profile.email as string ?? "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">ID: {profile.id as string}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-4xl font-black ${avgRiskScore > 70 ? "text-red-600" : avgRiskScore > 30 ? "text-amber-600" : "text-green-600"}`}>{avgRiskScore}</p>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground mt-1">Risk Score</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {detectionResults.map((d, i) => <DetectionCard key={i} {...d} />)}
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Active Sessions ({activeSessions.length})</p>
                <Monitor className="size-4 text-muted-foreground" />
              </div>
              <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
                {activeSessions.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-muted-foreground">No active sessions</div>
                ) : activeSessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <Monitor className="size-4 text-muted-foreground" />
                      <span className="font-medium">{String(s.browser ?? "Unknown")} on {String(s.os ?? "Unknown")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-mono">{String(s.ip_address ?? "")}</span>
                      <span>{String(s.location_country ?? "—")}</span>
                      <span className={`font-bold ${Number(s.risk_score) > 70 ? "text-red-600" : ""}`}>{String(s.risk_score ?? "0")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Login History ({loginHistory.length})</p>
                <Fingerprint className="size-4 text-muted-foreground" />
              </div>
              <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
                {loginHistory.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-muted-foreground">No login history</div>
                ) : loginHistory.slice(0, 20).map((l, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${String(l.status) === "success" ? "bg-green-500" : "bg-red-500"}`} />
                      <span className="text-muted-foreground">{String(l.email ?? "")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-mono text-xs">{String(l.ip_address ?? "")}</span>
                      <span>{l.created_at ? new Date(String(l.created_at)).toLocaleString() : ""}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        String(l.status) === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
                      }`}>{String(l.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Investigator Actions</p>
              <div className="mt-4 space-y-2">
                <button onClick={() => handleAction("block")}
                  className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors uppercase tracking-[0.08em]">
                  <Ban className="size-4" /> Block User
                </button>
                <button onClick={() => handleAction("force_reset")}
                  className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors uppercase tracking-[0.08em]">
                  <Lock className="size-4" /> Force Password Reset
                </button>
                <button onClick={() => handleAction("mfa_reset")}
                  className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-xs font-bold hover:bg-orange-100 transition-colors uppercase tracking-[0.08em]">
                  <UserX className="size-4" /> Force MFA Reset
                </button>
                <button onClick={() => handleAction("revoke_sessions")}
                  className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-border text-xs font-bold hover:bg-muted transition-colors uppercase tracking-[0.08em]">
                  <Monitor className="size-4" /> Revoke All Sessions
                </button>
              </div>
            </div>

            {riskEvents.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Risk Events ({riskEvents.length})</p>
                <div className="mt-3 space-y-1 max-h-[240px] overflow-y-auto">
                  {riskEvents.slice(0, 10).map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${String(r.risk_level) === "high" ? "bg-red-500" : String(r.risk_level) === "medium" ? "bg-amber-500" : "bg-green-500"}`} />
                        <span className="text-xs font-medium capitalize">{String(r.event_type).replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-xs font-mono font-black">{String(r.risk_score)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Device Intelligence</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Unique Devices</span>
                  <span className="text-lg font-black">{(result.uniqueDevices as string[])?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Unique IPs</span>
                  <span className="text-lg font-black">{(result.uniqueIps as string[])?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                  <span className="text-sm text-muted-foreground">Unique Locations</span>
                  <span className="text-lg font-black">{(result.uniqueLocations as string[])?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <span className="text-sm font-bold text-red-700">Failed Logins (1h)</span>
                  <span className="text-lg font-black text-red-600">{result.failedLoginCount1h as number ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : !loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20">
          <Search className="size-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-black text-muted-foreground">Search for a User</p>
          <p className="text-sm text-muted-foreground mt-1">Enter a User ID, email address, or name to begin a security investigation</p>
        </div>
      ) : null}
    </div>
  );
}
