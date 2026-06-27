"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SupportInbox } from "@/features/support/components/support-inbox";
import { SupportAnalytics } from "@/features/support/components/support-analytics";
import { SupportSlaDashboard } from "@/features/support/components/support-sla-dashboard";
import type { TicketWithRelations, SupportDashboard, SupportSlaPolicyRow } from "@/types/enterprise";
import type { SavedView } from "@/features/support/services/support-saved-views-service";
import type { AgentWithWorkload } from "@/features/support/services/support-assignment-service";

export function SupportPageClient({
  ticketResult,
  dashboard,
  slaPolicies,
  slaStats,
  views: initialViews,
  agents,
  currentUserId,
}: {
  ticketResult: { tickets: TicketWithRelations[]; total: number; page: number; pageSize: number };
  dashboard: SupportDashboard;
  slaPolicies: SupportSlaPolicyRow[];
  slaStats: { totalTickets: number; breachedCount: number; atRiskCount: number; slaCompliancePercent: number };
  views: SavedView[];
  agents: AgentWithWorkload[] | undefined;
  currentUserId: string | undefined;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"inbox" | "analytics" | "sla">("inbox");
  const [savedViews, setSavedViews] = useState<SavedView[]>(initialViews);
  const [activeViewId, setActiveViewId] = useState<string | undefined>();

  const handleSaveView = useCallback(async (name: string) => {
    try {
      const res = await fetch("/api/support/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters: {} }),
      });
      const data = await res.json();
      if (data.ok) {
        setSavedViews((prev) => [...prev, data.data]);
        router.refresh();
      }
    } catch {}
  }, [router]);

  const handleDeleteView = useCallback(async (viewId: string) => {
    try {
      await fetch(`/api/support/views?id=${viewId}`, { method: "DELETE" });
      setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
      if (activeViewId === viewId) setActiveViewId(undefined);
      router.refresh();
    } catch {}
  }, [router, activeViewId]);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-border">
        {(["inbox", "analytics", "sla"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab === "inbox" ? "Ticket Inbox" : tab === "analytics" ? "Analytics" : "SLA Dashboard"}
          </button>
        ))}
      </div>

      {activeTab === "inbox" && (
        <SupportInbox
          tickets={ticketResult.tickets}
          total={ticketResult.total}
          page={ticketResult.page}
          pageSize={ticketResult.pageSize}
          onRefresh={handleRefresh}
          savedViews={savedViews}
          activeViewId={activeViewId}
          onSelectView={(v) => setActiveViewId(v.id)}
          onSaveView={handleSaveView}
          onDeleteView={handleDeleteView}
          agents={agents}
          currentUserId={currentUserId}
        />
      )}

      {activeTab === "analytics" && <SupportAnalytics dashboard={dashboard} />}

      {activeTab === "sla" && <SupportSlaDashboard policies={slaPolicies} slaStats={slaStats} />}
    </div>
  );
}
