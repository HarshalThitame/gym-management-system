import type { Metadata } from "next";
import { Brain, Dumbbell, Target, UsersRound, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { StatCard } from "@/components/ui/stat-card";
import { AiProgramGeneratorForm } from "@/features/ai/components/ai-forms";
import { AiReviewBadge, AiRiskBadge } from "@/features/ai/components/ai-status-badge";
import { getTrainerAiDashboard } from "@/features/ai/services/ai-service";
import { requireTrainerPortalAccess } from "@/features/trainer/lib/access";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Trainer AI Assistant",
  description: "AI trainer assistant for member risk, program drafts, and coaching recommendations.",
  path: "/trainer/ai"
});

export default async function TrainerAiPage() {
  const context = await requireTrainerPortalAccess("/trainer/ai");
  const dashboard = context.userId ? await getTrainerAiDashboard(context.userId, context.profile?.gym_id ?? null) : null;
  const highRisk = dashboard?.riskMembers.filter((member) => (member.churn_risk_score ?? 0) >= 60).length ?? 0;

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainer" }, { label: "AI Assistant" }]} />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Trainer Intelligence</p>
        <h2 className="mt-2 text-3xl font-black">AI-assisted coaching operations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Prioritize members who need outreach, review supervised recommendations, and draft workout programs for approval.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard detail={dashboard?.trainer?.display_name ?? "No trainer record"} icon={<Brain className="size-5" />} label="Assistant" value={dashboard?.trainer ? "Active" : "Unavailable"} />
        <StatCard detail="Assigned members with elevated churn risk" icon={<UsersRound className="size-5" />} label="High Risk" value={String(highRisk)} />
        <StatCard detail="AI-generated drafts awaiting review" icon={<Dumbbell className="size-5" />} label="Program Drafts" value={String(dashboard?.programDrafts.length ?? 0)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="size-5" />
              <h3 className="text-2xl font-black">Member Risk and Recommendations</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(dashboard?.riskMembers ?? []).length > 0 ? (
              (dashboard?.riskMembers ?? []).slice(0, 12).map((member) => (
                <div className="rounded-lg border border-border bg-surface-muted p-4" key={member.member_id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{member.full_name}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{member.member_code} · Engagement {member.engagement_score ?? 0}% · Risk {member.churn_risk_score ?? 0}%</p>
                    </div>
                    <AiRiskBadge risk={member.churn_risk_category} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">No AI risk profiles are available yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="size-5" />
              <h3 className="text-2xl font-black">Program Generator</h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Creates trainer-review drafts from the signed-in trainer/member context. Approval is required before assignment.</p>
          </CardHeader>
          <CardContent><AiProgramGeneratorForm /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h3 className="text-2xl font-black">Recent AI Recommendations</h3></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(dashboard?.recommendations ?? []).slice(0, 9).map((recommendation) => (
            <div className="rounded-lg border border-border bg-surface-muted p-4" key={recommendation.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{recommendation.recommendation_type}</p>
                <AiReviewBadge status={recommendation.status} />
              </div>
              <h4 className="mt-2 font-black">{recommendation.title}</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
