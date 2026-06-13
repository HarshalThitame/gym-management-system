"use client";

import { useState, useEffect } from "react";
import { Eye, MessageSquare, Paperclip } from "lucide-react";

type Viewer = { userId: string; userName: string; lastSeenAt: string };
type TimelineEntry = {
  id: string;
  type: string;
  channel?: string;
  sender: string;
  body: string;
  isInternal?: boolean;
  createdAt: string;
};

export function SupportCollaborationSidebar({
  ticketId,
}: {
  ticketId: string;
}) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"viewers" | "timeline">("viewers");

  useEffect(() => {
    const fetchViewers = async () => {
      try {
        const res = await fetch(`/api/support/collaboration/viewers?ticketId=${ticketId}`);
        const data = await res.json();
        if (data.ok) setViewers(data.data.viewers);
      } catch {}
    };

    fetchViewers();
    const interval = setInterval(fetchViewers, 15000);
    return () => clearInterval(interval);
  }, [ticketId]);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/support/timeline?ticketId=${ticketId}`);
        const data = await res.json();
        if (data.ok) setTimeline(data.data.entries);
      } catch {}
    };
    fetchTimeline();
  }, [ticketId]);

  const channelIcon = (ch?: string) => {
    const icons: Record<string, string> = { email: "📧", whatsapp: "💬", sms: "📱", push: "🔔" };
    return ch ? (icons[ch] ?? "💬") : "💬";
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex border-b border-border">
        {(["viewers", "timeline"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {tab === "viewers" ? `Viewers (${viewers.length})` : "Activity"}
          </button>
        ))}
      </div>

      <div className="p-3 max-h-[400px] overflow-y-auto">
        {activeTab === "viewers" && (
          viewers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No other viewers</p>
          ) : (
            <div className="space-y-2">
              {viewers.map((v) => (
                <div key={v.userId} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="truncate">{v.userName}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === "timeline" && (
          timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {timeline.slice(-20).map((entry) => (
                <div key={entry.id} className="flex items-start gap-1.5">
                  <span className="text-xs mt-0.5 shrink-0">
                    {entry.type === "note" ? "📝" : entry.type === "system" ? "⚙️" : channelIcon(entry.channel)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium truncate">{entry.sender}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {entry.isInternal ? "[Internal] " : ""}{entry.body.slice(0, 80)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
