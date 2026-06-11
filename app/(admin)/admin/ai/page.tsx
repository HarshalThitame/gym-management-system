import type { Metadata } from "next";
import { Bot, Brain, LineChart, ShieldCheck } from "lucide-react";
import FeatureLocked from "@/components/ui/FeatureLocked";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { AiContentDraftForm, AiRecommendationReviewForm, ExecutiveInsightForm } from "@/features/ai/components/ai-forms";
import { AiReviewBadge, AiRiskBadge, AiSeverityBadge } from "@/features/ai/components/ai-status-badge";
import { getAdminAiDashboard } from "@/features/ai/services/ai-service";
import { requireGymAdminScope } from "@/features/admin/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";

export const metadata: Metadata = createMetadata({
  title: "AI Intelligence",
  description: "AI executive insights, predictive analytics, retention intelligence, and content assistant.",
  path: "/admin/ai"
});

export default async function AdminAiPage() {
  const scope = await requireGymAdminScope("/admin/ai");
  const organizationId = scope.scopedOrganizationId ?? scope.organizationId;
  const planContext = organizationId ? await getOrgPlanContext(organizationId) : null;

  if (!planContext?.features.aiEnabled) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">AI Operations</p>
          <h2 className="mt-2 text-3xl font-black">Predictive intelligence and supervised automation</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Executive insights, churn prediction, revenue forecasting, content generation, and AI observability with human approval controls.</p>
        </div>
        <FeatureLocked
          description="AI insights, content generation, retention recommendations, and supervised automation are available on Premium."
          featureName="AI Intelligence"
          requiredPlan="Premium"
        />
      </div>
    );
  }

  const dashboard = await getAdminAiDashboard(scope.gymId);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">AI Operations</p>
        <h2 className="mt-2 text-3xl font-black">Predictive intelligence and supervised automation</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Executive insights, churn prediction, revenue forecasting, content generation, and AI observability with human approval controls.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <StatCard detail={metric.detail} icon={<Brain className="size-5" />} key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LineChart className="size-5" />
              <h3 className="text-2xl font-black">Forecasting</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {dashboard.forecasts.map((forecast) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={forecast.key}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{forecast.horizonDays} day forecast</p>
                <p className="mt-2 text-2xl font-black">{forecast.forecastValue}</p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{forecast.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Range {forecast.lowerBound}-{forecast.upperBound} · Confidence {forecast.confidence}%</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              <h3 className="text-2xl font-black">AI Observability</h3>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold">Requests: {dashboard.observability.totalRequests}</p>
            <p className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold">Fallback rate: {dashboard.observability.fallbackRate}%</p>
            <p className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold">Average latency: {dashboard.observability.averageLatencyMs}ms</p>
            <p className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold">Blocked requests: {dashboard.observability.blockedRequests}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-2xl font-black">Executive Insights</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <ExecutiveInsightForm />
            {dashboard.insights.slice(0, 6).map((insight) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={insight.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-black">{insight.title}</h4>
                  <AiSeverityBadge severity={insight.severity} />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight.summary}</p>
                <p className="mt-2 text-sm font-semibold">{insight.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="size-5" />
              <h3 className="text-2xl font-black">Content Assistant</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Draft announcements, campaign emails, WhatsApp messages, promotions, and report summaries for human review.</p>
          </CardHeader>
          <CardContent><AiContentDraftForm /></CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader><h3 className="text-2xl font-black">Retention Recommendations</h3></CardHeader>
          <CardContent className="space-y-4">
            {dashboard.recommendations.slice(0, 8).map((recommendation) => (
              <div className="rounded-lg border border-border bg-surface-muted p-4" key={recommendation.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{recommendation.recommendation_type}</p>
                    <h4 className="mt-2 font-black">{recommendation.title}</h4>
                  </div>
                  <AiReviewBadge status={recommendation.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.summary}</p>
                <div className="mt-4"><AiRecommendationReviewForm recommendationId={recommendation.id} /></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-2xl font-black">Churn Risk Members</h3></CardHeader>
          <CardContent className="space-y-3">
            {dashboard.riskMembers.slice(0, 12).map((member) => (
              <div className="rounded-md border border-border bg-surface-muted p-3" key={member.member_id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{member.full_name}</p>
                    <p className="text-xs font-semibold text-muted-foreground">Engagement {member.engagement_score ?? 0}% · Risk {member.churn_risk_score ?? 0}%</p>
                  </div>
                  <AiRiskBadge risk={member.churn_risk_category} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
