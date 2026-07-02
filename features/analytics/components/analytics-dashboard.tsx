"use client";

import { useState } from "react";
import { BarChart3, TrendingUp, Plus, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createFunnelAction, createReportAction } from "../actions/analytics-actions";

interface EventStat {
  event_type: string;
  event_name: string;
  count: number;
}

interface Funnel {
  id: string;
  name: string;
  description: string | null;
  steps: unknown;
}

interface Report {
  id: string;
  name: string;
  report_type: string;
  description: string | null;
}

type Props = {
  stats: EventStat[];
  funnels: Funnel[];
  reports: Report[];
};

export function AnalyticsDashboard({ stats, funnels, reports }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "funnels" | "reports">("overview");
  const [funnelName, setFunnelName] = useState("");
  const [reportName, setReportName] = useState("");

  const handleCreateFunnel = async () => {
    if (!funnelName) return;
    const formData = new FormData();
    formData.set("name", funnelName);
    formData.set("steps", JSON.stringify([]));
    await createFunnelAction(formData);
    setFunnelName("");
  };

  const handleCreateReport = async () => {
    if (!reportName) return;
    const formData = new FormData();
    formData.set("name", reportName);
    formData.set("reportType", "custom");
    formData.set("config", JSON.stringify({}));
    await createReportAction(formData);
    setReportName("");
  };

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "funnels" as const, label: "Funnels" },
    { key: "reports" as const, label: "Reports" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === tab.key ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="size-5 text-accent" />
                  <div>
                    <p className="text-2xl font-black">{stats.length}</p>
                    <p className="text-xs text-muted-foreground">Event Types</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="size-5 text-accent" />
                  <div>
                    <p className="text-2xl font-black">{funnels.length}</p>
                    <p className="text-xs text-muted-foreground">Funnels</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className="size-5 text-accent" />
                  <div>
                    <p className="text-2xl font-black">{reports.length}</p>
                    <p className="text-xs text-muted-foreground">Reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Event Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No events recorded yet. Events will appear here as they are tracked.</p>
              ) : (
                <div className="space-y-2">
                  {stats.map((stat) => (
                    <div key={stat.event_type} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{stat.event_name || stat.event_type}</p>
                        <p className="text-xs text-muted-foreground">{stat.event_type}</p>
                      </div>
                      <span className="text-sm font-mono">{stat.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "funnels" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conversion Funnels</CardTitle>
              <div className="flex gap-2">
                <input
                  placeholder="Funnel name"
                  value={funnelName}
                  onChange={(e) => setFunnelName(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded border border-border bg-background w-40"
                />
                <Button size="sm" variant="accent" onClick={handleCreateFunnel}>
                  <Plus className="size-4 mr-1" /> Create
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {funnels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No funnels created. Create a funnel to track conversion steps.</p>
            ) : (
              <div className="space-y-2">
                {funnels.map((funnel) => (
                  <div key={funnel.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">{funnel.name}</p>
                      {funnel.description && <p className="text-xs text-muted-foreground">{funnel.description}</p>}
                    </div>
                    <Button size="sm" variant="ghost">
                      <Filter className="size-4 mr-1" /> View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "reports" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Saved Reports</CardTitle>
              <div className="flex gap-2">
                <input
                  placeholder="Report name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded border border-border bg-background w-40"
                />
                <Button size="sm" variant="accent" onClick={handleCreateReport}>
                  <Plus className="size-4 mr-1" /> Create
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No reports created. Create a report to save your analytics configurations.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{report.report_type} report</p>
                    </div>
                    <Button size="sm" variant="ghost">View</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
