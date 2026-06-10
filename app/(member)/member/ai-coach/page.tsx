import type { Metadata } from "next";
import { Bot, Brain, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { AiCoachChatPanel, GenerateAiProfileForm, NutritionGuidanceForm } from "@/features/ai/components/ai-forms";
import { AiReviewBadge, AiRiskBadge } from "@/features/ai/components/ai-status-badge";
import { getMemberAiDashboard } from "@/features/ai/services/ai-service";
import { calculateChurnRiskScore, calculateEngagementScore, inferFitnessLevel } from "@/features/ai/lib/business-rules";
import { requireRole } from "@/lib/auth/guards";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "AI Coach",
  description: "AI-powered fitness profile, coaching chat, recommendations, and progress guidance.",
  path: "/member/ai-coach"
});

export default async function MemberAiCoachPage() {
  const context = await requireRole(["member", "super_admin"], "/member/ai-coach");
  const dashboard = context.userId ? await getMemberAiDashboard(context.userId) : null;
  const aiContext = dashboard?.context ?? null;
  const engagement = aiContext ? calculateEngagementScore(aiContext.signals) : 0;
  const churnRisk = aiContext ? calculateChurnRiskScore(aiContext.signals) : 0;
  const level = aiContext ? inferFitnessLevel(aiContext) : "beginner";
  const activeGoal = aiContext?.goals.find((goal) => goal.status === "active")?.title ?? "general fitness";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">AI Fitness Intelligence</p>
        <h2 className="mt-2 text-3xl font-black">Personal coaching with human supervision</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">AI analyzes your goals, attendance, workouts, measurements, nutrition logs, and class participation to suggest next actions. Staff review is required for plan changes.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Fitness profile score" icon={<Brain className="size-5" />} label="Engagement" value={`${engagement}%`} />
        <StatCard detail="Lower is better" icon={<ShieldCheck className="size-5" />} label="Churn Risk" value={`${churnRisk}%`} />
        <StatCard detail="Inferred from recent activity" icon={<Sparkles className="size-5" />} label="Level" value={level} />
        <StatCard detail="Active goal context" icon={<Target className="size-5" />} label="Goal" value={activeGoal} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-black">AI Coach Chat</h3>
              <AiRiskBadge risk={dashboard?.fitnessProfile?.churn_risk_category ?? "low"} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">Ask for workout guidance, nutrition education, progress explanations, or habit support. Medical concerns should go to qualified professionals.</p>
          </CardHeader>
          <CardContent>
            <AiCoachChatPanel />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Profile Engine</h3>
              <p className="text-sm leading-6 text-muted-foreground">Refresh your AI fitness profile and create supervised recommendations from current platform data.</p>
            </CardHeader>
            <CardContent><GenerateAiProfileForm /></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-2xl font-black">Nutrition Assistant</h3>
              <p className="text-sm leading-6 text-muted-foreground">Generate educational nutrition guidance for review, not medical diet therapy.</p>
            </CardHeader>
            <CardContent><NutritionGuidanceForm activeGoal={activeGoal} /></CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="size-5" />
            <h3 className="text-2xl font-black">Smart Recommendations</h3>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(dashboard?.recommendations ?? []).map((recommendation) => (
            <div className="rounded-lg border border-border bg-surface-muted p-4" key={recommendation.title}>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{recommendation.type}</p>
              <h4 className="mt-2 font-black">{recommendation.title}</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.summary}</p>
              <p className="mt-3 text-xs font-bold text-muted-foreground">Confidence {recommendation.confidence}% · Priority {recommendation.priority}</p>
            </div>
          ))}
          {(dashboard?.storedRecommendations ?? []).slice(0, 3).map((recommendation) => (
            <div className="rounded-lg border border-border bg-surface p-4" key={recommendation.id}>
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
