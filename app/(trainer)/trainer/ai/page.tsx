import type { Metadata } from "next";
import { Brain, Dumbbell, Target, UsersRound, Lightbulb, Sparkles, Lock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { AiProgramGeneratorForm } from "@/features/ai/components/ai-forms";
import { AiReviewBadge, AiRiskBadge } from "@/features/ai/components/ai-status-badge";
import { getTrainerAiDashboard } from "@/features/ai/services/ai-service";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";
import { getOrgPlanContext } from "@/lib/tenant/plan-context";
import { BasicWorkoutSuggestions } from "./client";

export const metadata: Metadata = createMetadata({
  title: "Trainer AI Assistant",
  description: "AI trainer assistant for member risk, program drafts, and coaching recommendations.",
  path: "/trainer/ai"
});

export default async function TrainerAiPage() {
  const context = await requireRole(["trainer"], "/trainer/ai");
  const planContext = context.organizationId ? await getOrgPlanContext(context.organizationId) : null;
  const aiEnabled = planContext?.features.aiEnabled ?? false;

  const dashboard = context.userId && aiEnabled ? await getTrainerAiDashboard(context.userId, context.profile?.gym_id ?? null) : null;
  const highRisk = dashboard?.riskMembers.filter((member) => (member.churn_risk_score ?? 0) >= 60).length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Trainer Intelligence</p>
        <h2 className="mt-2 text-3xl font-black">AI-assisted coaching operations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Prioritize members who need outreach, review supervised recommendations, and draft workout programs for approval.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard detail={dashboard?.trainer?.display_name ?? "No trainer record"} icon={<Brain className="size-5" />} label="Assistant" value={dashboard?.trainer ? "Active" : aiEnabled ? "Unavailable" : "Basic"} />
        <StatCard detail="Assigned members with elevated churn risk" icon={<UsersRound className="size-5" />} label="High Risk" value={String(highRisk)} />
        <StatCard detail="AI-generated drafts awaiting review" icon={<Dumbbell className="size-5" />} label="Program Drafts" value={String(dashboard?.programDrafts.length ?? 0)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="size-5" />
              <h3 className="text-2xl font-black">Member Risk and Recommendations</h3>
              {!aiEnabled && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">Basic</span>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiEnabled ? (
              (dashboard?.riskMembers ?? []).length > 0 ? (
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
              )
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 size-5 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-black text-amber-400">Premium AI Risk Analysis Locked</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Upgrade to Premium for AI-powered churn prediction, engagement scoring, and automated risk categorization.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface-muted p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Basic Workout Suggestions</p>
                  <BasicWorkoutSuggestions />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="size-5" />
              <h3 className="text-2xl font-black">Program Generator</h3>
              {!aiEnabled && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">Basic</span>}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {aiEnabled
                ? "Creates trainer-review drafts from the signed-in trainer/member context. Approval is required before assignment."
                : "Basic program suggestions based on common training templates. Upgrade to Premium for AI-generated personalized programs."}
            </p>
          </CardHeader>
          <CardContent>
            {aiEnabled ? (
              <AiProgramGeneratorForm />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
                  <Lock className="size-5 text-amber-400" />
                  <p className="text-sm font-semibold text-muted-foreground">Premium feature — upgrade to unlock AI-powered program generation.</p>
                </div>
                <BasicWorkoutSuggestions showCard={false} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {aiEnabled && (
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
      )}
    </div>
  );
}
