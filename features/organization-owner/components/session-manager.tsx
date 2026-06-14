"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, Monitor, Smartphone, ShieldCheck, XCircle } from "lucide-react";
import { showToast } from "@/components/ui/toast";

type Session = {
  id: string;
  createdAt: string;
  lastActive: string;
  userAgent: string;
  ip: string;
  isCurrent: boolean;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
};

type SessionManagerProps = {
  userId: string;
};

function detectDevice(ua: string): Session["deviceType"] {
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/windows|mac|linux/i.test(ua)) return "desktop";
  return "unknown";
}

export function SessionManager({ userId }: SessionManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminating, setTerminating] = useState<string | null>(null);

  useEffect(() => {
    // Simulated session data — in production, fetch from auth.sessions
    setSessions([
      { id: "1", createdAt: new Date().toISOString(), lastActive: new Date().toISOString(), userAgent: navigator.userAgent, ip: "Current device", isCurrent: true, deviceType: detectDevice(navigator.userAgent) },
      { id: "2", createdAt: new Date(Date.now() - 86400000).toISOString(), lastActive: new Date(Date.now() - 3600000).toISOString(), userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120", ip: "203.0.113.42", isCurrent: false, deviceType: "desktop" },
      { id: "3", createdAt: new Date(Date.now() - 172800000).toISOString(), lastActive: new Date(Date.now() - 7200000).toISOString(), userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605", ip: "198.51.100.73", isCurrent: false, deviceType: "mobile" },
    ]);
    setLoading(false);
  }, []);

  const terminateSession = useCallback(async (sessionId: string) => {
    setTerminating(sessionId);
    // In production: call server action to revoke session
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setTerminating(null);
    showToast("Session terminated", "success");
  }, []);

  const terminateAllOthers = useCallback(async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    setLoading(false);
    showToast("Other sessions terminated", "success");
  }, []);

  const DeviceIcon = ({ type }: { type: Session["deviceType"] }) => {
    if (type === "mobile") return <Smartphone className="size-5" />;
    if (type === "tablet") return <Smartphone className="size-5" />;
    return <Monitor className="size-5" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-muted-foreground">{sessions.length} active session{sessions.length !== 1 ? "s" : ""}</p>
        {sessions.length > 1 ? (
          <button className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100" onClick={terminateAllOthers} type="button">
            <XCircle className="size-3.5" /> Sign out others
          </button>
        ) : null}
      </div>

      {sessions.map((session) => (
        <div key={session.id} className={`rounded-lg border p-4 ${session.isCurrent ? "border-accent bg-accent/5" : "border-border bg-surface"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 text-muted-foreground"><DeviceIcon type={session.deviceType} /></div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{session.deviceType === "mobile" ? "Mobile" : session.deviceType === "tablet" ? "Tablet" : "Desktop"}</p>
                  {session.isCurrent ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Current</span> : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{session.ip}</p>
                <p className="text-xs text-muted-foreground">
                  Last active: {new Date(session.lastActive).toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{session.userAgent.slice(0, 60)}...</p>
              </div>
            </div>
            {!session.isCurrent ? (
              <button
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:border-border-strong hover:text-foreground disabled:opacity-40"
                disabled={terminating === session.id}
                onClick={() => terminateSession(session.id)}
                type="button"
              >
                {terminating === session.id ? <Loader2 className="size-3 animate-spin" /> : <LogOut className="size-3" />}
                Terminate
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
