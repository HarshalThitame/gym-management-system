"use client";

import { Bot, Loader2, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import {
  generateAiContentDraftAction,
  generateExecutiveInsightAction,
  generateMyAiProfileAction,
  generateNutritionGuidanceAction,
  generateTrainerProgramAction,
  reviewAiRecommendationAction
} from "../actions/ai-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function AiCoachChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitMessage() {
    const trimmed = message.trim();
    if (!trimmed || isPending) {
      return;
    }

    setIsPending(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setMessage("");

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: trimmed, sessionId })
    }).catch(() => null);

    if (!response?.ok) {
      setError("AI coach is unavailable right now.");
      setIsPending(false);
      return;
    }

    const body = await response.json() as { data?: { reply?: string; sessionId?: string } };
    if (body.data?.sessionId) {
      setSessionId(body.data.sessionId);
    }
    if (body.data?.reply) {
      setMessages((current) => [...current, { role: "assistant", content: body.data?.reply ?? "" }]);
    }
    setIsPending(false);
  }

  return (
    <div className="space-y-4">
      <div className="min-h-72 space-y-3 rounded-lg border border-border bg-surface-muted p-3">
        {messages.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <Bot aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">Ask about your workout plan, nutrition habits, progress, or next best action.</p>
          </div>
        ) : messages.map((item, index) => (
          <div className={item.role === "user" ? "ml-auto max-w-[88%] rounded-lg bg-primary p-3 text-primary-foreground" : "mr-auto max-w-[88%] rounded-lg border border-border bg-surface p-3"} key={`${item.role}-${index}`}>
            <p className="whitespace-pre-wrap text-sm leading-6">{item.content}</p>
          </div>
        ))}
      </div>
      {error ? <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Textarea
          aria-label="AI coach message"
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              submitMessage();
            }
          }}
          placeholder="Ask the AI coach what to focus on this week."
          value={message}
        />
        <Button disabled={isPending || !message.trim()} onClick={submitMessage} type="button" variant="accent">
          {isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Send aria-hidden="true" className="size-4" />}
          Send
        </Button>
      </div>
    </div>
  );
}

export function GenerateAiProfileForm() {
  const [state, formAction] = useActionState(generateMyAiProfileAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <AuthSubmitButton>Refresh AI Profile</AuthSubmitButton>
    </form>
  );
}

export function NutritionGuidanceForm({ activeGoal = "general fitness" }: { activeGoal?: string }) {
  const [state, formAction] = useActionState(generateNutritionGuidanceAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <Input name="goal" defaultValue={activeGoal} aria-label="Nutrition goal" />
      <AuthSubmitButton>Generate Nutrition Guidance</AuthSubmitButton>
    </form>
  );
}

export function AiProgramGeneratorForm() {
  const [state, formAction] = useActionState(generateTrainerProgramAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-3 md:grid-cols-2">
        <select className={selectClass} name="level" defaultValue="beginner" aria-label="Program level">
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <Input name="weeks" type="number" min="1" max="16" defaultValue="4" aria-label="Program weeks" />
      </div>
      <AuthSubmitButton>Generate Program Draft</AuthSubmitButton>
    </form>
  );
}

export function AiContentDraftForm() {
  const [state, formAction] = useActionState(generateAiContentDraftAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-3 md:grid-cols-2">
        <select className={selectClass} name="draftType" defaultValue="announcement" aria-label="Draft type">
          <option value="announcement">Announcement</option>
          <option value="campaign_email">Campaign Email</option>
          <option value="whatsapp_message">WhatsApp Message</option>
          <option value="promotion">Promotion</option>
          <option value="report_summary">Report Summary</option>
        </select>
        <Input name="audience" placeholder="Active members, expired members, PT clients" />
      </div>
      <Textarea name="brief" placeholder="Describe the offer, update, campaign, or report summary you want AI to draft." />
      <AuthSubmitButton>Create Draft</AuthSubmitButton>
    </form>
  );
}

export function ExecutiveInsightForm() {
  const [state, formAction] = useActionState(generateExecutiveInsightAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <AuthSubmitButton>Generate Executive Insight</AuthSubmitButton>
    </form>
  );
}

export function AiRecommendationReviewForm({ recommendationId }: { recommendationId: string }) {
  const [state, formAction] = useActionState(reviewAiRecommendationAction, initialAuthActionState);
  return (
    <form action={formAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
      <FormMessage state={state} />
      <input name="recommendationId" type="hidden" value={recommendationId} />
      <select className={selectClass} name="status" defaultValue="approved" aria-label="Recommendation review status">
        <option value="approved">Approve</option>
        <option value="rejected">Reject</option>
        <option value="applied">Mark Applied</option>
        <option value="archived">Archive</option>
      </select>
      <Input name="note" placeholder="Review note" />
      <Button type="submit" variant="secondary">Review</Button>
      <FieldError message={state.fieldErrors?.status?.[0]} />
    </form>
  );
}
