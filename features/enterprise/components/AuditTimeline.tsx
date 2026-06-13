"use client";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

export function AuditTimeline({ configId }: { configId: string }) {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/enterprise/branding/history?configId=${configId}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.data?.auditLog ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [configId]);

  if (loading) return <div className="space-y-1">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />)}</div>;
  if (events.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">No events recorded yet.</p>;

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {events.map((e, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 text-xs">
          <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          <span className="text-muted-foreground font-medium capitalize">{(e.event_type as string) ?? ""}</span>
          {!!(e.reason as string) && <span className="text-muted-foreground truncate max-w-[200px]">— {(e.reason as string) ?? ""}</span>}
          <span className="ml-auto text-muted-foreground shrink-0">{e.created_at ? new Date(e.created_at as string).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : ""}</span>
        </div>
      ))}
    </div>
  );
}
