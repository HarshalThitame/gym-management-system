"use client";

import { useState, useTransition, useEffect } from "react";
import { useActionState } from "react";
import { Monitor, Smartphone, Tablet, Globe, Clock, X, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMySessionsAction, revokeSessionAction, revokeAllSessionsAction } from "../actions/security-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";

type Session = {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_name: string | null;
  device_type: string;
  is_active: boolean;
  last_activity_at: string;
  created_at: string;
  expires_at: string;
};

export function SessionManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isPending, startTransition] = useTransition();
  const [revokeState, revokeAction] = useActionState(revokeSessionAction, initialAuthActionState);
  const [revokeAllState, revokeAllAction] = useActionState(revokeAllSessionsAction, initialAuthActionState);

  useEffect(() => {
    startTransition(async () => {
      const data = await getMySessionsAction();
      setSessions(data as Session[]);
    });
  }, []);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "mobile": return <Smartphone className="size-5" />;
      case "tablet": return <Tablet className="size-5" />;
      default: return <Monitor className="size-5" />;
    }
  };

  const parseBrowser = (userAgent: string | null): string => {
    if (!userAgent) return "Unknown";
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    return "Unknown";
  };

  const parseOs = (userAgent: string | null): string => {
    if (!userAgent) return "Unknown";
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Mac")) return "macOS";
    if (userAgent.includes("Linux")) return "Linux";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iOS")) return "iOS";
    return "Unknown";
  };

  const refreshSessions = () => {
    startTransition(async () => {
      const data = await getMySessionsAction();
      setSessions(data as Session[]);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Shield className="size-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg">Active Sessions</CardTitle>
              <CardDescription>
                Manage devices where you&apos;re currently signed in
              </CardDescription>
            </div>
          </div>
          <form action={revokeAllAction}>
            <Button variant="outline" size="sm" type="submit">
              <LogOut className="size-4 mr-1" />
              Sign Out All
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active sessions found.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.filter((s) => s.is_active).map((session, index) => (
              <div
                key={session.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border"
              >
                <div className="shrink-0 p-2 rounded-lg bg-surface-muted">
                  {getDeviceIcon(session.device_type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {session.device_name ?? `${parseBrowser(session.user_agent)} on ${parseOs(session.user_agent)}`}
                    </p>
                    {index === 0 && (
                      <Badge variant="success" className="text-xs">Current</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {session.ip_address && (
                      <span className="flex items-center gap-1">
                        <Globe className="size-3" />
                        {session.ip_address}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      Active {new Date(session.last_activity_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {index !== 0 && (
                  <form action={revokeAction}>
                    <input type="hidden" name="sessionId" value={session.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      <X className="size-4" />
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        <FormMessage state={revokeState} />
        <FormMessage state={revokeAllState} />
      </CardContent>
    </Card>
  );
}
