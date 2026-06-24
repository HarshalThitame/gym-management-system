"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { submitNPSResponse } from "@/features/organization-owner/actions/nps-actions";
import { cn } from "@/lib/utils";

export function NPSSurveyForm({
  surveyId,
  memberId,
  question,
  thankYouMessage,
  alreadyResponded,
}: {
  surveyId: string;
  memberId: string | undefined;
  question: string;
  thankYouMessage: string;
  alreadyResponded: boolean;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    category?: string;
  } | null>(null);

  const handleSubmit = async () => {
    if (score === null) {
      showToast("Please select a score (0-10)", "error");
      return;
    }
    if (!memberId) {
      showToast("Unable to verify your membership. Please log in.", "error");
      return;
    }
    setSubmitting(true);
    const response = await submitNPSResponse(
      surveyId,
      memberId,
      score,
      feedback || undefined,
      "in_app",
    );
    setResult(response);
    setSubmitting(false);
  };

  if (alreadyResponded || result?.message?.includes("already submitted")) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <svg className="size-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-black text-green-800 dark:text-green-300">
          {thankYouMessage || "Thank You!"}
        </h2>
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
          You&apos;ve already submitted your feedback for this survey.
        </p>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <svg className="size-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-black text-green-800 dark:text-green-300">
          {thankYouMessage || "Thank You!"}
        </h2>
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
          {result.message}
        </p>
        {result.category && (
          <span
            className={cn(
              "mt-3 inline-flex rounded-full px-3 py-0.5 text-xs font-bold capitalize",
              result.category === "promoter"
                ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                : result.category === "passive"
                  ? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
                  : "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200",
            )}
          >
            {result.category}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-6">
        <label className="mb-4 block text-sm font-bold text-muted-foreground">
          {question || "How likely are you to recommend us? (0 = Not at all, 10 = Extremely likely)"}
        </label>
        <div className="flex flex-wrap gap-2 justify-center">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              className={cn(
                "flex size-10 items-center justify-center rounded-md text-sm font-bold transition-all",
                score === n
                  ? n >= 9
                    ? "bg-green-600 text-white ring-2 ring-green-300"
                    : n >= 7
                      ? "bg-amber-500 text-white ring-2 ring-amber-300"
                      : n <= 6
                        ? "bg-red-600 text-white ring-2 ring-red-300"
                        : "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "border border-border bg-background hover:border-primary hover:text-primary",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {score !== null && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Your score:{" "}
            <span
              className={cn(
                "font-bold",
                score >= 9
                  ? "text-green-600"
                  : score >= 7
                    ? "text-amber-500"
                    : "text-red-600",
              )}
            >
              {score}
            </span>
            {" "}—{" "}
            {score >= 9
              ? "Promoter"
              : score >= 7
                ? "Passive"
                : "Detractor"}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="nps-feedback">
          Additional Feedback (optional)
        </label>
        <textarea
          id="nps-feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us more about your experience..."
          rows={3}
          className="h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || score === null || !memberId}
        className="w-full"
        size="lg"
        variant="primary"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Submitting...
          </>
        ) : (
          <>
            <Send className="size-4" /> Submit Feedback
          </>
        )}
      </Button>

      {!memberId && (
        <p className="text-center text-sm text-amber-500">
          Please log in as a member to submit your feedback.
        </p>
      )}
    </div>
  );
}
