"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Phone, Mail, TrendingUp, Target, Clock, BarChart3, RefreshCw, ArrowRight, Filter } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import type { LeadRow } from "@/features/organization-owner/services/lead-service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { showToast } from "@/components/ui/toast";
import { formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import {
  getPipelineView,
  getConversionForecast,
  updateLeadStatus,
  type PipelineColumn,
  type ConversionForecast,
} from "@/features/organization-owner/actions/lead-actions";

type Props = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
  onOpenDetail?: (lead: LeadRow) => void;
};

const PIPELINE_STAGES = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-amber-500" },
  { key: "trial_scheduled", label: "Trial Scheduled", color: "bg-purple-500" },
  { key: "trial_attended", label: "Trial Attended", color: "bg-indigo-500" },
  { key: "negotiation", label: "Negotiation", color: "bg-orange-500" },
  { key: "converted", label: "Won", color: "bg-green-500" },
  { key: "lost", label: "Lost", color: "bg-red-500" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All Sources" },
  { value: "website", label: "Website" },
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "other", label: "Other" },
  { value: "free_trial", label: "Free Trial" },
  { value: "membership_inquiry", label: "Inquiry" },
  { value: "contact", label: "Contact" },
];

function getScoreColor(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    website: "Website", walk_in: "Walk-in", phone: "Phone",
    referral: "Referral", social_media: "Social Media", other: "Other",
    free_trial: "Free Trial", membership_inquiry: "Inquiry", contact: "Contact",
  };
  return map[source] ?? source;
}

export function LeadPipelinePanel({ dashboard, hasFeature, onOpenDetail }: Props) {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [forecast, setForecast] = useState<ConversionForecast | null>(null);
  const [metrics, setMetrics] = useState({ total: 0, conversionRate: 0, avgDaysToConvert: null as number | null });
  const [loading, setLoading] = useState(true);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("all");

  const orgId = dashboard.organization.id;

  const fetchPipeline = useCallback(async () => {
    if (!hasFeature) return;
    setLoading(true);
    try {
      const [pipeResult, forecastResult] = await Promise.all([
        getPipelineView(orgId),
        getConversionForecast(orgId),
      ]);
      setColumns(pipeResult.columns);
      setMetrics({ total: pipeResult.total, conversionRate: pipeResult.conversionRate, avgDaysToConvert: pipeResult.avgDaysToConvert });
      setForecast(forecastResult);
    } catch {
      showToast("Failed to load pipeline", "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, hasFeature]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleMoveLead = useCallback(async (leadId: string, newStatus: string) => {
    setMovingLeadId(leadId);
    try {
      await updateLeadStatus(orgId, leadId, newStatus);
      await fetchPipeline();
      showToast("Lead moved", "success");
    } catch {
      showToast("Failed to move lead", "error");
    } finally {
      setMovingLeadId(null);
    }
  }, [orgId, fetchPipeline]);

  const filteredColumns = useMemo(() => {
    if (sourceFilter === "all") return columns;
    return columns.map((col) => ({
      ...col,
      leads: col.leads.filter((l) => (l.source as string) === sourceFilter),
      count: col.leads.filter((l) => (l.source as string) === sourceFilter).length,
    }));
  }, [columns, sourceFilter]);

  if (!hasFeature) {
    return (
      <EmptyState
        type="no_data"
        title="Pipeline View"
        description="Upgrade to the Enterprise plan to access the pipeline view."
      />
    );
  }

  const wonColumn = columns.find((c) => c.status === "converted");

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Total leads in pipeline" icon={<BarChart3 className="size-5" />} label="Total Leads" value={formatCompactNumber(metrics.total)} />
        <StatCard detail="Lead conversion rate" icon={<TrendingUp className="size-5" />} label="Conversion Rate" value={`${metrics.conversionRate}%`} />
        <StatCard detail="Average days from lead to won" icon={<Clock className="size-5" />} label="Avg Days to Convert" value={metrics.avgDaysToConvert ? `${metrics.avgDaysToConvert}d` : "—"} />
        <StatCard detail={`${forecast?.confidencePercent ?? 0}% confidence · based on last ${forecast?.basedOnPeriodDays ?? 90}d`} icon={<Target className="size-5" />} label="Forecast" value={forecast ? `${forecast.estimatedConversions}` : "—"} />
      </section>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {wonColumn ? `${wonColumn.count} won / ${metrics.total} total` : "No data"}
          </p>
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground shadow-sm focus:border-primary focus:outline-none"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              {SOURCE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={fetchPipeline} disabled={loading} size="sm" variant="secondary">
          <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {!loading && metrics.total === 0 ? (
        <EmptyState
          type="no_data"
          title="No leads in pipeline"
          description="Leads will appear here as they are added."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {PIPELINE_STAGES.map((stage) => {
            const col = filteredColumns.find((c) => c.status === stage.key) ?? { status: stage.key, leads: [] as LeadRow[], count: 0 };
            return (
              <div key={stage.key} className="flex flex-col rounded-lg border border-border bg-surface-muted min-h-[200px]">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                  <span className={`size-2.5 rounded-full shrink-0 ${stage.color}`} />
                  <h3 className="text-sm font-bold flex-1">{stage.label}</h3>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    {col.count}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 p-2">
                  {col.leads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onOpenDetail?.(lead)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`size-2 rounded-full shrink-0 ${getScoreColor(lead.lead_score ?? 0)}`} title={`Score: ${lead.lead_score ?? 0}`} />
                          <span className="text-sm font-bold truncate">{lead.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Phone className="size-3 shrink-0" />
                          <span className="truncate">{lead.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {sourceLabel(lead.source as string)}
                          </span>
                          {lead.email ? (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Mail className="size-2.5" />
                            </span>
                          ) : null}
                        </div>
                        {lead.last_contacted_at ? (
                          <p className="text-[10px] text-muted-foreground mb-1">
                            Last contact: {new Date(lead.last_contacted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                        ) : null}
                        <div className="pt-1.5 border-t border-border">
                          <div className="flex flex-wrap gap-1">
                            {PIPELINE_STAGES.filter((s) => s.key !== stage.key).map((s) => (
                              <button
                                key={s.key}
                                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium hover:bg-surface-muted transition ${movingLeadId === lead.id ? "opacity-50 pointer-events-none" : ""}`}
                                onClick={(e) => { e.stopPropagation(); handleMoveLead(lead.id, s.key); }}
                                title={`Move to ${s.label}`}
                                type="button"
                                disabled={movingLeadId === lead.id}
                              >
                                <ArrowRight className="size-2.5" />
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {col.leads.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No leads</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
